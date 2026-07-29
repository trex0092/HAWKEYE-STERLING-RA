# Stakeholder Impact Assessment (SIA) — 2026

**The canonical ISO/IEC 42001 clause 6.1.4 artefact** — the assessment of
potential consequences **for individuals and groups of individuals**, as
distinct from clause 6.1.2, which assesses risk **to the organisation**.

A stakeholder-centred impact assessment for the AI surfaces, following the Alan
Turing Institute's Process-Based Governance approach. It complements the
data-protection view in [`dpia-2026.md`](dpia-2026.md) and the system view in
[`../aims/ai-impact-assessment.md`](../aims/ai-impact-assessment.md) by asking,
per stakeholder: *who is affected, how could an AI error harm them, and what
mitigates it?*

**Owner:** MLRO · Compliance Engineering
**Approver:** MLRO
**Version:** 1.1 (v1.0 ratified 2026-07-02; v1.1 **pending approval**) ·
**Date:** 2026-07-29
**Review:** annually and on any change to an AI model, scope, or data flow.
**Clause mapping:** [`../aims/iso-42001-clause-6-1-mapping.md`](../aims/iso-42001-clause-6-1-mapping.md)

> **Why 6.1.2 and 6.1.4 are separate, and why one cannot stand in for the
> other.** Clause 6.1.2 asks *what could go wrong for the organisation* —
> regulatory exposure, licence, reputation, cost. Clause 6.1.4 asks *what could
> go wrong for the people the system acts on*. The two share failure modes and
> almost nothing else: a false negative is a regulatory breach under 6.1.2 and,
> under 6.1.4, is barely a harm to the screened person at all, while a false
> positive is a minor operational nuisance under 6.1.2 and, under 6.1.4, is the
> single most damaging thing this system can do to someone — de-risking,
> refused service, a record they cannot see or contest. A control set tuned only
> on the 6.1.2 reading of those two rows would be tuned in the wrong direction.
> The [AI Risk Register](../aims/ai-risk-register.md) is the 6.1.2 artefact;
> this document is the 6.1.4 one; neither substitutes for the other.

> **v1.1 revision note.** v1.0 was ratified 2026-07-02 with signature evidence
> and **remains in force**; its assessed content is unchanged. v1.1 adds the
> 6.1.4 designation, the explicit unfair-and-discriminatory-outcome section
> (§ *Unfair and discriminatory outcomes*) and the availability clause
> (§ *Availability of this assessment*). Those additions are **not yet
> approved** — re-approval is [open-actions](open-actions-register.md) item 19.
> Until then the v1.0 ratification stands and the new sections are stated as
> assessed-but-unratified, not backdated into a signature that did not cover
> them.

## Scope
The **AI surfaces**: the MLRO Advisor (`brain-soul.js` → Claude) and the optional
LLM adverse-media triage. The deterministic RA engine, console, and watchers are
rules-based automations, assessed here only where their output feeds a person.

## Stakeholders, harms, mitigations

| Stakeholder | How AI affects them | Potential harm (if AI errs) | Mitigation in place |
|---|---|---|---|
| **The screened customer / UBO** | Adverse-media / PEP / sanctions signals and a risk band inform onboarding & EDD | False positive → unwarranted friction / de-risking; false negative → undetected risk | Human (MLRO) decides every case; AI is decision-support; non-Latin/unscreenable → MANUAL REVIEW; one-way override never weakens PROHIBITED; right to human review |
| **The analyst / MLRO** | Relies on advisor drafts & screening signals | Over-reliance / automation bias; misleading draft | `[AI]` labelling + "decision support, not a decision" audit line; cited sources; deterministic fallback; AUP acknowledgment |
| **The firm / licence holder** | Regulatory exposure if controls fail | Mis-screening → regulatory breach; tipping-off | Tipping-off guard; hash-chained audit trail; degrade-loudly alerting; 10-yr retention; model validation |
| **The regulator / FIU** | Receives STRs & relies on the firm's controls | Late/poor escalation | Hard-outcome floors (PROHIBITED / mandatory EDD); MLRO four-eyes; incident runbook |
| **Data subjects generally (privacy)** | Personal data processed for screening | Excess data to a third-party model; exposure | Data-minimised egress (name + one headline, never the record); key-off ⇒ no egress; PDPL assessment; encryption at rest |
| **Vulnerable / protected groups** | Cross-script names, nationality, gender in records | Biased differential treatment | Cross-script recall-parity bias eval; nationality/gender divergence tests; manual review for unscreenable names |
| **The public / society** | Trust in AML controls | Opaque or unfair automated decisions | Transparency notice; explainability ([`explainability-statement-2026.md`](explainability-statement-2026.md)); voluntary alignment to UAE AI Charter + Turing FAST/SUM ([`ai-frameworks-crosswalk-2026.md`](ai-frameworks-crosswalk-2026.md)) |

## Unfair and discriminatory outcomes

The stakeholder table above assesses harm **per stakeholder**. ISO/IEC 42001
6.1.4 also asks about outcomes that are **unfair or discriminatory**, and those
are not visible in a per-stakeholder view: they live in the *difference* between
how two populations are treated. Every row below is a comparison, not a count.

