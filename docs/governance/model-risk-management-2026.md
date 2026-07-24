# Model Risk Management Framework (2026)

One framework over every scoring, matching and generative surface in the estate
— what counts as a model here, how models are tiered by materiality, what each
tier owes in validation and monitoring, and how this maps to **CBUAE Model
Management Standards & Guidance (Nov 2022)** and the Federal Reserve's
**SR 11-7** — mapped honestly onto what exists, never silently implied.
**Owner: MLRO / Compliance Engineering · reviewed with the quarterly
methodology cycle.**

> Scope honesty: the firm is a **DPMS**, not a CBUAE-licensed financial
> institution — the MMS does not bind it. It is adopted **voluntarily** as the
> reference bar for model discipline, both because the UAE supervisory
> direction of travel is visible and because the estate's patterns are built to
> port to regulated financial-sector deployments. Verify clause-level wording
> against the current CBUAE rulebook before citing this map externally.

## 1. What is a "model" here

Following SR 11-7's definition (a quantitative method applying statistical,
economic or mathematical techniques to process inputs into estimates), the
estate treats **every card in [`../models/`](../models/README.md) as a model**,
including deterministic ones: a rules engine with firm-approved weights carries
model risk (mis-specification, stale baselines, misuse) even without training
data. Generative components are models with additional failure modes, not
exceptions.

## 2. Model inventory & tiering

Tier = materiality of a wrong output × autonomy of the component. The
inventory of record is [`../models/README.md`](../models/README.md) +
[`ai-asset-register.md`](ai-asset-register.md); this table assigns the tier.

| Model (card) | Type | Wrong-output consequence | Tier |
|---|---|---|---|
| [Sanctions name matcher](../models/sanctions-name-matcher.md) | Deterministic fuzzy matcher | Missed designation → TFS breach (critical) | **1** |
| [Entity risk-scoring engine](../models/risk-scoring-engine.md) | Deterministic rules | Wrong diligence band → CDD failure | **1** |
| [Adverse-media classifier](../models/adverse-media-classifier.md) | Deterministic keyword/typology | Missed adverse story → EDD gap | **2** |
| [PEP identifier](../models/pep-identifier.md) | Deterministic lookups | Missed PEP → R.12 floor not applied | **2** |
| [AI triage](../models/ai-triage.md) | LLM (gated, deterministic fallback) | Mis-ranked relevance (human still reviews) | **2** |
| [Advisor LLM](../models/advisor-llm.md) | LLM (decision support only) | Bad advice surfaced (never operative) | **3** |

Tier obligations:

| Obligation | Tier 1 | Tier 2 | Tier 3 |
|---|---|---|---|
| Model card + owner | ✅ required | ✅ required | ✅ required |
| Validation pack + frozen golden set | ✅ ([model-validation-2026.md](model-validation-2026.md)) | golden/regression tests in CI | behavioural eval |
| Change control via CODEOWNERS + sign-off | ✅ | ✅ | ✅ |
| Outcomes analysis (backtesting) | ✅ per [backtesting protocol](backtesting-protocol-2026.md) | annually or on methodology change | n/a (advice only) |
| Ongoing monitoring | runtime + [population stability](../aims/population-stability-monitoring.md) | runtime monitoring | [eval scorecard](eval-scorecard.md) |
| Independent review | Internal-audit thematic review (open-actions item 8) | same cycle, sampled | same cycle, sampled |
| Fairness testing | cross-script recall parity (CI) | language-coverage review | quarterly bias eval |

## 3. CBUAE MMS pillars, against this estate

Status: ✅ addressed · 🟡 partial · ⚪ conditional on deployment context.

| MMS pillar | Expectation (summary) | This estate | Status |
|---|---|---|---|
| Model governance & oversight | Board-approved framework, defined accountability | This framework + [AI policy](ai-policy.md) + [committee charter](ai-governance-committee-charter.md); board ratification pending the sitting (open-actions item 4) | 🟡 |
| Model inventory | Complete, current inventory with tiers | Model cards + asset register + §2 tiering | ✅ |
| Materiality tiering | Risk-proportionate obligations | §2 (consequence × autonomy) | ✅ |
| Development standards | Documented methodology, data quality, assumptions | Model cards + [model-validation pack §2](model-validation-2026.md) + [data-quality plan](../aims/data-quality-plan.md) | ✅ |
| Independent validation | Validation independent of development | Golden sets are CI-frozen (cannot drift silently), but build and validation sit with the same maintainer today — routed to the Internal Audit thematic review (open-actions item 8); see the independence statement in [model-validation-2026.md §3](model-validation-2026.md) | 🟡 |
| Implementation & use | Controlled deployment, use-as-approved | CI gates, branch protection, release provenance, HITL on every operative decision | ✅ |
| Ongoing monitoring | Performance, stability, drift | [Runtime monitoring](../aims/runtime-monitoring.md) (operational) + [PSI spec](../aims/population-stability-monitoring.md) (population) + [eval scorecard](eval-scorecard.md) (quality over time) | ✅ |
| Outcomes analysis | Backtesting against realized outcomes | [Backtesting protocol](backtesting-protocol-2026.md); first cycle blocked on accumulated dispositions (register item 14) | 🟡 |
| Documentation & records | Sufficient for a qualified third party to reproduce | Cards, packs, CHANGELOG, git history (FATF R.11) | ✅ |

## 4. SR 11-7 crosswalk

| SR 11-7 element | Where it lives here |
|---|---|
| Robust development, implementation, use | Model cards, change control ([model-validation §4](model-validation-2026.md)), CI gates, AUP |
| Effective challenge | [Champion/challenger protocol](champion-challenger-thresholds.md), red-team corpus, internal-audit review, adversarially-verified deep audits (e.g. PR #312) |
| Validation: conceptual soundness | Methodology sections of the validation pack; FATF/OECD grounding of factors |
| Validation: ongoing monitoring | Runtime monitoring + PSI + eval scorecard |
| Validation: outcomes analysis | Backtesting protocol + ledger |
| Governance, policies, inventory | AI policy, this framework, asset register, quarterly MLRO sign-off |

## 5. Review

This framework is reviewed quarterly with the methodology cycle and after any
model addition, retirement, or tier change. Tier changes and pillar-status
changes are recorded in the sign-off log of the validation pack; residue is
routed through the [open-actions register](open-actions-register.md).
