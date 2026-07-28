#!/usr/bin/env python3
"""
SCREENING ACCURACY BENCHMARK — Python engine backend.
====================================================
Runs the labelled ground-truth corpus (test/fixtures/screening-benchmark/)
through the real Python engine (screen.py) offline and computes:

  • sanctions RECALL  — true-equivalent pairs linked / all pairs (per mechanism)
  • hard-negative CLEAR RATE — non-equivalent pairs left clear / all negatives
  • adverse-media CLASSIFICATION ACCURACY — headline items classified to their
    label ("actionable" = flagged AND eligible for the repeat-escalation
    counter; ground truth actionable = label "adverse")
  • REPEAT-SIGNAL ACCURACY — multi-day evidence-counter scenarios against the
    ≥3-stories/90-days escalation signal

Backends: the matcher runs on rapidfuzz in production; this harness records
which backend produced its numbers (py_rapidfuzz / py_difflib) and every floor
is enforced per backend — the two are NOT comparable. BENCH_FORCE_DIFFLIB=1
forces the stub (used to freeze the difflib baseline on a dev box that has
rapidfuzz installed). The fuzz CI job (real rapidfuzz) is the authoritative
gate.

Modes:
  python test/benchmark_eval.py            assert against the committed floors
                                           (test/fixtures/screening-benchmark/floors.json)
                                           — exits non-zero on any breach
  python test/benchmark_eval.py --freeze   write this backend's section of
                                           baseline.json (one-time, at the
                                           pre-hardening commit; re-freezing is
                                           a governance action — see
                                           docs/governance/screening-accuracy-benchmark.md)

Metric definitions are shared with scripts/screening-benchmark.mjs.
"""
import sys, os, types, difflib, importlib.util, json, datetime, tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
FIXTURES = os.path.join(ROOT, "test", "fixtures", "screening-benchmark")

# ── Engine bootstrap (mirrors test/bias_eval.py) ─────────────────────────────
_FORCE_DIFFLIB = os.environ.get("BENCH_FORCE_DIFFLIB", "0") == "1"
if not _FORCE_DIFFLIB and importlib.util.find_spec("rapidfuzz") is not None:
    _ENGINE = "py_rapidfuzz"
else:
    def _tsr(a, b):
        a = " ".join(sorted(a.split())); b = " ".join(sorted(b.split()))
        return difflib.SequenceMatcher(None, a, b).ratio() * 100
    def _tset(a, b):
        sa, sb = set(a.split()), set(b.split()); inter = sa & sb
        if not inter: return _tsr(a, b)
        i = " ".join(sorted(inter))
        return max(_tsr(i, " ".join(sorted(sa))), _tsr(i, " ".join(sorted(sb))), _tsr(a, b))
    _rf = types.ModuleType("rapidfuzz"); _rf.fuzz = types.SimpleNamespace(token_sort_ratio=_tsr, token_set_ratio=_tset)
    sys.modules["rapidfuzz"] = _rf
    _ENGINE = "py_difflib"
sys.modules.setdefault("pdfplumber", types.ModuleType("pdfplumber"))
_req = types.ModuleType("requests"); _req.utils = types.SimpleNamespace(quote=lambda s: s)
sys.modules.setdefault("requests", _req)
os.environ.setdefault("ASANA_TOKEN", "dummy")
os.environ.pop("ANTHROPIC_API_KEY", None)


def _load_mod(name):
    spec = importlib.util.spec_from_file_location(name, os.path.join(ROOT, name + ".py"))
    mod = importlib.util.module_from_spec(spec); spec.loader.exec_module(mod)
    return mod

ai = _load_mod("ai")
screen = _load_mod("screen")


def _fixture(name):
    with open(os.path.join(FIXTURES, name), encoding="utf-8") as f:
        return json.load(f)


# ── Sanctions: per-pair single-entry protocol (same as test/bias_eval.py) ────
def _pair_hits(subject, listed):
    lst = {"BENCH": [(screen.normalize(listed), listed)]}
    hits = screen.screen_name(subject, lst)
    return any(h.get("list") != "MANUAL REVIEW" for h in hits)


