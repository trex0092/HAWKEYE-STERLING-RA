#!/usr/bin/env python3
"""
FINE GOLD LLC — RUNTIME MONITORING & DRIFT DETECTION  (monitoring.py)
Hawkeye Sterling V2 — operational observability for the screening control.
====================================================================
Two complementary monitors, both deterministic and persisted to git so there is
an auditable history:

  1. RUN METRICS (latency / usage / anomaly) — per-run stage timings, subject /
     LLM-call / error counts, and finding counts. Compared against the trailing
     baseline so an ANOMALY (e.g. coverage collapse, latency blow-out, error
     spike, finding-count cliff) is surfaced loudly instead of passing silently.

  2. SOURCE-COVERAGE DRIFT — per-list name counts vs their trailing median. A
     sanctions list that silently shrinks (bad parse, truncated download, format
     change) is the most dangerous failure mode in screening: it quietly creates
     false negatives. A sharp drop raises a degrade-loudly alarm and feeds the QA
     gate.

DESIGN: pure functions + JSON state in data/. No secrets, no PII (only names of
lists and aggregate counts/timings). No third-party dependencies.
"""
import os, json, time

METRICS_STATE_PATH  = os.environ.get("METRICS_STATE_PATH", "data/run-metrics.json")
COVERAGE_STATE_PATH = os.environ.get("COVERAGE_STATE_PATH", "data/source-coverage-state.json")
HISTORY_KEEP        = int(os.environ.get("MONITOR_HISTORY_KEEP", "30"))   # rolling window
COVERAGE_DROP_PCT   = float(os.environ.get("COVERAGE_DROP_PCT", "0.20"))  # >20% drop = alarm
LATENCY_FACTOR      = float(os.environ.get("LATENCY_ALARM_FACTOR", "3.0"))
ERROR_RATE_ALARM    = float(os.environ.get("ERROR_RATE_ALARM", "0.10"))   # >10% subjects errored
AM_ERROR_RATE_ALARM = float(os.environ.get("AM_ERROR_RATE_ALARM", "0.25"))  # >25% of subjects lost adverse-media coverage


# ── small JSON helpers (never raise) ──────────────────────────────────────────
def _load(path, default):
    try:
        with open(path) as f:
            return json.load(f)
    except Exception:
        return default


def _save(path, data):
    try:
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w") as f:
            json.dump(data, f, indent=1, sort_keys=True)
        return True
    except Exception:
        return False


