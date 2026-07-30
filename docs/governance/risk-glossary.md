# Risk Glossary — the terms this repository uses, in business language

**Owner:** MLRO (accountable) · Compliance Engineering (operational)
**Review cadence:** annually, and whenever a term below changes meaning in the estate.
**Last reviewed:** 2026-07-29

This pack is written in fluent GRC dialect and had no translation layer. Seventeen
of the terms below appeared **nowhere** in `docs/` before this page existed —
including *risk capacity*, *target residual*, *control owner*, *control weakness*
and *loss event* — while *issue* and *incident* appeared in forty-odd documents
each and were never once defined or distinguished.

Each entry gives the plain-language reading first, then points at where the
repository already applies it. **The linked source is authoritative** — this page
translates, it does not redefine. Where a term is genuinely not used here yet,
the row says so rather than implying a control that does not exist.

> **One term already means something else here — read this before using it.**
> **Near miss** in this repository does *not* carry its risk-management sense.
> All four existing uses are the *matcher-score* sense: how close a screening
> score sat to the 0.85 decision threshold
> ([`champion-challenger-thresholds.md`](champion-challenger-thresholds.md),
> [`backtesting-protocol-2026.md`](backtesting-protocol-2026.md)). If you mean
> "a failure that almost happened", say so in words. Do not reuse the phrase.

---

## 1. The four levels of risk-taking

These four are routinely used interchangeably and are not the same thing. The
difference is *who sets them* and *what happens when you cross one*.

| Term | In business language | Where it lives here |
|---|---|---|
| **Risk appetite** | The level of risk leadership is prepared to accept, as a direction of travel. A statement of intent, set by the Board. | [`risk-appetite-statement-2026.md`](risk-appetite-statement-2026.md) — eight positions, RA-01…RA-08, each `ZERO` / `LOW` / `MEASURED` / `BANDED`. Machine-readable in [`../../data/risk-appetite.json`](../../data/risk-appetite.json). |
| **Risk tolerance** | The measurable limit before escalation is required. Appetite says "we are cautious"; tolerance says "at 95% we escalate". | The nine KRIs in the same statement, §4. Each carries a numeric threshold the estate computes. |
| **Risk capacity** | The maximum the organisation could absorb before it fails — a hard ceiling, not a preference. Capacity is a fact; appetite is a choice made inside it. | **Not yet stated.** No capacity position exists in the appetite statement. Recorded here as a gap, not implied as a control. |
| **Target residual risk** | The residual level you are *aiming* for after treatment — distinct from the residual you have today. | **Not yet stated per risk.** [`../aims/ai-risk-register.md`](../aims/ai-risk-register.md) records inherent and current residual; there is no target column. |

**Why the distinction bites.** [`../policies/risk-assessment-methodology.md`](../policies/risk-assessment-methodology.md)
§3 requires that *"residual risk is compared against the appetite… anything above
appetite requires a treatment plan with an owner and a date"*, and
[`../aims/ai-risk-register.md`](../aims/ai-risk-register.md) lists
*"residual scores sit within appetite"* among its auditor checkpoints. Neither is
currently testable, because no appetite position states a numeric residual
ceiling. That is a live gap, not a subtlety.

---

## 2. Risk levels

| Term | In business language | Where it lives here |
|---|---|---|
| **Inherent risk** | The starting level, before any control is considered. | [`../policies/risk-assessment-methodology.md`](../policies/risk-assessment-methodology.md) §3 — likelihood × impact on a 5×5 matrix, score 1–25. Bands: **Low 1–6 · Medium 7–12 · High 13–25**. |
| **Residual risk** | What is left after the controls are applied and rated. | Same §3, and the `Residual` column of [`../aims/ai-risk-register.md`](../aims/ai-risk-register.md). *"Inherent = before controls; Residual = with the controls in the row operating."* |
| **Likelihood / Impact** | How probable, and how badly it would hurt. | §3: Likelihood 1 Rare → 5 Almost certain; Impact 1 Negligible → 5 Severe (regulatory / enforcement consequence). |
| **Risk band** | The traffic light a score lands in. | Low 🟢 1–6 · Medium 🟡 7–12 · High 🔴 13–25. Note this is the *risk* scale — the **customer** scale is different: a 0–30 score banded CDD / SDD / EDD, defined in [`risk-appetite-statement-2026.md`](risk-appetite-statement-2026.md) §2 and enforced in `app.js`. Two scales, two meanings; do not mix them. |

---

## 3. Who is accountable