def run_sanctions():
    recall = _fixture("recall-pairs.json")
    negatives = _fixture("hard-negatives.json")

    by_mech, fn_ids = {}, []
    for p in recall["pairs"]:
        hit = _pair_hits(p["subject"], p["listed"])
        m = by_mech.setdefault(p["mechanism"], {"total": 0, "hits": 0})
        m["total"] += 1
        if hit:
            m["hits"] += 1
        else:
            fn_ids.append(p["id"])
    total = len(recall["pairs"])
    hits = total - len(fn_ids)

    # Entries carrying a "note" are accepted, budgeted exceptions (reviewed like
    # code): a hit there is reported but does not count against the clear rate
    # the floors gate — so the floor can stay ratchet-only while the budgeted
    # cost of a recall gain remains visible in every report.
    fp_ids, budgeted_fp_ids = [], []
    for n in negatives["pairs"]:
        if _pair_hits(n["subject"], n["listed"]):
            (budgeted_fp_ids if "note" in n else fp_ids).append(n["id"])
    ntotal = len(negatives["pairs"])
    return {
        "recall": {"total": total, "hits": hits, "rate": hits / total,
                   "by_mechanism": by_mech, "fn_ids": fn_ids},
        "negatives": {"total": ntotal, "clear": ntotal - len(fp_ids),
                      "clear_rate": (ntotal - len(fp_ids)) / ntotal,
                      "fp_ids": fp_ids, "budgeted_fp_ids": budgeted_fp_ids},
    }


# ── Adverse media: classification + repeat-signal simulation ─────────────────
def _article_keywords(title, description):
    """Keywords the ENGINE would find for this article. Uses the engine's
    combined title+description scanner when it exists (post-hardening), else
    the title-only scanner — the benchmark always measures the real engine."""
    fn = getattr(screen, "adverse_keywords_for", None)
    if fn is not None:
        return fn(title, description)
    return screen.match_adverse_keywords(title)


def _is_actionable(subject, article):
    """The engine's counter-eligibility predicate when it exists
    (post-hardening: relevance + keyword-tier + corroboration gating), else
    pre-hardening behaviour: every flagged article is actionable."""
    fn = getattr(screen, "adverse_actionable", None)
    if fn is not None:
        return fn(subject, article)
    return bool(article.get("keywords"))


def run_adverse():
    corpus = _fixture("adverse-headlines.json")
    items = [i for i in corpus["items"] if "py" in i.get("engines", ["py", "js"])]

    correct, wrong = 0, []
    for it in items:
        kws = _article_keywords(it["title"], it.get("description", ""))
        art = {"title": it["title"], "description": it.get("description", ""),
               "source": it.get("source_domain", ""), "url": it.get("url", ""),
               "keywords": kws,
               "categories": screen.typology_for(kws),
               "flagged": bool(kws)}
        actionable = _is_actionable(it["subject"], art)
        truth = it["label"] == "adverse"
        if actionable == truth:
            correct += 1
        else:
            wrong.append(it["id"])
    classification = {"total": len(items), "correct": correct,
                      "accuracy": correct / len(items), "wrong_ids": wrong}

    # Repeat-signal scenarios: replay each story on its day through the real
    # dedup + evidence-counter path, then read the signal on the reference day.
    ref = datetime.date.fromisoformat(corpus["reference_date"])
    scen_correct, scen_wrong = 0, []
    for sc in corpus["repeat_scenarios"]:
        with tempfile.TemporaryDirectory() as td:
            path = os.path.join(td, "evidence.json")
            by_day = {}
            for st in sc["stories"]:
                by_day.setdefault(st["day_offset"], []).append(st)
            for off in sorted(by_day):
                day = (ref + datetime.timedelta(days=off)).isoformat()
                arts = []
                for st in by_day[off]:
                    kws = _article_keywords(st["title"], st.get("description", ""))
                    arts.append({"title": st["title"], "source": st["source"],
                                 "url": st["url"], "keywords": kws,
                                 "categories": screen.typology_for(kws),
                                 "flagged": bool(kws), "date": day, "ts": None})
                arts = screen.dedup_stories(arts)
                finding = [{"subject_name": sc["subject"], "subject_type": "COMPANY",
                            "parent": "", "articles": [a for a in arts if a["flagged"]]}]
                screen.update_adverse_evidence(finding, day, path=path)
            fired = sc["subject"] in screen.update_adverse_evidence([], ref.isoformat(), path=path)
        if fired == sc["expected_repeat"]:
            scen_correct += 1
        else:
            scen_wrong.append(sc["id"])
    repeat = {"total": len(corpus["repeat_scenarios"]), "correct": scen_correct,
              "accuracy": scen_correct / len(corpus["repeat_scenarios"]),
              "wrong_ids": scen_wrong}
    return {"classification": classification, "repeat": repeat}


def compute_all():
    return {"backend": _ENGINE, "sanctions": run_sanctions(), "adverse": run_adverse()}


