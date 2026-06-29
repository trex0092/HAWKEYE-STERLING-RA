# Runtime Monitoring & Drift Detection (AIMS 9.1 / A.6.2)

Operational observability for the screening control — so a silent degradation is
caught loudly instead of passing as "all clear". Owner: system maintainer / MLRO.
Implemented in `monitoring.py`; surfaced in every report (§⑤) and fed to the QA gate.

## What is monitored

### 1. Run metrics (latency · usage · anomaly)
Per run we capture and persist (to `data/run-metrics.json`, rolling 30 runs):
- **stage timings** — sanctions, enrichment, AI triage, and total wall-clock;
- **counts** — subjects screened, errors, flagged / adverse / PEP findings;
- **LLM usage** — calls attempted / ok / failed (from `ai.LLM_CALLS`; counts only,
  no prompt or response content retained);
- **error rate** — errored subjects ÷ subjects screened.

Each run is compared to the **trailing baseline** and an anomaly is raised when:
| Anomaly | Trigger |
|---|---|
| Latency blow-out | total runtime ≥ 3× the trailing median |
| Error-rate spike | > 10% of subjects errored |
| Coverage cliff | subjects screened < 50% of the trailing median |

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

## How it surfaces
- **Report §⑤ Operational Monitoring** — runtime, subjects, errors, LLM usage,
  baseline, and any anomalies / coverage drift, in plain language for the MLRO.
- **QA gate** — coverage alarms and runtime anomalies become integrity issues, so
  the governance attestation reads "ATTENTION" rather than silently passing.
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