| Outcome | Who bears it | Why it could arise | Detection | Status |
|---|---|---|---|---|
| **Unequal screening effectiveness across scripts** — a true match missed more often for non-Latin names | Customers and UBOs with Arabic, Turkish, Cyrillic or CJK names | Normalisation and transliteration lose more information for non-Latin forms | Cross-script recall-parity test, **hard CI gate**: ≥90% recall per group, ≤10% inter-group gap (`test/bias_eval.py`, R-05) | Enforced on every build |
| **Unequal friction** — more false positives, and so more EDD, for holders of common or short names | Populations whose naming conventions produce shorter or higher-frequency name forms | Fuzzy matching returns more candidates for less distinctive strings | FP rate monitored per [`../aims/bias-fairness-testing.md`](../aims/bias-fairness-testing.md); core-token suppression; confidence tiers | Monitored; a divergence opens a CAPA |
| **Nationality- and jurisdiction-based differential treatment** | Customers connected to higher-risk jurisdictions | Jurisdiction risk is a **required** input under FATF R.10, so differential treatment here is lawful and intended — the risk is that it drifts from *risk-based* into *blanket* | The jurisdiction list is sourced and maintained (`data/jurisdiction-risk.json`), not ad hoc; nationality/gender divergence tests; no single factor forces an outcome alone | Reviewed at management review |
| **Exclusion by unprocessable name** — a name the engine cannot tokenise being treated as screened | Anyone whose name is in a lost script or made only of very short tokens | The matcher can produce no screenable token, and the tempting failure is to return "clear" | Routed to **MANUAL REVIEW**, never a silent clear; pinned by a dedicated test and by a cross-engine parity guard added 2026-07-29 | Enforced on every build |
| **Compounding** — the same population affected on every run, not once | Any group affected by a systematic weakness above | The engine is deterministic: a weakness does not average out over runs, it repeats exactly | Recall-parity history accrues per cycle; sustained anomalies auto-escalate to an issue | Bias-evidence maturity is a stated residual risk below |
| **Opacity of an adverse outcome** — being affected without being able to see or contest why | Screened customers and UBOs | The tipping-off prohibition (FDL 10/2025, Art. 25) forbids telling a person they were screened or reported | Cannot be mitigated by disclosure. Mitigated instead by: no automated decision, MLRO review of every case, raw evidence retained, and a general transparency notice that does not identify individuals | Accepted, with the legal basis recorded |

**The last row is a genuine and unresolvable tension**, and it is recorded as
such rather than mitigated on paper. Fair-treatment guidance and AML law point
in opposite directions here: one says tell the affected person, the other makes
telling them an offence. Where they conflict the statutory prohibition governs.
What the firm *can* do — and does — is ensure no adverse outcome is reached
automatically, that a human is accountable for each one, and that the evidence
behind it is retained for ten years so it can be examined by anyone with the
standing to demand it.

## Availability of this assessment

6.1.4 asks who this assessment is available to, not only that it exists.

- **Supervisors and examiners** — on request, in full, with the underlying
  evidence.
- **Internal Audit and the Board** — standing access; summarised at the
  quarterly management review.
- **Data subjects exercising PDPL rights** — on request, subject to the
  tipping-off prohibition and the AML retention exemptions. Whether an
  individual was screened, and any outcome, is **not** disclosable.
- **The public** — not published as a document. What is public-facing is the
  [transparency notice](../aims/interested-parties-information.md) and the
  [explainability statement](explainability-statement-2026.md), which state that
  AI assists, that a human decides, and that human review may be requested.
- **Staff** — via the AIMS document pack; awareness is part of the training
  record in [`../aims/competency-records.md`](../aims/competency-records.md).

## Residual risk & monitoring
Highest residual risk is **automation bias** (a human deferring to an AI signal)
and **bias-evidence maturity** (recall-parity history accrues over cycles). Both
are monitored via the weekly advisor eval, the bias eval, and the quarterly
management review ([`../aims/management-review.md`](../aims/management-review.md));
corrective actions are logged in [`../aims/corrective-actions.md`](../aims/corrective-actions.md).

## Sign-off
| Version | Date | Author | Approver (MLRO / senior mgmt) | Status |
|---|---|---|---|---|
| 1.0 | 2026-06-30 | Compliance Engineering | Luisa Fernanda (MLRO) | **Ratified 2026-07-02** |
| 1.1 | 2026-07-29 | Compliance Engineering | _(pending)_ | **Pending approval** — open-actions item 19 |

> Signature evidence: Ratified 2026-07-02 by Luisa Fernanda (MLRO / workspace owner) — evidence: Asana task 1216233454512937 in HAWKEYE STERLING APP (name entered by the workspace owner, 2026-07-02T10:44Z; workspace is single-owner access).
>
> **v1.1 carries no signature and claims none.** The v1.0 ratification covered
> the content assessed on 2026-06-30; it cannot retrospectively cover sections
> written a month later. v1.0 remains the approved version and stays in force
> while v1.1 awaits the MLRO's approval.