| Term | In business language | Where it lives here |
|---|---|---|
| **Risk owner** | The accountable person for monitoring the risk and responding when it moves. Owns the *outcome*. | The `owner` in the `Treatment · owner · review` column of [`../aims/ai-risk-register.md`](../aims/ai-risk-register.md) — MLRO, Eng, Compliance or firm. |
| **Control owner** | The person responsible for operating the control day to day. Owns the *activity*. | **Not separately recorded.** The estate names risk owners and document owners; control ownership is implied by the assurance matrix but never stated per control. A gap worth closing — the two roles diverge the moment a control is operated by someone who does not carry the risk. |
| **Approver** | Who is entitled to put an instrument into force. Distinct from the owner who maintains it. | `approver` in [`../../data/policies.json`](../../data/policies.json); CI requires every registered instrument to declare both. |

---

## 4. When a control does not work

The distinction here is between a control that **broke** and one that was
**never strong enough** — different fixes, different escalation.

| Term | In business language | Where it lives here |
|---|---|---|
| **Control failure** | The safeguard did not work as intended on a specific occasion. | Used in this sense across the assurance and CAPA material. The estate's design principle is that a control which cannot run must *degrade loudly* rather than pass — a silent pass is treated as a failure, not an absence. |
| **Control weakness** | The safeguard exists but is not reliable enough — it would not be trusted to catch the thing it is for. | Expressed in this pack as a **control-effectiveness rating**: `Strong / Adequate / Weak / Absent` in [`../policies/risk-assessment-methodology.md`](../policies/risk-assessment-methodology.md) §3. *"A control with no evidence is rated Absent, not Adequate."* "Weak" is the weakness rating. |
| **Control test** | Evidence that the control actually works, gathered deliberately. | [`assurance-coverage-matrix.md`](assurance-coverage-matrix.md) — control → automated proof → frequency → evidence. Manual-cadence controls are listed separately in §4 rather than being claimed as automated. |

---

## 5. When something goes wrong

Four words for four different things. The estate currently uses two of them
loosely and has no severity taxonomy at all.

| Term | In business language | Where it lives here |
|---|---|---|
| **Issue** | A confirmed gap that needs action and an owner. Nothing has gone wrong *yet* — the exposure is the problem. | Used throughout, undefined. The closest operational form is a row in the [open actions register](open-actions-register.md) or a CAPA row in [`../aims/corrective-actions.md`](../aims/corrective-actions.md). |
| **Incident** | Operations, data or service have **already** been affected. | [`ai-incident-runbook.md`](ai-incident-runbook.md) lists the triggers (an eval FAIL, a tipping-off escape, a fabricated result reaching a user, a prompt-injection that bypassed the charter, a suspected key exposure) and the response steps. It references "P1/P2" **without defining either** — there is no severity scale in this estate. |
| **Near miss** | A failure that almost happened and was caught in time. | **Not used in this sense — see the warning at the top of this page.** The existing uses are matcher-score margins. |
| **Loss event** | The organisation experienced measurable harm — money, licence, data, or regulatory sanction. | **Not used.** No loss-event log exists. Recorded as a gap. |

---

## 6. Measuring

| Term | In business language | Where it lives here |
|---|---|---|
| **KRI — key risk indicator** | An early warning that shows movement *toward* a concern. Leading, and about uncertainty. | Nine KRIs in [`risk-appetite-statement-2026.md`](risk-appetite-statement-2026.md) §4, computed into [`../../data/grc-metrics.json`](../../data/grc-metrics.json) by `scripts/grc-metrics.mjs`. Eight are instrumented; KRI-09 is deliberately carried as *not instrumented* with its reason, rather than being deleted or scored as passing. |
| **Performance indicator (KPI)** | Measures how well something is *performing*. It is not a measure of uncertainty. | The KPI catalogue in [`assurance-coverage-matrix.md`](assurance-coverage-matrix.md) §3, and [`../executive/kpi-dashboard.md`](../executive/kpi-dashboard.md). |
| **The difference** | A KRI tells you a risk is *building*; a KPI tells you a process is *working*. A rising KRI with healthy KPIs is the normal shape of an emerging problem. | Both catalogues exist here and live in different files; nothing previously said which was which. |
| **Breach** | A KRI has crossed its threshold. | `breached: true` in [`../../data/grc-metrics.json`](../../data/grc-metrics.json). Currently one: **KRI-04**, vendor assessment coverage. |

---

## 7. Regulatory and compliance

