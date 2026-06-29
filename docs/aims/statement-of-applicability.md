# Statement of Applicability (AIMS 6.1.3 / ISO 42001 Annex A)

Which AI-management controls apply, their status, and justification for any
exclusion. Status: Implemented / Partial / Planned / Not Applicable (N/A).

| Annex A area | Control | Status | Evidence / justification |
|---|---|---|---|
| A.2 AI policy | AI policy documented & approved | Implemented | `docs/AI-GOVERNANCE.md` |
| A.3 Internal org | Roles, responsibilities, ownership | Implemented | `agents.py` identities; MLRO owns decisions |
| A.4 Resources | AI system inventory | Implemented | `ai-system-inventory.md` |
| A.4 Resources | Data resources documented | Implemented | inventory + `third-party-register.md` |
| A.5 Impact | AI risk assessment methodology | Implemented | `ai.compute_risk_rating`; `ai-risk-register.md` |
| A.5 Impact | AI impact assessment (individuals/society) | Implemented | `ai-impact-assessment.md` |
| A.6 Lifecycle | Responsible development / change mgmt | Implemented | PR + CI (Python & node tests) |
| A.6 Lifecycle | Verification & validation | Implemented | `test/engine_test.py`, CI, smoke tests |
| A.6 Lifecycle | Business continuity / resilience | Partial | `bcp.md`; degrade-loudly; retries |
| A.7 Data | Data governance / quality | Partial | retention, source provenance; formal data-quality plan planned |
| A.7 Data | Data privacy (PDPL) | Implemented | no-egress default; LLM gated; DPIA |
| A.8 Information for users | Explainability / transparency | Implemented | labelled outputs + raw evidence; report §⑥ |
| A.9 Use | Human oversight (HITL) | Implemented | MLRO sign-off; nothing auto-files |
| A.9 Use | Stakeholder feedback | Planned | `stakeholder-feedback.md` (log started) |
| A.10 Third parties | Supplier/processor management | Implemented | `third-party-register.md` |
| — Security | Prompt security / adversarial controls | Implemented | `detect_injection`; grounding contract; standing red-team (`red-team-procedure.md`) |
| — Security | Access control & least privilege | Implemented | agent authorization + credential broker |
| — Security | Secrets handling | Implemented | masking; gitleaks; no secrets in logs |
| — Monitoring | Monitoring & logging | Implemented | freshness-check, screening-metrics, audit trail; runtime metrics + coverage drift (`runtime-monitoring.md`, `monitoring.py`) |
| — Monitoring | Bias & fairness testing | Implemented | `bias-fairness-testing.md`; `test/bias_eval.py` (cross-script recall parity, CI-enforced) |
| — Improvement | Nonconformity / corrective action | Implemented | `corrective-actions.md` |

**Exclusions (N/A, justified):** model-training controls (no models are trained —
external LLM used read-only); MFA/SSO end-user auth (no end-user logins; access is
via GitHub/Asana platform auth); vector-DB security (no vector store).
