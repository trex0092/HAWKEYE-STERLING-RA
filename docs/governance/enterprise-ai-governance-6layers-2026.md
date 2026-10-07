# Enterprise AI Governance — Six-Layer Crosswalk

**Owner:** MLRO (accountable) · Compliance Engineering (operational)  
**Control source of truth:** [`data/ai-controls.json`](../../data/ai-controls.json)  
**Status dashboard:** [`enterprise-ai-governance-dashboard.md`](enterprise-ai-governance-dashboard.md)  
**Diagram:** [`../executive/diagrams/d2-enterprise-ai-governance-layers.mmd`](../executive/diagrams/d2-enterprise-ai-governance-layers.mmd)  
**Review cadence:** Quarterly, and on any material AI asset, provider, model, prompt charter, connector, or data-flow change.

This document adds an **enterprise governance view** over the controls already present in Hawkeye Sterling. It does not replace the existing [six-layer agentic-AI scorecard](agentic-ai-governance-6layers-2026.md), the AIMS risk register, the third-party register, the assurance coverage matrix, or the AI asset register.

The taxonomy was inspired by a six-layer enterprise AI governance practitioner graphic supplied during design review. The wording, control structure, evidence mapping and diagram in this repository are original. The third-party artwork is not stored in the repository.

## How this view differs from the existing six-layer scorecard

The existing scorecard is system-centric: discovery, data governance, security, model assurance, human oversight, and compliance/audit. This enterprise view is organization-centric:

1. **Policy**
2. **Roles & Accountability**
3. **Risk Management**
4. **Data & Model Governance**
5. **Monitoring & Controls**
6. **Audit & Assurance**

Both views point to the same underlying controls. A control should be implemented once and cross-referenced, not duplicated.

## Layer 1 — Policy

| Enterprise objective | Hawkeye Sterling implementation |
|---|---|
| Define AI principles | [AI Policy](ai-policy.md) and [UAE AI Charter mapping](uae-ai-charter-mapping-2026.md) |
| Establish approval criteria | [AI use-case intake](ai-use-case-intake.md), AI asset onboarding requirements |
| Set usage rules | [AI Acceptable-Use Policy](ai-acceptable-use-policy.md), in-app acknowledgment gate |
| Align with regulation and frameworks | [NIST AI RMF](nist-ai-rmf-mapping-2026.md), [ISO/IEC 42001 SoA](iso-42001-soa-2026.md), [EU AI Act assessment](eu-ai-act-assessment-2026.md) |

**Control IDs:** EAI-POL-01 through EAI-POL-04.

## Layer 2 — Roles & Accountability

| Enterprise objective | Hawkeye Sterling implementation |
|---|---|
| Assign AI owner | Every AI surface currently registered in the Hawkeye Sterling suite has an accountable owner in the [AI Asset Register](ai-asset-register.md); enterprise-wide discovery remains open under item 9 of the [open-actions register](open-actions-register.md) |
| Clarify business ownership | [Operating model](operating-model.md) and [control ownership matrix](ai-control-ownership-matrix.md) |
| Define legal/governance oversight | [AI Governance Committee Charter](ai-governance-committee-charter.md); formal adoption and the DPO designation determination remain open under items 4 and 13 |
| Set risk responsibilities | Risk register and risk-appetite ownership |
| Create escalation paths | [AI Incident Runbook](ai-incident-runbook.md), operating-model escalation |

**Control IDs:** EAI-ROL-01 through EAI-ROL-04.

## Layer 3 — Risk Management

| Enterprise objective | Hawkeye Sterling implementation |
|---|---|
| Identify AI risks | [AIMS AI Risk Register](../aims/ai-risk-register.md) |
| Classify use cases | [AI use-case intake](ai-use-case-intake.md) plus AI asset risk tier |
| Assess impact and likelihood | 5×5 inherent/residual scoring, DPIA, stakeholder impact assessment; `EAI-RSK-03` remains partial while item 42 reconciles the adverse-media LLM-triage go-live prerequisites and live configuration |
| Design mitigations | Control mappings, CAPA and open-actions process |
| Approve residual risk | [Residual-risk acceptance register](residual-risk-acceptance-register.md); no acceptance is inferred from silence |

**Control IDs:** EAI-RSK-01 through EAI-RSK-05.

## Layer 4 — Data & Model Governance