def _fmt(x):
    return "%.1f%%" % (100 * x)


def main():
    metrics = compute_all()
    s, a = metrics["sanctions"], metrics["adverse"]
    print(f"screening-benchmark backend={metrics['backend']}")
    print(f"  sanctions recall        {s['recall']['hits']}/{s['recall']['total']}  {_fmt(s['recall']['rate'])}")
    for mech, v in s["recall"]["by_mechanism"].items():
        print(f"    {mech:<16} {v['hits']}/{v['total']}")
    if s["recall"]["fn_ids"]:
        print(f"    missed: {' '.join(s['recall']['fn_ids'])}")
    print(f"  hard-negatives clear    {s['negatives']['clear']}/{s['negatives']['total']}  {_fmt(s['negatives']['clear_rate'])}")
    if s["negatives"]["fp_ids"]:
        print(f"    false positives: {' '.join(s['negatives']['fp_ids'])}")
    if s["negatives"].get("budgeted_fp_ids"):
        print(f"    budgeted (noted) false positives: {' '.join(s['negatives']['budgeted_fp_ids'])}")
    print(f"  adverse classification  {a['classification']['correct']}/{a['classification']['total']}  {_fmt(a['classification']['accuracy'])}")
    if a["classification"]["wrong_ids"]:
        print(f"    misclassified: {' '.join(a['classification']['wrong_ids'])}")
    print(f"  repeat-signal accuracy  {a['repeat']['correct']}/{a['repeat']['total']}  {_fmt(a['repeat']['accuracy'])}")
    if a["repeat"]["wrong_ids"]:
        print(f"    wrong scenarios: {' '.join(a['repeat']['wrong_ids'])}")

    base_path = os.path.join(FIXTURES, "baseline.json")
    if "--freeze" in sys.argv:
        try:
            with open(base_path, encoding="utf-8") as f:
                out = json.load(f)
        except Exception:
            out = {"version": 1,
                   "description": ("Frozen pre-hardening benchmark baseline, per backend. Written once "
                                   "by the runners' --freeze mode; CI compares against it and never "
                                   "rewrites it. Re-freezing is a governance action "
                                   "(docs/governance/screening-accuracy-benchmark.md)."),
                   "backends": {}}
        out["backends"][metrics["backend"]] = {"sanctions": s, "adverse": a}
        with open(base_path, "w", encoding="utf-8") as f:
            json.dump(out, f, indent=1, ensure_ascii=False)
            f.write("\n")
        print(f"baseline.json: {metrics['backend']} section frozen")
        return

    # ── CI gate: enforce the committed floors for THIS backend ───────────────
    with open(os.path.join(FIXTURES, "floors.json"), encoding="utf-8") as f:
        floors_all = json.load(f)
    floors = floors_all["backends"].get(metrics["backend"])
    if floors is None:
        print(f"BENCHMARK FAILED: no committed floors for backend {metrics['backend']}")
        sys.exit(1)
    eps = 1e-9
    failures = []
    if s["recall"]["rate"] + eps < floors["recall_min"]:
        failures.append(f"sanctions recall {_fmt(s['recall']['rate'])} < floor {_fmt(floors['recall_min'])}")
    if s["negatives"]["clear_rate"] + eps < floors["negative_clear_min"]:
        failures.append(f"hard-negative clear rate {_fmt(s['negatives']['clear_rate'])} < floor {_fmt(floors['negative_clear_min'])}")
    if a["classification"]["accuracy"] + eps < floors["adverse_accuracy_min"]:
        failures.append(f"adverse accuracy {_fmt(a['classification']['accuracy'])} < floor {_fmt(floors['adverse_accuracy_min'])}")
    if a["repeat"]["accuracy"] + eps < floors["repeat_accuracy_min"]:
        failures.append(f"repeat-signal accuracy {_fmt(a['repeat']['accuracy'])} < floor {_fmt(floors['repeat_accuracy_min'])}")
    max_fn = floors.get("fn_count_max")
    if max_fn is not None and (s["recall"]["total"] - s["recall"]["hits"]) > max_fn:
        failures.append(f"fn count {s['recall']['total'] - s['recall']['hits']} > cap {max_fn}")
    print("=" * 64)
    if failures:
        print("BENCHMARK FAILED:")
        for f_ in failures:
            print("   ✗ " + f_)
        sys.exit(1)
    print("BENCHMARK PASSED — all floors held for backend " + metrics["backend"])


if __name__ == "__main__":
    main()
