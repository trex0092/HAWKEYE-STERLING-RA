# ADR-001 — Deterministic Core, No Learned Models (Yet)

**Status:** Accepted 2026-07-24 · **Owner:** MLRO / Compliance Engineering ·
**Revisit:** quarterly with the methodology cycle, or on any revisit trigger in §4.

Every operative model in this estate is deterministic (rules, fuzzy matching,
keyword typology); LLMs are confined to gated decision *support*. That is a
design decision with real costs. This record states why it holds, what would
change it, and the governed path to a first learned model — so "predictive ML"
claims about this estate are honest: the *framework* exists
([MRM](model-risk-management-2026.md), [backtesting](backtesting-protocol-2026.md),
[champion/challenger](champion-challenger-thresholds.md)); a *trained model in
production* does not.

## 1. Context

- Operative outputs carry regulatory consequence (TFS, CDD bands, STR
  triggers): they must be **explainable per-factor** to an examiner and
  reproducible offline (FATF R.1/R.11; the validation pack's classification
  section).
- **No training data of usable scale existed at build time**: the labelled
  history a learned screener needs (dispositions) is only now accumulating
  (18 cases, 0 disposed as of 2026-07-24).
- A deterministic core is immune to drift and prompt injection *by
  construction*, which is itself a control the validation pack relies on.

## 2. Decision

Keep the operative path deterministic. Use LLMs only where a wrong answer is
recoverable by design (triage ranking with deterministic fallback; advisory
text under HITL). Do not train models on synthetic or borrowed labels to
appear "ML-driven" — a fabricated training set would be worse evidence than an
honest rule set.

## 3. Consequences

**Gained:** full explainability; CI-provable behaviour (frozen golden sets);
no silent drift; no training-data governance surface to defend yet.
**Paid:** recall is bounded by curated keywords/variants (a learned ranker
could catch phrasings the 129-term list misses); the keyword and variant sets
carry a permanent maintenance burden; "predictive" validity currently rests on
design argument, not measured outcomes (until the backtesting ledger fills).

## 4. Revisit triggers

Any of: (a) the backtesting ledger shows sustained alert precision < 5% or a
recall miss a learned ranker would plausibly have caught; (b) ≥ 500 disposed,
labelled cases accumulate; (c) the firm adopts a commercial screening engine
(the matcher retires instead — see its card); (d) a supervisory expectation of
statistical screening emerges.

## 5. The governed path to the first learned model

Candidate: an **adverse-media relevance ranker** (Tier 2) — it sits above the
deterministic classifier as a re-ranker, so a wrong score degrades ordering,
never coverage; the deterministic path remains the floor.

| Stage | Requirement before advancing |
|---|---|
| Dataset | Labels from MLRO dispositions in the evidence log (`data/adverse-media-evidence.json`, 400-day retention) + case clearances; **never** model-provider API data (DPA); PII-minimised; stored on an encrypted state branch |
| Dataset governance | Versioned snapshots; frozen train/val/test split **registered before training**; class-balance and script-balance (Latin/Arabic/Cyrillic) audits recorded in the [data-quality plan](../aims/data-quality-plan.md) |
| Evaluation | Beats the deterministic baseline on the frozen test set **including** the per-script recall-parity bound from `test/bias_eval.py`; results logged in the [eval scorecard](eval-scorecard.md) |
| Shadow | ≥ 1 quarter in shadow per the [champion/challenger protocol](champion-challenger-thresholds.md) |
| Governance | Tier-2 obligations under the [MRM framework](model-risk-management-2026.md) §2 (card, validation, monitoring, PSI); promotion signed via [model-validation §4](model-validation-2026.md) change control; committee/board visibility per the charter |

Until every row is satisfiable, the answer to "why no ML?" is this document.
