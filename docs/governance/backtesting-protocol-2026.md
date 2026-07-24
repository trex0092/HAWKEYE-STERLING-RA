# Backtesting & Outcomes-Analysis Protocol (2026)

The golden set proves the models are **consistent** (same inputs → approved
outputs). This protocol proves — or refutes — that they are **predictive**:
that higher bands and flagged alerts correspond to genuinely riskier customers
once dispositions are known. It is the SR 11-7 "outcomes analysis" and CBUAE
MMS backtesting leg of the [MRM framework](model-risk-management-2026.md) §3.
**Owner: MLRO · cycle: quarterly, with the methodology review.**

## 1. What is backtested

| Surface | Question the backtest answers |
|---|---|
| Risk-scoring engine bands (CDD/SDD/EDD) | Do EDD-band customers show a higher rate of confirmed-risk outcomes than SDD, and SDD than CDD (band ordinality)? |
| Sanctions matcher alerts (threshold 0.85) | What share of alerts are confirmed vs cleared as false positives, and at what score did true hits enter (headroom above/below the threshold)? |
| Adverse-media repeat-pattern signal (≥3 stories/90d) | Does the signal's firing correlate with escalation/STR-assessment outcomes? |

## 2. Data joined per cycle

One row per **disposed** case, joined from records that already exist:

- `data/screening-cases-state.json` (state branch): case key, `taskGid`,
  `createdAt`, `cleared`;
- the Asana task's disposition and rationale (system of record);
- the assessment register: band, total score, per-factor breakdown at alert
  time;
- for matcher alerts: the hit score and matched list entry from the run log.

Outcome labels: `confirmed` (true match / risk substantiated / escalated / STR
assessed), `cleared-FP` (false positive with rationale), `cleared-other`
(e.g. relationship declined for unrelated reasons — excluded from precision).

## 3. Metrics and thresholds

| Metric | Definition | Investigate when |
|---|---|---|
| Alert precision | confirmed ÷ (confirmed + cleared-FP), overall and per list source | < 5% sustained two cycles (threshold-tuning candidate → [champion/challenger](champion-challenger-thresholds.md)) |
| Band ordinality | confirmed-rate(EDD) ≥ confirmed-rate(SDD) ≥ confirmed-rate(CDD) | any inversion |
| Score-boundary sensitivity | share of confirmed outcomes within ±1 point of the 19/20 and 22/23 boundaries | > 20% of confirmed sitting at a boundary |
| Matcher score margin | distribution of true-hit scores vs the 0.85 threshold | any confirmed hit ≤ 0.87 (near-miss headroom) |
| FP concentration | cleared-FP share by script/jurisdiction | material skew (feeds the fairness review) |

Small-N guard: no metric is interpreted below **25 disposed cases** overall or
**10 per cell**; cells below that are reported as `n too small`, never as a
pass.

## 4. Current state — honest

As of 2026-07-24 the case ledger holds **18 open / 0 disposed** cases: the
protocol is ready but **no cycle can run yet**. First cycle fires when ≥ 25
dispositions have accumulated — tracked as **item 14** in the
[open-actions register](open-actions-register.md). Until then, nothing in this
file claims predictive validity.

## 5. Ledger

One row per completed cycle; findings feed the quarterly sign-off in
[model-validation-2026.md §5](model-validation-2026.md) and any weight/threshold
change goes through its §4 change control.

| Cycle | Window | Disposed n | Alert precision | Band ordinality | Boundary share | Findings / action | Signed (MLRO) | Date |
|---|---|---|---|---|---|---|---|---|
| 1 | _pending ≥25 dispositions_ | — | — | — | — | — | — | — |
