# Population-Stability Monitoring (PSI) — AIMS 9.1 / A.6.2

[Runtime monitoring](runtime-monitoring.md) compares each run to its trailing
operational baseline (latency, errors, coverage). This spec adds the layer a
bank's model-risk function expects on top: **is the population the models see
still the population they were validated on?** A scoring engine validated on
one customer mix can mis-band a drifted one with every run individually
looking healthy. **Owner: MLRO / Compliance Engineering · cadence: monthly +
at each quarterly validation.**

## 1. Metric

Population Stability Index per monitored distribution:

`PSI = Σ over bins (actual% − expected%) × ln(actual% ÷ expected%)`

with the standard reading — **< 0.10** stable · **0.10 – 0.25** investigate ·
**> 0.25** action (revalidation of the affected surface, recorded in
[model-validation-2026.md §5](../governance/model-validation-2026.md)).

Guards: bins with expected n < 5 are merged before computing; a distribution
with total n < 50 in the window reports `n too small`, never a score.

## 2. Monitored distributions

| Distribution | Bins | Why it matters |
|---|---|---|
| Risk-score totals | 0–19 / 20–22 / 23+ (band shares), plus 2-point sub-bins | Band-mix drift = the engine is being asked a different question than validated |
| Jurisdiction risk mix | baseline country-risk levels (1/2/3) of active book | Geographic drift shifts factor weights' real-world meaning |
| Business-activity mix | activity risk levels (1/2/3) | Sector drift, same reason |
| Onboarding channel | in-person / remote | Remote share drives a 3-weight factor |
| Matcher score distribution | 0–0.5 / 0.5–0.7 / 0.7–0.85 / ≥0.85 | Creep toward the threshold = variant/list drift before it becomes misses |
| Name-script mix | Latin / Arabic / other (from the matcher's normalisation path) | Ties population drift to the fairness bound — a script-mix shift makes the recall-parity test's weighting stale |

## 3. Baseline discipline

The **expected** distribution is frozen at the last quarterly validation
sign-off (first baseline: the 2026 Q3 review), not a rolling window — a rolling
expected baseline absorbs drift instead of detecting it. Each sign-off either
re-freezes the current mix as the new baseline or records why not.

## 4. Wiring (implementation contract)

- Band shares and matcher-score bins extend the per-run counters already
  persisted to `data/run-metrics.json` by `monitoring.py` (daily batches only,
  same exclusion of onboarding runs).
- The monthly PSI computation reads the last-frozen baseline from this pack's
  companion state (encrypted, state branch — same handling as
  `run-metrics.json.enc`) and reports into the daily brief §⑤ block.
- `investigate`/`action` breaches raise through the existing Anomaly Watch
  escalation path (MLRO issue), severity mapped to the §1 bands.
- Until the wiring lands, the computation runs manually at the quarterly
  review from the persisted run metrics — the obligation exists from the first
  baseline freeze, tooling or not.

## 5. Log

| Date | Distribution | PSI | Reading | Action | Signed |
|---|---|---|---|---|---|
| _first entry at the 2026 Q3 validation (baseline freeze)_ | | | | | |
