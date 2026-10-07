# Enterprise AI Governance — Six-Layer Crosswalk

**Owner:** MLRO (accountable) · Compliance Engineering (operational)  
**Control source of truth:** [`data/ai-controls.json`](../../data/ai-controls.json)  
**Status dashboard:** [`enterprise-ai-governance-dashboard.md`](enterprise-ai-governance-dashboard.md)  
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
| Assign AI owner | Every AI surface has an accountable owner in [AI Asset Register](ai-asset-register.md) |
| Clarify business ownership | [Operating model](operating-model.md) and [control ownership matrix](ai-control-ownership-matrix.md) |
| Define legal/governance oversight | [AI Governance Committee Charter](ai-governance-committee-charter.md) |
| Set risk responsibilities | Risk register and risk-appetite ownership |
| Create escalation paths | [AI Incident Runbook](ai-incident-runbook.md), operating-model escalation |

**Control IDs:** EAI-ROL-01 through EAI-ROL-04.

## Layer 3 — Risk Management

| Enterprise objective | Hawkeye Sterling implementation |
|---|---|
| Identify AI risks | [AIMS AI Risk Register](../aims/ai-risk-register.md) |
| Classify use cases | [AI use-case intake](ai-use-case-intake.md) plus AI asset risk tier |
| Assess impact and likelihood | 5×5 inherent/residual scoring, DPIA, stakeholder impact assessment |
| Design mitigations | Control mappings, CAPA and open-actions process |
| Approve residual risk | [Residual-risk acceptance register](residual-risk-acceptance-register.md); no acceptance is inferred from silence |

**Control IDs:** EAI-RSK-01 through EAI-RSK-05.

## Layer 4 — Data & Model Governance

| Enterprise objective | Hawkeye Sterling implementation |
|---|---|
| Govern data and retention | [Data retention](data-retention.md), DPIA and data-minimisation controls |
| Maintain data quality and lineage | Source/version lineage, screening evidence and governed data files |
| Validate models | [Model validation](model-validation-2026.md), live Advisor evaluation, bias testing |
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
| Apply security controls | CSP/HSTS, CodeQL, Semgrep, Fortify, secret scanning and least privilege |
| Manage access controls | Tool/connector inventory, server-held credentials and repository protection |
| Respond to incidents | AI incident runbook, kill switches and freshness alarms |
| Report and improve | Daily governance report, GRC metrics, CAPA and management review |

**Control IDs:** EAI-MON-01 through EAI-MON-05.

## Layer 6 — Audit & Assurance

| Enterprise objective | Hawkeye Sterling implementation |
|---|---|
| Keep AI inventory | Machine-readable AI asset register |
| Maintain evidence | [Assurance Coverage Matrix](assurance-coverage-matrix.md) and evidence retention |
| Preserve decisions | Git/Asana/audit trails, sign-off and override records |
| Test controls regularly | [AI control testing calendar](ai-control-testing-calendar.md) plus CI/scheduled workflows |
| Review vendor assurance | Third-party register and AI-specific vendor view |
| Map compliance obligations | Obligation register and framework crosswalks |
| Track remediation | CAPA and open-actions registers |
| Run internal/external audits | Internal audit programme exists; external conformity assurance is not claimed until commissioned |

**Control IDs:** EAI-AUD-01 through EAI-AUD-06.

## Evidence rule

The crosswalk is descriptive. **Current status is never hand-maintained here.** Run:

```sh
node scripts/ai-governance-controls.mjs --check
```

The command validates the control register, verifies referenced evidence exists, checks the register review deadline, and drift-checks the generated dashboard, ownership matrix and residual-risk view.

## Interpretation

A green automated test proves the stated repository invariant, not certification. A layer may remain **partial** even when every CI test passes, because human ratification, a contract/DPA, an internal-audit execution, a tabletop exercise, or independent assurance may still be outstanding.

