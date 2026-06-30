# Stakeholder Impact Assessment (SIA) — 2026

A stakeholder-centred impact assessment for the AI surfaces, following the Alan
Turing Institute's Process-Based Governance approach. It complements the
data-protection view in [`dpia-2026.md`](dpia-2026.md) and the system view in
[`../aims/ai-impact-assessment.md`](../aims/ai-impact-assessment.md) by asking,
per stakeholder: *who is affected, how could an AI error harm them, and what
mitigates it?*

**Owner:** MLRO · Compliance Engineering · **Date:** 2026-06-30 ·
**Review:** annually and on any change to an AI model, scope, or data flow.

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

## Residual risk & monitoring
Highest residual risk is **automation bias** (a human deferring to an AI signal)
and **bias-evidence maturity** (recall-parity history accrues over cycles). Both
are monitored via the weekly advisor eval, the bias eval, and the quarterly
management review ([`../aims/management-review.md`](../aims/management-review.md));
corrective actions are logged in [`../aims/corrective-actions.md`](../aims/corrective-actions.md).

## Sign-off
| Version | Date | Author | Approver (MLRO / senior mgmt) | Status |
|---|---|---|---|---|
| 1.0 | 2026-06-30 | Compliance Engineering | _pending_ | Draft — awaiting ratification |