| Enterprise objective | Hawkeye Sterling implementation |
|---|---|
| Govern data and retention | [Data retention](data-retention.md), DPIA and data-minimisation controls |
| Maintain data quality and lineage | [Data-quality plan](../aims/data-quality-plan.md), source/version lineage, screening evidence and schema/integrity checks over governed data files |
| Validate models | [Model validation](model-validation-2026.md), live Advisor evaluation and bias testing; MRM ratification, the overdue Q3 sign-off and independent review remain explicit under items 16, 38 and 8 |
| Document prompts and models | [Prompt lifecycle register](prompt-lifecycle-register.md), [AI Asset Register](ai-asset-register.md) |
| Control versions and changes | Prompt fingerprints, pinned routing, PR review and CI guards |
| Manage access and retention | [Tool & connector register](tool-connector-register.md), server-held credentials, retention rules |
| Review vendors | [AI vendor assurance view](ai-vendor-assurance.md) backed by the AIMS third-party register |

**Control IDs:** EAI-DMG-01 through EAI-DMG-06.

## Layer 5 — Monitoring & Controls

| Enterprise objective | Hawkeye Sterling implementation |
|---|---|
| Enable human oversight | AI remains decision support; MLRO/operator makes the decision |
| Track performance | Advisor eval scorecard and live evaluation |
| Monitor bias | Quarterly bias evaluation and formal cross-script testing |
| Detect drift | Prompt/tool register drift guards and governance metrics |
| Apply security controls | CSP/HSTS, CodeQL, Semgrep, Fortify, secret scanning and least privilege; `EAI-MON-03` remains partial for public-history redaction, verified end-user identity, fleet-wide LLM-relay rate limiting and the first manual penetration-test cycle under items 1, 20, 22 and 43 |
| Manage access controls | Tool/connector inventory, server-held credentials and repository protection; verified end-user identity on confidential function endpoints remains open under item 20 and is reported as partial on the generated dashboard |
| Respond to incidents | AI incident runbook, kill switches and freshness alarms; `EAI-MON-04` remains partial for independent alerting, production telemetry rehearsal, deploy self-heal/rollback and the first AI incident tabletop under items 21, 24, 26 and 31 |
| Report and improve | Daily governance report, GRC metrics, CAPA and management review |

**Control IDs:** EAI-MON-01 through EAI-MON-05.

## Layer 6 — Audit & Assurance

| Enterprise objective | Hawkeye Sterling implementation |
|---|---|
| Keep AI inventory | Machine-readable AI asset register for the Hawkeye Sterling suite; enterprise-wide extension remains open under item 9 |
| Maintain evidence | [Assurance Coverage Matrix](assurance-coverage-matrix.md) and evidence retention |
| Preserve decisions | Git/Asana/audit trails, sign-off and override records; `EAI-AUD-04` remains partial until item 23 provides a dedicated authenticated persistence tier plus a documented and rehearsed assessment-data RPO/RTO |
| Test controls regularly | [AI control testing calendar](ai-control-testing-calendar.md) plus CI/scheduled workflows; `EAI-AUD-07` keeps human review/exercise currency visible and points overdue cycles to the open-actions register |
| Review vendor assurance | Third-party register and AI-specific vendor view |
| Map compliance obligations | [`EAI-AUD-08`](../../data/ai-controls.json) ties the obligation register, regulatory-watch sources and legal-citation guards into one tested traceability control; article-level legal sourcing remains open under item 5 and is reported as partial |
| Track remediation | CAPA and open-actions registers |
| Run internal/external audits | Internal audit programme exists; external conformity assurance is not claimed until commissioned |

**Control IDs:** EAI-AUD-01 through EAI-AUD-08.

## Open actions outside the six-layer AI-control denominator

The open-actions register is broader than this AI-governance crosswalk. The following
live items remain pending but are intentionally **not** used as closure actions for an
enterprise AI control, so their absence from the dashboard is not mistaken for closure:

- item 2 is a chase-email workflow that advances items 5 and 6 rather than a control itself;
- item 3 is a queued release-approval act, while the deployment gate itself is operating;
- item 6 is deterministic transaction-feed wiring for the wider AML programme;
- item 7 is firm-wide AML/CFT and sanctions training beyond the AI-control scope;
- item 18 is approval of the wider AML/CFT/CPF policy pack;
- item 27 is screening-engine maintainability technical debt;
- item 28 is Arabic UI linguistic QA/localisation.

They remain authoritative in the [open-actions register](open-actions-register.md) and
must not be read as complete merely because they are outside this control denominator.
The same seven rows are machine-readable in `data/ai-controls.json` under
`scope_exclusions`; the control validator fails if a live open action is neither
mapped to an incomplete control nor explicitly excluded with a rationale.

## Evidence rule

The crosswalk is descriptive. **Current status is never hand-maintained here.** Run:

```sh
node scripts/ai-governance-controls.mjs --check
```

The command validates the control register, verifies referenced evidence exists, checks the register review deadline, and drift-checks the generated dashboard, ownership matrix and residual-risk view.

## Interpretation

A green automated test proves the stated repository invariant, not certification. A layer may remain **partial** even when every CI test passes, because human ratification, a contract/DPA, an internal-audit execution, a tabletop exercise, or independent assurance may still be outstanding.

