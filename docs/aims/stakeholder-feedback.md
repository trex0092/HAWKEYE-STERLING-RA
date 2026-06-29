# Stakeholder Feedback Log (AIMS A.9)

Feedback from users/stakeholders on the AI system (MLRO, analysts, auditors,
regulators), how it was triaged, and the action taken. Owner: MLRO.

## Channels
- MLRO review notes on alerts (Asana task comments / disposition checkboxes).
- Internal compliance feedback.
- Audit findings (internal four-eyes; external where applicable).
- This log (manual entries) + GitHub issues for system defects.

## Triage process
1. **Capture** — log every item below as received (date, source, verbatim feedback).
2. **Classify** — usability / accuracy / risk / privacy; set a severity (low / medium / high).
3. **Route** — accuracy/risk/privacy items that affect screening become a corrective action
   ([`corrective-actions.md`](corrective-actions.md)); a defect that could cause a missed
   screening is escalated as an incident ([`../governance/ai-incident-runbook.md`](../governance/ai-incident-runbook.md)).
4. **Act & close** — record the action and move Status to Done; carry open items to the
   management review ([`management-review.md`](management-review.md)).

Target: high-severity items triaged within 2 business days; all items reviewed at each
management review.

## Log
| Date | Source | Feedback | Type (usability / accuracy / risk / privacy) | Action | Status |
|---|---|---|---|---|---|
| 2026-06-28 | Compliance (owner) | Report layout reorganised to lead with Sanctions → Adverse → PEP | usability | Implemented (narrative restructure) | Done |
| 2026-06-28 | Compliance (owner) | No hallucinations / no fabricated data permitted in reports | risk | Hard rule: reports deterministic-only; LLM grounded-classification only | Done |
| 2026-06-28 | Compliance (owner) | Adverse media must include source links; entities & individuals | accuracy | Mandatory article links; UBO + entity coverage | Done |
| | | | | | |

> Append new feedback as received; link to the corrective action where applicable.