def _median(xs):
    xs = sorted(x for x in xs if isinstance(x, (int, float)))
    if not xs:
        return None
    n = len(xs)
    return xs[n // 2] if n % 2 else (xs[n // 2 - 1] + xs[n // 2]) / 2


# ── 1) RUN METRICS ────────────────────────────────────────────────────────────
class RunMetrics:
    """Collect timings + counters for one screening run.
        m = RunMetrics();
        with m.stage("sanctions"): ...
        m.set(subjects=520, errors=2); m.finalize(today, list_meta_counts)
    """
    def __init__(self, clock=time.time):
        self._clock = clock
        self.timings = {}     # stage -> seconds
        self.counts = {}      # arbitrary counters
        self._t0 = clock()

    def stage(self, name):
        return _Stage(self, name)

    def record_stage(self, name, seconds):
        self.timings[name] = round(self.timings.get(name, 0.0) + float(seconds), 3)

    def set(self, **kw):
        self.counts.update(kw)

    def snapshot(self, today, llm_calls=None):
        total = round(self._clock() - self._t0, 3)
        subjects = int(self.counts.get("subjects", 0) or 0)
        errors = int(self.counts.get("errors", 0) or 0)
        return {
            "date": today,
            "total_seconds": total,
            "timings": dict(self.timings),
            "counts": dict(self.counts),
            "error_rate": round(errors / subjects, 4) if subjects else 0.0,
            "llm_calls": dict(llm_calls or {}),
        }


class _Stage:
    def __init__(self, m, name):
        self.m, self.name = m, name
    def __enter__(self):
        self._t = self.m._clock(); return self
    def __exit__(self, *a):
        self.m.record_stage(self.name, self.m._clock() - self._t); return False


def analyze_run(snapshot, history):
    """Compare this run's snapshot to the trailing history. Returns
    {anomalies:[...], baseline:{...}}. Deterministic, explainable."""
    anomalies = []
    prev = [h for h in history if h.get("date") != snapshot.get("date")]
    # Latency anomaly vs median total.
    med_total = _median([h.get("total_seconds", 0) for h in prev])
    if med_total and snapshot["total_seconds"] > LATENCY_FACTOR * med_total:
        anomalies.append(
            f"latency {snapshot['total_seconds']:.0f}s ≥ {LATENCY_FACTOR:g}× median {med_total:.0f}s")
    # Error-rate anomaly (absolute).
    if snapshot["error_rate"] > ERROR_RATE_ALARM:
        anomalies.append(
            f"error rate {snapshot['error_rate']*100:.0f}% > {ERROR_RATE_ALARM*100:.0f}% threshold")
    # Subject-count cliff vs median (coverage of the book collapsed).
    med_subj = _median([h.get("counts", {}).get("subjects", 0) for h in prev])
    subj = snapshot["counts"].get("subjects", 0)
    if med_subj and subj < 0.5 * med_subj:
        anomalies.append(
            f"subjects screened {subj} < 50% of median {med_subj:.0f} — coverage drop")
    # Adverse-media module degradation (absolute): a large share of subjects lost
    # their adverse-media pass — recall is silently narrowed even when the rest of
    # the run is green. Sustained across runs ⇒ escalation (anomaly-watch).
    am = snapshot["counts"].get("am_errors", 0)
    if subj and am / subj > AM_ERROR_RATE_ALARM:
        anomalies.append(
            f"adverse-media errors {am}/{subj} ({am/subj*100:.0f}%) > {AM_ERROR_RATE_ALARM*100:.0f}% — media recall degraded")
    return {"anomalies": anomalies,
            "baseline": {"median_total_seconds": med_total, "median_subjects": med_subj,
                         "history_runs": len(prev)}}


def _anomaly_types(snapshot, prev):
    """Category keys of the anomalies firing for one snapshot against its prior
    runs — the same thresholds analyze_run uses, but reduced to stable keys so an
    anomaly can be tracked ACROSS runs (the human strings carry run-specific
    numbers and cannot be compared for identity)."""
    t = set()
    med_total = _median([h.get("total_seconds", 0) for h in prev])
    if med_total and snapshot.get("total_seconds", 0) > LATENCY_FACTOR * med_total:
        t.add("latency")
    if snapshot.get("error_rate", 0) > ERROR_RATE_ALARM:
        t.add("error_rate")
    med_subj = _median([h.get("counts", {}).get("subjects", 0) for h in prev])
    subj = snapshot.get("counts", {}).get("subjects", 0)
    if med_subj and subj < 0.5 * med_subj:
        t.add("subjects")
    am = snapshot.get("counts", {}).get("am_errors", 0)
    if subj and am / subj > AM_ERROR_RATE_ALARM:
        t.add("adverse_media")
    return t


def sustained_anomalies(history, window=3):
    """Anomaly categories present in EVERY one of the last `window` runs — a
    persistent degradation worth escalating, as distinct from a single-run blip.
    Each run is judged against the runs strictly before it. Fewer than `window`
    runs ⇒ nothing sustained yet. Returns a sorted list of category keys."""
    hist = [h for h in (history or []) if isinstance(h, dict)]
    if window < 1 or len(hist) < window:
        return []
    per_run = [_anomaly_types(hist[i], hist[:i]) for i in range(len(hist) - window, len(hist))]
    return sorted(set.intersection(*per_run)) if per_run else []


# Human labels for the escalation message / issue body.
_ANOMALY_LABELS = {
    "latency": "runtime latency blow-out",
    "error_rate": "elevated error rate",
    "subjects": "subject-coverage drop",
    "adverse_media": "adverse-media module degradation (recall narrowed)",
}


def escalation(history=None, window=3, path=None):
    """Decide whether sustained anomalies warrant raising an alert. Reads the
    persisted metrics history when `history` is not supplied. Safe: missing or
    short history ⇒ {escalate: False}. Pure given its inputs."""
    hist = history if history is not None else _load(path or METRICS_STATE_PATH, [])
    types = sustained_anomalies(hist if isinstance(hist, list) else [], window)
    return {"escalate": bool(types), "types": types,
            "summary": "; ".join(_ANOMALY_LABELS.get(t, t) for t in types),
            "window": window}


def persist_run(snapshot, path=None):
    """Append the snapshot to the rolling history file (keeps HISTORY_KEEP)."""
    p = path or METRICS_STATE_PATH
    hist = _load(p, [])
    if not isinstance(hist, list):
        hist = []
    hist = [h for h in hist if h.get("date") != snapshot.get("date")]
    hist.append(snapshot)
    hist = hist[-HISTORY_KEEP:]
    _save(p, hist)
    return hist


def monitor_run(today, counts, timings=None, llm_calls=None, path=None):
    """Convenience: build a snapshot from plain dicts, analyze vs history, persist.
    Returns {snapshot, anomalies, baseline}."""
    snap = {"date": today, "total_seconds": float((timings or {}).get("total", 0.0)),
            "timings": dict(timings or {}),
            "counts": dict(counts or {}),
            "error_rate": round((counts.get("errors", 0) or 0) / counts["subjects"], 4)
                          if counts.get("subjects") else 0.0,
            "llm_calls": dict(llm_calls or {})}
    p = path or METRICS_STATE_PATH
    hist = _load(p, [])
    res = analyze_run(snap, hist if isinstance(hist, list) else [])
    updated = persist_run(snap, p)
    res["sustained"] = sustained_anomalies(updated)
    return {"snapshot": snap, **res}


# ── 2) SOURCE-COVERAGE DRIFT ──────────────────────────────────────────────────
def check_source_coverage(list_meta, today, path=None):
    """Compare each list's current name count to its trailing median. Returns
    {alarms:[...], drops:[...], updated:bool}. A core list that drops sharply is
    an ALARM (degrade loudly); a supplementary list is a soft note.

    list_meta: {key: {count, tier}}  (as produced by load_all_lists)
    """
    p = path or COVERAGE_STATE_PATH
    state = _load(p, {})
    if not isinstance(state, dict):
        state = {}
    alarms, drops = [], []
    for key, meta in (list_meta or {}).items():
        count = int(meta.get("count", 0) or 0)
        tier = meta.get("tier", "core")
        hist = state.get(key, {}).get("history", [])
        med = _median([h["count"] for h in hist if isinstance(h.get("count"), (int, float))])
        if med and med > 0:
            drop = (med - count) / med
            if drop >= COVERAGE_DROP_PCT:
                msg = (f"{key.upper()} list coverage dropped {drop*100:.0f}% "
                       f"({count:,} now vs trailing median {med:,.0f})")
                drops.append(msg)
                if tier == "core":
                    alarms.append(msg + " — possible bad parse / truncated source; treat sanctions as DEGRADED until verified")
        # update history (skip zero counts — those are handled by degrade-loudly elsewhere)
        entry = state.setdefault(key, {"history": []})
        entry["history"] = [h for h in entry["history"] if h.get("date") != today]
        if count > 0:
            entry["history"].append({"date": today, "count": count})
        entry["history"] = entry["history"][-HISTORY_KEEP:]
        entry["tier"] = tier
    updated = _save(p, state)
    return {"alarms": alarms, "drops": drops, "updated": updated}


# ── REPORT RENDER ─────────────────────────────────────────────────────────────
def build_monitoring_section(run_result, coverage_result, txn_status=None):
    """Render the operational-monitoring block for the report."""
    L = []
    snap = run_result.get("snapshot", {})
    anomalies = run_result.get("anomalies", [])
    base = run_result.get("baseline", {})
    L.append("Operational monitoring (latency · usage · anomaly · coverage drift):")
    L.append(f"   Runtime: {snap.get('total_seconds', 0):.0f}s   "
             f"Subjects: {snap.get('counts', {}).get('subjects', 0)}   "
             f"Errors: {snap.get('counts', {}).get('errors', 0)} "
             f"({snap.get('error_rate', 0)*100:.0f}%)")
    llm = snap.get("llm_calls", {})
    if llm:
        L.append(f"   LLM usage: {llm.get('attempted',0)} call(s) · "
                 f"{llm.get('ok',0)} ok · {llm.get('failed',0)} failed")
    if base.get("history_runs"):
        L.append(f"   Baseline: {base['history_runs']} prior run(s); "
                 f"median runtime {(_fmt(base.get('median_total_seconds')))}, "
                 f"median subjects {(_fmt_count(base.get('median_subjects')))}")
    if anomalies:
        L.append("   ⚠ ANOMALIES:")
        for a in anomalies:
            L.append(f"      ⚠ {a}")
    else:
        L.append("   ✅ no runtime anomalies vs baseline")
    sustained = run_result.get("sustained", [])
    if sustained:
        L.append("   ⚠⚠ SUSTAINED ANOMALY — ESCALATE: "
                 + ", ".join(_ANOMALY_LABELS.get(s, s) for s in sustained)
                 + " persisted across recent runs; raise to the MLRO / open an alert "
                   "(routed automatically by the anomaly-watch workflow).")
    drops = coverage_result.get("drops", [])
    if drops:
        L.append("   ⚠ SOURCE-COVERAGE DRIFT:")
        for d in drops:
            L.append(f"      ⚠ {d}")
    else:
        L.append("   ✅ source coverage stable vs trailing baseline")
    if txn_status:
        L.append(f"   {txn_status}")
    return "\n".join(L)


def _fmt(x):
    return "n/a" if x is None else (f"{x:.0f}s" if x and x > 100 else f"{x:.0f}")


def _fmt_count(x):
    # A plain count (subjects/runs) — never carries a seconds unit like _fmt.
    return "n/a" if x is None else f"{x:.0f}"


# ── CLI ───────────────────────────────────────────────────────────────────────
# `python monitoring.py escalate [metrics-state.json]` prints a one-line JSON
# escalation verdict for the anomaly-watch workflow to act on. Always exits 0
# (a missing/short history is simply "no escalation"), so the workflow stays
# green and only opens an issue when there is a genuine sustained anomaly.
if __name__ == "__main__":
    import sys
    mode = sys.argv[1] if len(sys.argv) > 1 else "escalate"
    if mode == "escalate":
        state = sys.argv[2] if len(sys.argv) > 2 else None
        print(json.dumps(escalation(path=state)))
    else:
        sys.stderr.write(f"unknown mode: {mode}\n")
        sys.exit(2)
