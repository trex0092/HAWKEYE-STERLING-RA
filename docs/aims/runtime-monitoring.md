# Runtime Monitoring & Drift Detection (AIMS 9.1 / A.6.2)

Operational observability for the screening control — so a silent degradation is
caught loudly instead of passing as "all clear". Owner: system maintainer / MLRO.
Implemented in `monitoring.py`; surfaced in every report (§⑤) and fed to the QA gate.

## What is monitored

### 1. Run metrics (latency · usage · anomaly)
Per run we capture and persist (to `data/run-metrics.json`, rolling 30 runs;
**daily batches only** — onboarding runs screen a handful of subjects and are
excluded from history so they cannot poison the baseline medians):
- **stage timings** — watchlist, sanctions, enrichment, AI triage, and total wall-clock;
- **counts** — subjects screened, errors, flagged / adverse / PEP findings, plus
  the degradation detail counters below;
- **LLM usage** — calls attempted / ok / failed (from `ai.LLM_CALLS`; counts only,
  no prompt or response content retained);
- **error rate** — errored subjects ÷ subjects screened.

Counts definitions (semantics fixed 2026-07-14 — see the CHANGELOG entry; the
previous engine counted only *surviving* subjects in the denominator and summed
per-module failures in the numerator, which produced impossible ratios like
"795/42 = 1893%" during the July news-feed outage):
- **subjects** — every subject the enrichment pass *attempted*, including
  errored ones (`tally_enrichment` in `screen.py`);
- **errors** — subjects with ≥ 1 module failure; a subject counts **once** no
  matter how many modules failed for it, so `errors ≤ subjects` always;
- **am_errors** — subjects whose whole news sweep failed (Google News + GDELT);
- **am_blackout** — of those, subjects with ZERO adverse coverage from ANY
  source (the OpenSanctions crime watchlist was unavailable too);
- **pep_errors** — individuals with no PEP coverage from either source
  (Wikidata live + OpenSanctions PEP mirror);
- **pep_mirror** — individuals screened via the OpenSanctions mirror fallback;
- **watchlist** — subjects with ≥ 1 adverse-exposure watchlist finding.

History spanning the 2026-07-14 semantics change stays valid: each run is
judged against its own thresholds self-consistently, and pre-change snapshots
age out of the rolling 30-run window naturally.

Each run is compared to the **trailing baseline** and an anomaly is raised when:
| Anomaly | Trigger |
|---|---|
| Latency blow-out | total runtime ≥ 3× the trailing median |
| Error-rate spike | > 10% of subjects errored |
| Coverage cliff | subjects screened < 50% of the trailing median |
| Adverse-media degradation | > 25% of subjects lost their news sweep |

### 2. Source-coverage drift
The most dangerous screening failure is a sanctions list that **silently shrinks**
(a bad parse, a truncated download, an upstream format change) — it quietly creates
false negatives. Per list we persist name counts (`data/source-coverage-state.json`)
and compare each run to the trailing median:
- a **core** list dropping ≥ 20% raises a **degrade-loudly alarm** ("treat sanctions
  as DEGRADED until verified") that is also added to the QA-gate issues;
- a **supplementary** list dropping is a soft note (never flips core coverage).

This complements the existing zero-count degrade-loudly guard: zero is caught by the
module status; a *partial* collapse is caught here.

### 3. Transaction-monitoring status (R.16)
The monitoring section also reports the honest state of the transaction-monitoring
engine — **INACTIVE** until a real feed is connected (see `in-domain-aml-coverage.md`).

## Sustained-anomaly escalation (R-14)
A single anomalous run can be noise; an anomaly that **persists across consecutive
runs** is a real degradation that must be actioned. `monitoring.sustained_anomalies`
flags any anomaly category (latency, error-rate, subject-coverage) present in every
one of the last *N* runs (default 3). When that happens:
- the report's §⑤ block prints a **`SUSTAINED ANOMALY — ESCALATE`** line, and
- the scheduled **`anomaly-watch`** workflow (`python monitoring.py escalate`) opens —
  or updates — a single GitHub issue for the MLRO (idempotent: one open issue, not
  a daily duplicate), and **closes it with a "cleared" comment** once the
  last-3-run window is clean again (a missing/stale history reads as escalate,
  so the close path can never fire on a dead pipeline). It reads the committed
  metrics history and is a clean no-op until that state exists, so it never
  fails red on its own.

## How it surfaces
- **Report §⑤ Operational Monitoring** — runtime, subjects, errors, LLM usage,
  baseline, and any anomalies / coverage drift, in plain language for the MLRO.
- **QA gate** — coverage alarms and runtime anomalies become integrity issues, so
  the governance attestation reads "ATTENTION" rather than silently passing.
- **Escalation** — a sustained anomaly auto-routes to a GitHub issue (see above).
- **Logs** — every alarm/anomaly is also written to the run log.

## Privacy
Metrics are aggregate operational data only — list names, counts, timings, and LLM
**call counts**. No customer PII and no secrets are stored; LLM content is never
retained.

## Thresholds (configurable)
`COVERAGE_DROP_PCT` (0.20), `LATENCY_ALARM_FACTOR` (3.0), `ERROR_RATE_ALARM`
(0.10), `MONITOR_HISTORY_KEEP` (30). Tune as the baseline matures.

## Forward work
- Alert routing (e.g. open a GitHub issue / Asana alert) on a sustained anomaly,
  beyond the in-report surfacing + freshness-check.
- Per-list latency and HTTP-status histograms for upstream-source SLAs.

## Evidence
- Code: `monitoring.py` · tests: `test/engine_test.py` (coverage drift + runtime
  anomaly + QA-gate wiring).
