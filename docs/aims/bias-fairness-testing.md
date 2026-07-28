# Bias & Fairness Testing (AIMS A.5.4 / risk R-05)

How we test that the name-matching engine does not systematically under-match
non-Latin (Arabic / Turkish) names — the fairness risk recorded as **R-05**.

Owner: system maintainer / MLRO. Cadence: every CI run + reviewed each model/threshold change.

## Why this matters
In sanctions screening, a fairness failure is a **false-negative** failure: if the
matcher recognises "John Smith" but not the transliterated equivalents of an
Arabic or Turkish name, customers with those names get *less* screening coverage —
a discriminatory AND a compliance failure at once. The transliteration variant
sets (`ai.name_variants`) exist to close that gap; this test proves they do.

## Method
`test/bias_eval.py` holds a **labelled equivalence set** — pairs of
`(spelling on the customer file, spelling on the designation list)` that a
competent, fair matcher *should* link — grouped by script:

| Group | Example equivalent pair |
|---|---|
| Latin | `Stanford Marsh Limited` ↔ `Stanford Marsh Ltd` |
| Arabic | `Mohammed Al Hussein` ↔ `Muhammad Al Husain` |
| Turkish | `Mehmet Akif Turker` ↔ `Mehmet Akif Turker` |

plus a **non-equivalence set** of pairs that must *not* link (e.g. two firms that
share only corporate boilerplate), to confirm fairness isn't bought with false
positives.

For each group we run the real engine matcher (`screen.screen_name`, which applies
`ai.name_variants` + the core-token false-positive guard) and compute:
- **per-group recall** — fraction of true equivalents matched, and
- the **fairness gap** = max-group recall − min-group recall.

## Pass criteria (CI-enforced — the build fails otherwise)
- every group recall ≥ **90%** (`BIAS_MIN_GROUP_RECALL` — raised from 70% on
  28 Jul 2026 with the accuracy-hardening programme: shared transliteration
  groups, 10 → 89, plus the phonetic fold layer)
- fairness gap ≤ **10%** (`BIAS_MAX_RECALL_GAP` — tightened from 30%)
- **zero** false positives on the non-equivalence set (now including
  phonetic-adjacent distinct persons: ali hassan/ali hussein,
  hana qassem/hani qasemi)

## Result (current)
Six groups — Latin / Arabic / Turkish / Cyrillic / CJK / **Phonetic**
(multi-edit romanization drift, the class that cleared by design before the
phonetic fold) — all at **100% recall under both the rapidfuzz and the offline
difflib backends**, fairness gap **0%**, zero false positives. The equivalence
set was expanded alongside the hardening (khaled/khalid-class groups,
Ukrainian/Russian cross-forms, -off/-ov drift, Muhamet Huseinn-class phonetic
pairs); the full labelled corpus behind these floors lives in
`test/fixtures/screening-benchmark/` (see
`docs/governance/screening-accuracy-benchmark.md`).

## Limitations & forward work
- The labelled set is small and hand-curated; it is a regression guard, not a
  population-level audit. Expand it from real MLRO dispositions over time.
- Recall is measured against spelling variation, not against full identity
  (DOB/nationality) — that corroboration is the R.10 work (see
  `in-domain-aml-coverage.md`).
- Add Cyrillic / CJK groups if the book of business expands to those scripts.

## Evidence
- Harness: `test/bias_eval.py` · CI step: "Run formal bias / fairness evaluation".
- Inline regression checks also live in `test/engine_test.py`.
