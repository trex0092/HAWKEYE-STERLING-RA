# Regulatory Readiness Pack

*The pre-examination reference: regulator/auditor question → artefact → location.
Date: 2 Jul 2026.*

## Framework coverage at a glance

| Framework | Position | Primary evidence |
|---|---|---|
| **ISO/IEC 42001** (AIMS) | Substantially implemented; awaiting first management review + two ratifications | `docs/governance/iso-42001-soa-2026.md`, `docs/aims/` |
| **NIST AI RMF** | Mapped; MEASURE/MANAGE evidenced daily | `docs/governance/nist-ai-rmf-mapping-2026.md`, AI Governance Report |
| **EU AI Act** | Outside territorial scope today (no EU establishment/market offering); design aligns with high-risk obligations should scope change | §"EU AI Act positioning" below |
| **OECD AI Principles** | Absorbed via crosswalk | `docs/governance/ai-frameworks-crosswalk-2026.md` |
| **COSO / ISO 31000** | Controls in place; explicit component/step mapping in progress | crosswalk + Assurance Coverage Matrix |
| **FATF RBA (R.6/10/12/16/25)** | Implemented (R.16 engine built, inactive pending feed) | `screen.py`, model cards, risk register |
| **Wolfsberg guidance** | Reflected in screening/EDD approach | screening design, model cards |
| **GDPR / UAE PDPL** | Assessed; data-minimisation by design | `docs/aims/pdpl-data-processing-assessment.md`, `docs/governance/dpia-2026.md` |

## Regulator question → artefact map

| "Show me…" | Artefact | Location |
|---|---|---|
| your AI governance framework | AI Governance + 6-layer model | `docs/AI-GOVERNANCE.md`, `docs/governance/agentic-ai-governance-6layers-2026.md` |
| your AI/model inventory | System inventory + asset register | `docs/aims/ai-system-inventory.md`, `docs/governance/ai-asset-register.md` |
| documentation for each AI feature | **Model cards (6)** | [`../models/`](../models/README.md) |
| your AI risk register | Risk register (R-01…R-13) | `docs/aims/ai-risk-register.md` |
| how you test for bias | Cross-script recall parity test (CI) | `docs/aims/bias-fairness-testing.md` |
| how you handle prompt injection | Red-team procedure + CI battery | `docs/aims/red-team-procedure.md` |
| your data-protection assessment | DPIA + PDPL assessment | `docs/governance/dpia-2026.md`, `docs/aims/pdpl-data-processing-assessment.md` |
| your control-to-evidence mapping | Assurance Coverage Matrix | `docs/governance/assurance-coverage-matrix.md` |
| your incident process | AI incident runbook + postmortem template | `docs/governance/ai-incident-runbook.md` |
| vendor/third-party risk | Third-party register | `docs/aims/third-party-register.md` |
| explainability | Explainability statement + per-factor breakdowns | `docs/governance/explainability-statement-2026.md` |
| human oversight | Policy §human-in-loop + SIA + model cards | `docs/governance/ai-policy.md`, model cards |

## EU AI Act positioning (half-page statement)
The firm operates as a UAE DPMS with no establishment in, or offering to, the EU
Union market; the platform is therefore **outside the territorial scope** of the
EU AI Act today. Should that change, the platform's existing posture —
human-in-the-loop, comprehensive logging (hash-chained), transparency/`[AI]`
labelling, documented risk management, and validation — aligns with the Annex III
high-risk obligations. The residual delta to conformity would be: a formal
conformity-assessment procedure, EU database registration, and CE-style
declaration. This statement should be dated and re-confirmed at each management
review.

## Open items to disclose proactively (never discovered mid-exam)
- Anthropic **DPA pending** — AI features gated OFF until executed.
- **Transaction-monitoring engine built but inactive** (R-13) pending a data feed.
- First **ISO 42001 management review** scheduled (Q3 2026); AI Policy + SIA
  awaiting ratification.
- Accepted architectural gap: Netlify Identity on write endpoints (compensating
  controls documented).

*Honest disclosure of these — each with an owner, date and compensating control —
is itself evidence of a functioning governance process.*
