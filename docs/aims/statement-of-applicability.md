# Statement of Applicability (AIMS 6.1.3 / ISO 42001 Annex A)

Which AI-management controls apply, their status, and justification for any
exclusion. Status: Implemented / Partial / Planned / Not Applicable (N/A).

**Scope: the whole AIMS** — screening engine, entity-risk app, agents and
Advisor. The narrower, control-by-control statement for the LLM Advisor is
[`../governance/iso-42001-soa-2026.md`](../governance/iso-42001-soa-2026.md);
how the two relate, and which risk each Annex A control treats, is in the
[clause 6.1 mapping index](iso-42001-clause-6-1-mapping.md).

> **Reconciled 2026-07-29.** Three defects, all corrected here:
> (i) a single row asserted *"AI impact assessment (individuals/society) —
> Implemented"* while the Advisor statement recorded A.5.4 as 🟡 with its first
> bias cycle pending — two statements of applicability disagreeing about the
> same control. The row is now **split into A.5.2 and A.5.4** at their true and
> matching statuses. (ii) Neither statement cited the **ratified Stakeholder
> Impact Assessment** at all, though it is the strongest 6.1.4 evidence either
> could offer; both now do. (iii) FATF R.16 carried the status
> `Implemented (inactive)` — a fifth value outside the four declared above. It
> is **Partial**: the engine is built and tested, and it is not operating
> because no feed is connected. The justification column already said so; the
> status now agrees with it.

| Annex A area | Control | Status | Evidence / justification |
|---|---|---|---|
| A.2 AI policy | AI policy documented & approved | Implemented | `docs/AI-GOVERNANCE.md`; standalone `docs/governance/ai-policy.md` (ratified 2026-07-02) |
| A.3 Internal org | Roles, responsibilities, ownership | Implemented | `agents.py` identities; MLRO owns decisions |
| A.4 Resources | AI system inventory | Implemented | `ai-system-inventory.md` |
| A.4 Resources | Data resources documented | Implemented | inventory + `third-party-register.md` |
| A.5 Impact | AI risk assessment methodology | Implemented | `ai.compute_risk_rating`; `ai-risk-register.md` |
| A.5 Impact (A.5.2) | AI system impact assessment exists, is owned and is versioned | Implemented | [`ai-impact-assessment.md`](ai-impact-assessment.md) (v1.1); [`../governance/dpia-2026.md`](../governance/dpia-2026.md) |
| A.5 Impact (A.5.4) | Impacts on **individuals and groups** assessed, incl. unfair/discriminatory outcomes | Partial | [`../governance/stakeholder-impact-assessment-2026.md`](../governance/stakeholder-impact-assessment-2026.md) — canonical clause 6.1.4 artefact, ratified 2026-07-02; cross-script recall parity a hard CI gate. **Partial** for one reason: the first bias-review cycle has not run |
| A.6 Lifecycle | Responsible development / change mgmt | Implemented | PR + CI (Python & node tests) |
| A.6 Lifecycle | Verification & validation | Implemented | `test/engine_test.py`, CI, smoke tests |
| A.6 Lifecycle | Business continuity / resilience | Partial | `bcp.md`; degrade-loudly; retries |
| A.7 Data | Data governance / quality | Implemented | retention, source provenance; `aims/data-quality-plan.md` (dimensions, controls, checks) |
| A.7 Data | Data privacy (PDPL) | Implemented | no-egress default; LLM gated; DPIA |
| A.8 Information for users | Explainability / transparency | Implemented | labelled outputs + raw evidence; report §⑦ |
| A.9 Use | Human oversight (HITL) | Implemented | MLRO sign-off; nothing auto-files |
| A.9 Use | Stakeholder feedback | Partial | `stakeholder-feedback.md` (channels + triage process + operating log) |
| A.10 Third parties | Supplier/processor management | Implemented | `third-party-register.md` |
| — Security | Prompt security / adversarial controls | Implemented | `detect_injection`; grounding contract |
| — Security | Adversarial red-team (prompt-injection corpus) | Implemented | `red-team-procedure.md`; CI-run injection corpus exercising `detect_injection` (R-02) |
| — Security | Access control & least privilege | Implemented | agent authorization + credential broker |
| — Security | Secrets handling | Implemented | masking; gitleaks; no secrets in logs |
| — Monitoring | Monitoring & logging | Implemented | freshness-check, screening-metrics, audit trail |
| — Monitoring | Runtime monitoring & drift detection | Implemented | `monitoring.py`; report §⑤; QA gate; `runtime-monitoring.md` |
| — Monitoring | Source-coverage drift detection | Implemented | `monitoring.py` coverage-drift alarms; report §⑤; `in-domain-aml-coverage.md` |
| — Monitoring | Bias & fairness testing | Implemented | `bias-fairness-testing.md`; cross-script recall-parity test in `test/engine_test.py` (R-05) |
| — AML coverage | FATF R.10 — jurisdiction risk (risk-based approach) | Implemented | `kyc.jurisdiction_risk_for`; maintained `data/jurisdiction-risk.json`; `in-domain-aml-coverage.md` |
| — AML coverage | FATF R.25 — legal-arrangement (trust/foundation) flag | Implemented | `kyc.py` arrangement detection, surfaced per match; `in-domain-aml-coverage.md` |
| — AML coverage | FATF R.16 — transaction monitoring | Partial | `txn_monitor.py` engine built & tested; INACTIVE pending a real feed `TXN_FEED_PATH` (risk R-13) |
| — Improvement | Nonconformity / corrective action | Implemented | `corrective-actions.md` |

**Exclusions (N/A, justified):** model-training controls (no models are trained —
external LLM used read-only); MFA/SSO end-user auth (no end-user logins; access is
via GitHub/Asana platform auth); vector-DB security (no vector store).