| Term | In business language | Where it lives here |
|---|---|---|
| **Regulatory obligation** | A rule that must be met, and evidenced. | The 21 rows of [`obligation-register.md`](obligation-register.md) / [`../../data/obligations.json`](../../data/obligations.json), each naming its instrument, controls, evidence and change-detection source. |
| **Compliance gap** | Required practice and actual practice differ. | Expressed as obligation **status**, defined in [`obligation-register.md`](obligation-register.md) §3: `met` (built, operating, evidenced) · `partial` (built and evidenced, a *human act* outstanding) · `pending` (firm-side, the repository cannot discharge it) · `monitored` (not currently applicable; watched so a change is detected rather than assumed). |
| **Third-party reliance** | A provider relationship may affect delivery or compliance. | [`../aims/third-party-register.md`](../aims/third-party-register.md), measured as `thirdPartyAssessmentCoverage`. |
| **Regulatory change** | The rules moved. | The watch sources in [`../../data/reg-sources.json`](../../data/reg-sources.json), and [`../policies/regulatory-change-management-procedure.md`](../policies/regulatory-change-management-procedure.md). Every obligation names the source that would detect a change to it. |

---

## 8. Risk types named in the wider lens

These are the categories a board-level risk taxonomy usually carries. Most are
**not** used as named risk types in this repository — it scopes itself to the AI
and AML/CFT estate. They are listed so the vocabulary is complete and so the
absence is visible rather than assumed.

| Term | In business language | Status here |
|---|---|---|
| **Model risk** | A model may be wrong, or used for something it was not built for. | **Used.** [`model-risk-management-2026.md`](model-risk-management-2026.md), [`model-validation-2026.md`](model-validation-2026.md), and the model cards in [`../models/`](../models/README.md). |
| **AI governance risk** | AI use lacks ownership, oversight or monitoring. | **Used, under other names** — the AI risk register R-01…R-20 and the AI asset register. Not labelled as a single risk type. |
| **Data quality risk** | Bad data distorts decisions or reporting. | **Used, unnamed.** [`../aims/data-quality-plan.md`](../aims/data-quality-plan.md) exists; the phrase does not. |
| **Privacy risk** | Personal-data handling may create harm. | **Used, unnamed.** [`dpia-2026.md`](dpia-2026.md) and [`../aims/pdpl-data-processing-assessment.md`](../aims/pdpl-data-processing-assessment.md). |
| **Resilience risk** | Recovery may not meet business expectations. | **Partly.** [`../aims/bcp.md`](../aims/bcp.md) and [`backup-recovery.md`](backup-recovery.md) exist; no stated RTO/RPO. |
| **Attack path** | A route exists for an attacker to reach assets. | **Used, unnamed.** The trust-boundary and STRIDE analysis in [`../architecture.md`](../architecture.md). |
| **Conduct risk** | Behaviour may damage customers or trust. | **Not a named risk type.** Governed instead by [`../policies/conflict-of-interest-policy.md`](../policies/conflict-of-interest-policy.md) and the code of conduct. |
| **Transition risk** | Policy or market shifts may affect value. | **Not used.** Out of scope for this estate. |
| **Geopolitical risk** | Trade or instability may disrupt plans. | **Not used as a risk type**, though jurisdiction risk is scored per customer in [`../../data/jurisdiction-risk.json`](../../data/jurisdiction-risk.json). |
| **Systemic risk** | A failure could cascade beyond one function. | **Not used.** Recorded as a gap: the estate has no control-to-control dependency view, so cascade is not currently analysable. |

---

## 9. Treatment

From [`../aims/ai-risk-register.md`](../aims/ai-risk-register.md) §Treatment options — the four
things you may do with a risk once it is scored.

| Term | In business language |
|---|---|
| **Accept** | Residual sits within appetite. Keep monitoring at the row's cadence; do nothing else. |
| **Mitigate** | Reduce the likelihood or the impact. Every open mitigation carries an owner and a target date in the [CAPA log](../aims/corrective-actions.md) or the [open actions register](open-actions-register.md). |
| **Transfer** | Share the risk contractually — a DPA, vendor terms. |
| **Avoid** | Stop doing the thing. The no-egress default *avoids* the data-egress risk entirely unless a key is deliberately provisioned. |

---

## How to use this page

- **Writing a new governance document?** Use these words with these meanings. If
  you need a term that is not here, add it here first.
- **Reading a register?** The status vocabularies are authoritative in their own
  files — [`obligation-register.md`](obligation-register.md) §3 for obligations,
  [`../../data/policies.json`](../../data/policies.json) `status_meanings` for
  instruments. This page points at them; it does not restate them, so they
  cannot drift apart.
- **Found a gap row above?** That is deliberate. A glossary that quietly implies
  a control the estate does not have is worse than no glossary. The gaps —
  risk capacity, target residual, control owner, loss event, a severity scale —
  are real, and are the honest answer to "do you govern this?".
