# Champion / Challenger Protocol — Matcher Thresholds

How the sanctions matcher's tunable surface — the material-match threshold
(`SCREEN_MATCH_THRESHOLD`, champion **0.85**) and the variant-generation
config — is challenged, evidenced and changed. This is the "effective
challenge" leg of the [MRM framework](model-risk-management-2026.md) §4 for the
Tier-1 matcher: thresholds change on evidence, through change control, never by
edit. **Owner: MLRO / Compliance Engineering · reviewed quarterly.**

## 1. Asymmetry first

A missed designation (false negative) is a TFS breach; a false positive costs
analyst time. Challenge therefore runs **one-way**: a challenger may only be
*more* sensitive than the champion (lower threshold, broader variants). A
challenger that would suppress champion alerts is out of scope by construction,
and shadow mode never affects the live run's output.

## 2. Shadow-mode method

1. **Declare** the challenger in the decision log below (e.g. threshold 0.80,
   or an added transliteration scheme) with the hypothesis it tests.
2. **Shadow-run** it over the same daily book for a full cycle (≥ 1 month):
   for each run, record challenger-only hits — subjects the challenger would
   have flagged that the champion did not. No Asana task is opened from a
   shadow hit; a sampled subset goes to manual review to label true/false.
3. **Score** it: challenger-only true hits (recall the champion is missing) vs
   challenger-only false positives (added review load), against the standing
   manual-review capacity.
4. **Decide**: promote, extend the trial, or retire the challenger — recorded
   below, and any promotion goes through
   [model-validation-2026.md §4](model-validation-2026.md) change control with
   MLRO sign-off, a golden-set update in the same PR, and a model-card
   revision.

Inputs that already exist for step 2: the daily run log, per-hit scores, and
the near-miss metric of the [backtesting ledger](backtesting-protocol-2026.md)
(any confirmed hit ≤ 0.87 automatically nominates a lower-threshold
challenger).

## 3. Standing challengers

| Challenger | Hypothesis | Status |
|---|---|---|
| Threshold 0.80 shadow | The 0.85 line leaves too little headroom for short/transliterated names | **Implemented (log-only wiring live, 28 Jul 2026)** — activation is now a config action: set `SHADOW_THRESHOLD=80` (Python engine, 0-100 scale) and/or `SCREEN_SHADOW_THRESHOLD=0.80` (JS engine, fraction). Pairs in the [shadow, champion) band are counted and logged (Python: run log + `_SHADOW_CHALLENGER` tally; JS: run log + the results file's `shadow[]` array) and NEVER become hits, cases or delta-state entries. Both engines also enforce the one-way rule in config: raising a live threshold above the champion default is rejected unless the explicit `MATCH_THRESHOLD_ALLOW_RAISE=1` / `SCREEN_MATCH_THRESHOLD_ALLOW_RAISE=1` override is set. Activate on the first backtesting near-miss finding, or on MLRO instruction. |

## 4. Decision log

| # | Date | Champion | Challenger | Evidence window | Outcome | Rationale | Signed (MLRO) |
|---|---|---|---|---|---|---|---|
| 1 | 2026-07-24 | 0.85 + `name_variants`/`_ascii_fold` | — (baseline recorded) | — | Champion affirmed | 0.85 is the conservative default adopted with the refuse-to-clear guard and MANUAL-REVIEW routing for unscoreable names; no evidence yet motivating a live challenger — first backtesting cycle will supply it | MLRO |
