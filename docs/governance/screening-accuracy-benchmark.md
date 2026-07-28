# Screening Accuracy Benchmark

**Status:** Active — floors CI-enforced on every push and PR.
**Owner:** MLRO / model owner.
**Established:** 28 Jul 2026 (baseline frozen at the pre-hardening commit).

## 1. What this is

The estate previously had **no precision/recall measurement at all**:
`scripts/screening-metrics.mjs` measures score-band distribution only and says
so; the backtesting protocol (`docs/governance/backtesting-protocol-2026.md`)
is blocked until ≥25 disposed cases exist. Any threshold or matcher change was
therefore unfalsifiable. This benchmark closes that gap with a **labelled
ground-truth corpus** run through the **real engines** offline on every CI run.

Three fixture files under `test/fixtures/screening-benchmark/`:

| File | Contents | Metric |
|---|---|---|
| `recall-pairs.json` | 121 true-equivalent (subject, listed) pairs a competent matcher SHOULD link, labelled by script group and by the engine `mechanism` expected to catch them | sanctions **recall** (per mechanism) |
| `hard-negatives.json` | 85 non-equivalent pairs that must stay clear — boilerplate-only corporates, single-token subsets, phonetic-adjacent distinct persons | hard-negative **clear rate** (precision proxy) |
| `adverse-headlines.json` | 114 labelled headline items (adverse / noise / wrong-subject / clean, incl. Arabic, Turkish, Russian, Spanish, French, Chinese, Korean and description-only cases) + 6 multi-day repeat-signal scenarios | adverse **classification accuracy**; **repeat-signal accuracy** |

Two runners execute the same corpus against the two engines:

- `scripts/screening-benchmark.mjs` — JS engine (`scripts/sanctions-match.mjs`,
  `scripts/adverse-media.mjs`); gated by `test/screening-benchmark.test.mjs`.
- `test/benchmark_eval.py` — Python engine (`screen.py`); self-gating.

Both use the single-entry per-pair protocol `test/bias_eval.py` established, so
a pair's outcome is never confounded by another pair's designation.

## 2. Backends are not comparable

The Python matcher runs on **rapidfuzz** in production. The bare CI test job
has no rapidfuzz, so `test/benchmark_eval.py` there runs on the difflib stub
and records `backend=py_difflib`; the fuzz job installs the hash-locked engine
deps and runs the **authoritative** `py_rapidfuzz` gate. Every floor is stored
and enforced **per backend** (`floors.json`); numbers from different backends
must never be compared or averaged. `BENCH_FORCE_DIFFLIB=1` forces the stub
(used to freeze the difflib baseline on a machine that has rapidfuzz).

## 3. Metric definitions

- **Sanctions recall** — pairs where `screen_name` / `screenName` returns a
  real hit (MANUAL REVIEW pseudo-hits do not count) ÷ all pairs.
- **Hard-negative clear rate** — negatives left fully clear ÷ all negatives,
  where entries carrying a `note` are accepted, budgeted exceptions (currently
  one: `n030`, the naser/nasrin fuzzy-range canary — the documented cost of the
  khaled/khalid-class transliteration recall gain). A hit on a noted entry is
  reported in every run (`budgeted_fp_ids`) but does not count against the
  gated clear rate, so the floor stays ratchet-only while the budget stays
  visible. Adding a `note` to a fixture is reviewed like code.
- **Adverse classification accuracy** — items where the engine's *actionable*
  decision matches the label. "Actionable" means: flagged AND eligible for the
  ≥3-stories/90-days repeat-escalation counter (Python: the engine's
  counter-eligibility predicate once it exists, else `flagged`; JS: `hit` and
  not weak-tier-only). Ground truth actionable = label `adverse`. Items are
  scoped per engine (`engines` field): non-Latin-headline cases are
  Python-pass cases because the JS scorer deliberately requires the subject
  name in the headline.
- **Repeat-signal accuracy** — scenarios where the evidence counter's fired /
  not-fired outcome matches `expected_repeat`, replaying each story on its day
  through the real `dedup_stories` → `update_adverse_evidence` path.

## 4. Frozen baseline (pre-hardening, commit of 28 Jul 2026)

| Backend | Sanctions recall | Negative clear | Adverse accuracy | Repeat accuracy |
|---|---|---|---|---|
| py_rapidfuzz | **57.0%** (69/121) | 100% | **57.9%** (66/114) | 50% (3/6) |
| py_difflib | 57.0% (69/121) | 100% | 57.9% (66/114) | 50% (3/6) |
| js | **62.0%** (75/121) | 96.5% (82/85) | **77.3%** (68/88) | n/a |

`baseline.json` is written once by the runners' `--freeze` mode and is never
rewritten by CI. The misses are exactly the corpus's designed gap classes:
transliteration groups beyond the current 10, phonetic romanization drift,
description-only adverse keywords, generic-keyword noise, wrong-subject
articles and syndicated repeat-counter inflation.

Known engine asymmetries the baseline documents:

- The JS engine's three hard-negative false positives (`n009 n010 n011`) are
  Turkish boilerplate-only corporate pairs: JS `similarity()` is a recall-first
  `max()` without Python's `min(full, core)` boilerplate veto. Accepted and
  documented — the Python engine is the precision reference; fixing it in JS
  would suppress hits, which the estate's recall-monotone rule forbids.
- The JS engine misses the Turkish dotless-ı fold (`Kılıç` vs `Kilic`) and
  stem-form English adverse terms ("sanctioned", "laundered", "kickback") —
  both are hardening targets.

## 5. Floors and the ratchet rule

`floors.json` holds the CI-enforced minimums per backend. Rules:

1. **Floors only rise.** A floor may be raised in the same PR that lands the
   behaviour making it achievable. Lowering any floor requires MLRO sign-off
   recorded in this file's change log, via model-validation change control.
2. Phase-0 floors equal the frozen baseline (pure no-regression gates).
3. The hardening programme's acceptance target is **95%**: sanctions recall
   ≥ 0.95, hard-negative clear rate ≥ 0.95, adverse classification accuracy
   ≥ 0.95 on the production backends (js, py_rapidfuzz), with `fn_count_max`
   pinning the absolute miss budget. The difflib stub backend is pinned at its
   own achieved values (it is a test stand-in, not production).

## 6. Honesty constraints on any accuracy claim

Every number above is **benchmark-relative**: it states performance on this
labelled corpus, measured by these runners, on the stated backend. It is NOT a
population-level claim about live screening traffic. Outcome-based validation
still requires the backtesting protocol's ≥25 disposed cases — nothing in this
file substitutes for that. The corpus deliberately mixes pre-hardening anchors
(~57% of recall pairs) with designed gap classes, so the same corpus that
demonstrates improvement also guards against regression; corpus composition
changes must keep that mix and be reviewed like code.

## 7. Change log

| Date | Change | Authority |
|---|---|---|
| 2026-07-28 | Corpus authored (121 + 85 + 114 + 6); baseline frozen for js / py_rapidfuzz / py_difflib; Phase-0 no-regression floors committed | Model owner (this hardening programme) |
