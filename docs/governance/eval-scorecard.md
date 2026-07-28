# Evaluation Scorecard — Longitudinal

CI answers "does this commit pass?"; this scorecard answers **"is quality
holding over time?"** — one page where every evaluation instrument's scheduled
results accumulate, so a slow degradation (or a silent green streak nobody can
cite) becomes visible and citable. Backfilled 2026-07-24 from the actual
workflow-run history; append-only from here. **Owner: MLRO / Compliance
Engineering · appended per scheduled eval run and per release.**

## 1. Instruments

| Instrument | Cadence | What it measures | Gate |
|---|---|---|---|
| Advisor behavioural eval (`advisor-eval.yml`) | Weekly (Mon 08:09 UTC) + dispatch | Advisor answer quality/regressions; findings filed as issues | Regression issue ⇒ fix before next release |
| Advisor bias eval (`advisor-bias-eval.yml`) | Quarterly (1st, 09:09 UTC) + dispatch | Paired-prompt bias review per [advisor-bias-review-2026.md](advisor-bias-review-2026.md) | Finding ⇒ CAPA |
| Cross-script recall parity (`test/bias_eval.py`) | Every push/PR | Matcher recall ≥90%/group across Latin↔Arabic↔Turkish↔Cyrillic↔CJK↔Phonetic, gap ≤10% | Hard CI gate |
| Screening accuracy benchmark (`test/benchmark_eval.py` + `test/screening-benchmark.test.mjs`) | Every push/PR (both engines; rapidfuzz backend in the fuzz job) | Labelled-corpus floors: sanctions recall ≥95% (fn cap 3), hard-negative clear, adverse classification, repeat-signal | Hard CI gate |
| Prompt-injection red-team (`test/redteam_injection.py`) | Every push/PR | 100% detection / non-execution / no-downgrade, ≤1 benign FP | Hard CI gate — campaign history in the [red-team log](../aims/red-team-log.md) |
| Scoring golden set (`test/scoring-golden.test.js`) | Every push/PR | Engine reproduces approved methodology (35 frozen checks) | Hard CI gate |
| Citation accuracy | Every push/PR (guard) | Advisor citations resolve to the approved corpus — see [citation-accuracy-metric.md](citation-accuracy-metric.md) | Hard gate once the §160-row exemption closes |

## 2. Scheduled-run ledger (backfilled from workflow history)

Dispatch-cluster note: the 2026-07-21/22 failures across both advisor evals
were fix-verification dispatches during the list-URL/matcher remediation window
(PRs #306–#312), closed by same-window recoveries; scheduled cadence itself
never missed.

### Advisor behavioural eval — scheduled Mondays

| Date | Trigger | Result |
|---|---|---|
| 2026-06-22 | schedule | ✅ pass |
| 2026-06-29 | schedule | ✅ pass |
| 2026-07-06 | schedule | ✅ pass |
| 2026-07-13 | schedule | ✅ pass |
| 2026-07-20 | schedule | ✅ pass |
| 2026-07-21 | dispatch ×2 | ❌ fail (fix-verification window) |
| 2026-07-22 | dispatch ×2 | ✅ recovered |

### Advisor bias eval — quarterly

| Date | Trigger | Result |
|---|---|---|
| 2026-06-25 → 06-30 | dispatch ×4 (commissioning) | ✅ pass |
| 2026-07-01 | schedule (quarterly) | ✅ pass |
| 2026-07-21/22 | dispatch ×4 | ❌×3 then ✅ recovered |
| next scheduled | 2026-10-01 | — |

### Per-push CI gates (state, not series)

| Gate | Standing result as of 2026-07-28 |
|---|---|
| Cross-script recall parity | ✅ 100%/group across all six script groups (incl. Phonetic), gap 0%, zero FPs — at the raised 90%/10% floors, both backends |
| Screening accuracy benchmark | ✅ sanctions recall 97.5% (floor 95%, fn cap 3), hard-negative clear 100% unnoted (py) / 96.5% (js, documented), adverse classification 100%, repeat-signal 100% — all three backends |
| Red-team corpus | ✅ 15/15 payloads: detected, non-executed, no-downgrade |
| Scoring golden set | ✅ 35/35 (2026 Q2 sign-off) |

## 3. Rules

- Append one row per scheduled run (result + link-worthy finding, if any) and
  one consolidated row per release; never rewrite history — a corrected entry
  is a new row.
- A ❌ on a scheduled run must carry its follow-up (issue/CAPA/PR) in the row.
- Quarterly, the MLRO cites this scorecard in the
  [management review](../aims/management-review.md); a green streak with no
  entries is treated as a records failure, not as health.
