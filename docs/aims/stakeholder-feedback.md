# Stakeholder Feedback Log (AIMS A.9)

Feedback from users/stakeholders on the AI system (MLRO, analysts, auditors,
regulators), how it was triaged, and the action taken. Owner: MLRO.

## Channels
- MLRO review notes on alerts (Asana task comments / disposition checkboxes).
- Internal compliance feedback.
- Audit findings (internal four-eyes; external where applicable).
- This log (manual entries) + GitHub issues for system defects.

## Log
| Date | Source | Feedback | Type (usability / accuracy / risk / privacy) | Action | Status |
|---|---|---|---|---|---|
| 2026-06-28 | Compliance (owner) | Report layout reorganised to lead with Sanctions → Adverse → PEP | usability | Implemented (narrative restructure) | Done |
| 2026-06-28 | Compliance (owner) | No hallucinations / no fabricated data permitted in reports | risk | Hard rule: reports deterministic-only; LLM grounded-classification only | Done |
| 2026-06-28 | Compliance (owner) | Adverse media must include source links; entities & individuals | accuracy | Mandatory article links; UBO + entity coverage | Done |
| | | | | | |

> Append new feedback as received; link to the corrective action where applicable.
