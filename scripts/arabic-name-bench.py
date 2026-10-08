#!/usr/bin/env python3
"""Arabic-script name benchmark — EXPERIMENTAL, shadow-only, dispatch-only.

The question it answers: when a customer is recorded in Latin script and the
designated party is listed in Arabic script only (304 of the 309 structured
entries in data/eocn-local-terrorist-list.json are), does anything match?
HAWKEYE's matcher keeps Arabic names in Arabic (screen.normalize folds
orthography, screen.romanize deliberately does not guess Arabic), so a Latin
"Adam Jees" never meets a listed "آدم جيس".

Gold pairs come from an OFFICIAL source that publishes both scripts for the same
party: the UN Security Council Consolidated List gives the Latin name parts and
NAME_ORIGINAL_SCRIPT. The workflow downloads it at run time; nothing is
committed. Every Latin name is scored against every Arabic original:
  - same party      → must match (recall)
  - different party → must not (false-match rate)

Engines compared:
  hawkeye  screen.normalize + screen.match_score, decisive ≥ screen.THRESHOLD
           (the live fuzzy gate. The phonetic key strips non-Latin letters and the
           token-set score compares the same normalised strings, which share no
           characters across scripts, so neither is expected to change a
           cross-script result; this is an inference, not measured here)
  rigour   opensanctions/rigour (MIT) name analysis: Wikidata-derived NAME
           symbols shared across scripts (محمد and Mohammed carry the same QID).
           Rule, fixed BEFORE any run: match when the two names share at least
           min(2, shorter part count) symbols covering ≥ 50% of the shorter
           name's parts.

Nothing here touches screening state, cases or Asana, and the live matcher is
unchanged: adopting rigour's symbols would be a separate change governed by the
recall-monotone invariant (test/fixtures/screening-benchmark/floors.json).

Usage: python scripts/arabic-name-bench.py <un-consolidated.xml> [--json out.json]
"""
import json
import os
import re
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

_ARABIC = re.compile("[؀-ۿݐ-ݿ]")


def un_pairs(xml_bytes):
    """(party_id, kind, latin_name, arabic_original) for every UN entry whose
    NAME_ORIGINAL_SCRIPT contains Arabic script."""
    import screen  # the engine's XXE-safe parser
    root = screen.safe_xml_fromstring(xml_bytes)
    out = []
    for section, tag, kind in (("INDIVIDUALS", "INDIVIDUAL", "PER"),
                               ("ENTITIES", "ENTITY", "ORG")):
        sec = root.find(section)
        if sec is None:
            continue
        for entry in sec.findall(tag):
            orig = (entry.findtext("NAME_ORIGINAL_SCRIPT") or "").strip()
            if not orig or not _ARABIC.search(orig):
                continue
            parts = [(entry.findtext(f) or "").strip()
                     for f in ("FIRST_NAME", "SECOND_NAME", "THIRD_NAME", "FOURTH_NAME", "NAME")]
            latin = " ".join(p for p in parts if p)
            if not latin or _ARABIC.search(latin):
                continue
            pid = (entry.findtext("DATAID") or entry.findtext("REFERENCE_NUMBER") or latin).strip()
            out.append((pid, kind, latin, orig))
    return out


def hawkeye_matcher():
    import screen

    def match(latin, arabic, kind):
        a, b = screen.normalize(latin), screen.normalize(arabic)
        if not a or not b:
            return False
        return screen.match_score(a, b)[0] >= screen.THRESHOLD
    return match


def rigour_matcher():
    from rigour.names import NameTypeTag, analyze_names
    cache = {}

    def analyse(text, kind):
        key = (text, kind)
        if key not in cache:
            tag = NameTypeTag.PER if kind == "PER" else NameTypeTag.ORG
            names = analyze_names(tag, [text])
            syms, parts = set(), 0
            for n in names:
                syms |= {s for s in n.symbols if str(s).startswith("[NAME:")}
                parts = max(parts, len(n.parts))
            cache[key] = (syms, parts)
        return cache[key]

    def match(latin, arabic, kind):
        sa, pa = analyse(latin, kind)
        sb, pb = analyse(arabic, kind)
        shorter = min(pa, pb)
        if not shorter:
            return False
        shared = len(sa & sb)
        return shared >= min(2, shorter) and shared / shorter >= 0.5
    return match


def evaluate(pairs, match):
    tp = fp = neg = 0
    for i, (_pid, kind, latin, _orig) in enumerate(pairs):
        for j, (_pid2, _k2, _l2, arabic) in enumerate(pairs):
            ok = match(latin, arabic, kind)
            if i == j:
                tp += ok
            else:
                neg += 1
                fp += ok
    n = len(pairs)
    return {"pairs": n, "recall": tp / n if n else 0.0, "hits": tp,
            "false_matches": fp, "negatives": neg,
            "false_match_rate": fp / neg if neg else 0.0}


def main(argv):
    if len(argv) < 2:
        print(__doc__)
        return 2
    with open(argv[1], "rb") as fh:
        pairs = un_pairs(fh.read())
    if not pairs:
        # Degrade loudly: an empty gold set must never read as "0% recall, 0 FPs".
        print("ERROR: no Arabic-script NAME_ORIGINAL_SCRIPT entries found in the UN file")
        return 1
    results = {"source": "UN Security Council Consolidated List (NAME_ORIGINAL_SCRIPT)",
               "engines": {"hawkeye": evaluate(pairs, hawkeye_matcher()),
                           "rigour": evaluate(pairs, rigour_matcher())}}
    lines = ["## Arabic-script name benchmark (shadow)", "",
             f"Gold pairs: {len(pairs)} UN parties with an Arabic original-script name.",
             "Latin name scored against every Arabic original; same party must match.", "",
             "| engine | recall | hits | false matches | negatives | false-match rate |",
             "|---|---:|---:|---:|---:|---:|"]
    for name, r in results["engines"].items():
        lines.append(f"| {name} | {r['recall']:.1%} | {r['hits']}/{r['pairs']} | "
                     f"{r['false_matches']} | {r['negatives']} | {r['false_match_rate']:.4%} |")
    report = "\n".join(lines)
    print(report)
    summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary:
        with open(summary, "a", encoding="utf-8") as fh:
            fh.write(report + "\n")
    if "--json" in argv:
        with open(argv[argv.index("--json") + 1], "w", encoding="utf-8") as fh:
            json.dump(results, fh, indent=2)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
