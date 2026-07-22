# Governance & Compliance — Document Pack

Hawkeye Sterling V2. The governance layer above the code: policy,
framework mappings, risk/impact assessments, registers, and operational runbooks.
Sibling packs: [`../aims/README.md`](../aims/README.md) (ISO/IEC 42001 AIMS pack) ·
[`../models/README.md`](../models/README.md) (model cards) ·
[`../AI-GOVERNANCE.md`](../AI-GOVERNANCE.md) (master model card + control mapping).

Every document lists its owner and cadence in its header; findings and actions
flow to the [CAPA log](../aims/corrective-actions.md) and the
[management review](../aims/management-review.md), audited per the
[internal audit programme](../aims/internal-audit.md).

## Policy & principles

| Document | What it is | Framework ref |
|---|---|---|
| [ai-policy.md](ai-policy.md) | Top-level standalone AI Policy (ratified 2026-07-02) | ISO 42001 A.2.2 |
| [ai-acceptable-use-policy.md](ai-acceptable-use-policy.md) | Operator AUP — permitted/prohibited use, acknowledgment | ISO 42001 A.9.2 |
| [explainability-statement-2026.md](explainability-statement-2026.md) | How outputs are interpretable; stated limits | NIST AI RMF MAP; AI Act Art. 13-style |
| [grc-cybersecurity-model.md](grc-cybersecurity-model.md) | How the GRC layer and the security controls form one loop | NIST CSF GOVERN; ISO 42001 |

## Framework mappings & assessments

| Document | What it is | Framework ref |
|---|---|---|
| [iso-42001-soa-2026.md](iso-42001-soa-2026.md) | Statement of Applicability (Advisor view) | ISO 42001 Annex A |
| [nist-ai-rmf-mapping-2026.md](nist-ai-rmf-mapping-2026.md) | GOVERN/MAP/MEASURE/MANAGE crosswalk | NIST AI RMF 1.0 |
| [eu-ai-act-assessment-2026.md](eu-ai-act-assessment-2026.md) | Applicability, role & risk classification, Art. 4 literacy, Art. 73-equivalent clocks | EU AI Act (voluntary) |
| [uae-ai-charter-mapping-2026.md](uae-ai-charter-mapping-2026.md) | 12-principle mapping | UAE AI Charter |
| [ai-frameworks-crosswalk-2026.md](ai-frameworks-crosswalk-2026.md) | FAST/SUM values + responsible-AI lifecycle orientation | Turing FAST/SUM; EU AI Act |
| [agentic-ai-governance-6layers-2026.md](agentic-ai-governance-6layers-2026.md) | Six-layer agentic-AI governance scorecard (incl. Layer 5 human oversight) | Practitioner framework |
| [ai-governance-gap-analysis-2026.md](ai-governance-gap-analysis-2026.md) | Tile-by-tile gap analysis vs the AI Governance & Security periodic table | Practitioner framework |
| [enterprise-readiness-review-2026.md](enterprise-readiness-review-2026.md) | Maturity scoring + recommendations | — |
| [pbg-lifecycle-map-2026.md](pbg-lifecycle-map-2026.md) | 11-stage lifecycle map (design → retire), owners + evidence | ISO 42001 A.6 |

## Risk & impact assessments

| Document | What it is | Framework ref |
|---|---|---|
| [dpia-2026.md](dpia-2026.md) | Data Protection Impact Assessment | UAE PDPL; GDPR-style |
| [stakeholder-impact-assessment-2026.md](stakeholder-impact-assessment-2026.md) | Stakeholder harms & mitigations (ratified 2026-07-02) | ISO 42001 A.5 |
| [advisor-bias-review-2026.md](advisor-bias-review-2026.md) | Paired-prompt bias review method + log | ISO 42001 A.5.4 |

## Registers & assurance evidence

| Document | What it is | Framework ref |
|---|---|---|
| [ai-asset-register.md](ai-asset-register.md) | Inventory of AI surfaces + onboarding process | ISO 42001 A.4.2 |
| [assurance-coverage-matrix.md](assurance-coverage-matrix.md) | Control → automated proof → evidence map; known gaps | ISO 42001 9.1 |
| [model-validation-2026.md](model-validation-2026.md) | Model validation + change control + quarterly MLRO sign-off | SR 11-7-style |

## Operations & resilience runbooks

| Document | What it is | Framework ref |
|---|---|---|
| [ai-incident-runbook.md](ai-incident-runbook.md) | AI incident triggers, kill switch, response steps | ISO 42001 A.6; AI Act Art. 73-equivalent clocks in [eu-ai-act-assessment-2026.md §6](eu-ai-act-assessment-2026.md) |
| [incident-postmortem-template.md](incident-postmortem-template.md) | Blameless post-incident review template | — |
| [backup-recovery.md](backup-recovery.md) | Backup & disaster-recovery runbook | ISO 42001 A.6 |
| [data-retention.md](data-retention.md) | Stores, retention, lineage, purge | UAE FDL 10/2025 (formerly FDL 26/2021 Art. 23); PDPL |
| [pqc-readiness.md](pqc-readiness.md) | Post-quantum crypto exposure & agility | NIST PQC |
| [github-repository-hardening.md](github-repository-hardening.md) | Required GitHub config (protection-as-code companion to `.github/settings.yml`) | Supply-chain |
| [scorecard-9.5-path.md](scorecard-9.5-path.md) | OpenSSF Scorecard arithmetic + runbook to ≥ 9.0 (date-locked checks explained) | Supply-chain |
| [openssf-best-practices.md](openssf-best-practices.md) | OpenSSF Best Practices badge criteria→evidence map | Supply-chain |

**Owner:** MLRO / Compliance Engineering. **Review cadence:** annually and on any
material change; navigability of this index is checked by the annual
[internal audit](../aims/internal-audit.md).
