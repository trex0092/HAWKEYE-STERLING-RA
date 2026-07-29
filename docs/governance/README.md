# Governance & Compliance — Document Pack

Hawkeye Sterling V2. The governance layer above the code: policy,
framework mappings, risk/impact assessments, registers, and operational runbooks.
Sibling packs: [`../policies/README.md`](../policies/README.md) (AML/CFT/CPF policy pack) ·
[`../aims/README.md`](../aims/README.md) (ISO/IEC 42001 AIMS pack) ·
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
| [risk-appetite-statement-2026.md](risk-appetite-statement-2026.md) | Eight appetite positions, each with a numeric residual ceiling, a named owner and an escalation SLA; the acceptance scale; the KRIs with their amber bands. CI pins the stated appetite to the appetite the code enforces and scores every register risk against its ceiling (DRAFT — board R7) | ISO 31000 5.4.3; NIST AI RMF GOVERN 1.3 |
| [kri-breach-ledger.md](kri-breach-ledger.md) | Append-only history of every KRI breach and amber signal, who was told and what followed — the history the byte-compared metrics snapshot cannot carry | ISO 31000 6.6; ISO 42001 9.1 |
| [risk-glossary.md](risk-glossary.md) | The risk vocabulary in business language — appetite vs tolerance vs capacity, inherent vs residual vs target, risk owner vs control owner, issue vs incident vs near miss vs loss event, KRI vs KPI. Points at the authoritative definition in each case rather than restating it, and states the terms the estate does **not** yet use | ISO 31000 3; ISO Guide 73 |
| [ai-acceptable-use-policy.md](ai-acceptable-use-policy.md) | Operator AUP — permitted/prohibited use, acknowledgment | ISO 42001 A.9.2 |
| [explainability-statement-2026.md](explainability-statement-2026.md) | How outputs are interpretable; stated limits | NIST AI RMF MAP; AI Act Art. 13-style |
| [grc-cybersecurity-model.md](grc-cybersecurity-model.md) | How the GRC layer and the security controls form one loop | NIST CSF GOVERN; ISO 42001 |
| [adr-001-deterministic-vs-learned.md](adr-001-deterministic-vs-learned.md) | Why the operative core is deterministic; revisit triggers + governed path to a first learned model | ADR; SR 11-7 |

## Framework mappings & assessments

| Document | What it is | Framework ref |
|---|---|---|
| [iso-42001-soa-2026.md](iso-42001-soa-2026.md) | Statement of Applicability (Advisor view) | ISO 42001 Annex A |
| [nist-ai-rmf-mapping-2026.md](nist-ai-rmf-mapping-2026.md) | GOVERN/MAP/MEASURE/MANAGE crosswalk | NIST AI RMF 1.0 |
| [eu-ai-act-assessment-2026.md](eu-ai-act-assessment-2026.md) | Applicability, role & risk classification, Art. 4 literacy, Art. 73-equivalent clocks | EU AI Act (voluntary) |
| [uae-ai-charter-mapping-2026.md](uae-ai-charter-mapping-2026.md) | 12-principle mapping | UAE AI Charter |
| [uae-ai-data-laws-2026.md](uae-ai-data-laws-2026.md) | 2026 UAE AI/data-law applicability + Data Office top-10 violation posture map | UAE PDPL; FDL 34/2021; Data Office |
| [ai-frameworks-crosswalk-2026.md](ai-frameworks-crosswalk-2026.md) | FAST/SUM values + responsible-AI lifecycle orientation | Turing FAST/SUM; EU AI Act |
| [agentic-ai-governance-6layers-2026.md](agentic-ai-governance-6layers-2026.md) | Six-layer agentic-AI governance scorecard (incl. Layer 5 human oversight) | Practitioner framework |
| [operational-ai-governance-stack-2026.md](operational-ai-governance-stack-2026.md) | Five-level operational-stack scorecard (visibility → monitoring → controls → evidence → continuous governance), incl. deliberate non-controls with re-triggers | Practitioner framework |
| [sanctions-screening-gap-checklist-2026.md](sanctions-screening-gap-checklist-2026.md) | 36-item sanctions-screening gap self-assessment (lists, matching, TFS reporting, testing, evidence) — gaps closed in-change: TFS name-match procedure, internal watchlist, training cadence | UAE TFS practitioner checklist; Cabinet Decision 74/2020 |
| [ai-governance-gap-analysis-2026.md](ai-governance-gap-analysis-2026.md) | Tile-by-tile gap analysis vs the AI Governance & Security periodic table | Practitioner framework |
| [enterprise-readiness-review-2026.md](enterprise-readiness-review-2026.md) | Maturity scoring + recommendations | — |
| [pbg-lifecycle-map-2026.md](pbg-lifecycle-map-2026.md) | 11-stage lifecycle map (design → retire), owners + evidence | ISO 42001 A.6 |
| [operational-ai-governance-lifecycle.md](operational-ai-governance-lifecycle.md) | Seven-stage operating loop + the three executive questions, mapped to evidence | Practitioner framework |

## Risk & impact assessments

| Document | What it is | Framework ref |
|---|---|---|
| [dpia-2026.md](dpia-2026.md) | Data Protection Impact Assessment | UAE PDPL; GDPR-style |
| [stakeholder-impact-assessment-2026.md](stakeholder-impact-assessment-2026.md) | Stakeholder harms & mitigations (ratified 2026-07-02) | ISO 42001 A.5 |
| [advisor-bias-review-2026.md](advisor-bias-review-2026.md) | Paired-prompt bias review method + log | ISO 42001 A.5.4 |
| [cross-border-transfer-position-2026.md](cross-border-transfer-position-2026.md) | UAE→US transfer position (DRAFT for counsel; closes register item 11 on signature) | UAE PDPL transfers |
| [dpo-determination-2026.md](dpo-determination-2026.md) | DPO requirement assessment + minute block (DRAFT for the board sitting) | UAE PDPL Art. 10 |

## Registers & assurance evidence

| Document | What it is | Framework ref |
|---|---|---|
| [ai-asset-register.md](ai-asset-register.md) | Inventory of AI surfaces + onboarding process | ISO 42001 A.4.2 |
| [policy-register.md](policy-register.md) | Every governing instrument with owner, approval record and next review; anti-shadow-policy sweep in CI | ISO 42001 7.5 / A.2.2; NIST AI RMF GOVERN 1.2 |
| [obligation-register.md](obligation-register.md) | Every obligation → instrument, owner, control, evidence, watch source; status honest about what waits on a human | FATF R.1; ISO 42001 4.2 |
| [grc-metrics.md](grc-metrics.md) | Six GRC management ratios computed from the estate, with a CI freshness check | ISO 42001 9.1; NIST AI RMF MEASURE |
| [prompt-lifecycle-register.md](prompt-lifecycle-register.md) | PromptOps: every governed prompt, fingerprinted and version-controlled — an edit fails CI until the row is re-approved | ISO 42001 A.6.2.4; NIST AI RMF MANAGE 2.2 |
| [tool-connector-register.md](tool-connector-register.md) | Capability view: what may be invoked, by whom, with which credential; MCP posture and connector onboarding rule | ISO 42001 A.4.2/A.10.2; UAE Securing Agentic AI |
| [assurance-coverage-matrix.md](assurance-coverage-matrix.md) | Control → automated proof → evidence map; known gaps | ISO 42001 9.1 |
| [model-validation-2026.md](model-validation-2026.md) | Model validation + change control + quarterly MLRO sign-off | SR 11-7-style |
| [model-risk-management-2026.md](model-risk-management-2026.md) | MRM framework: inventory, tiering, pillar map | CBUAE MMS 2022; SR 11-7 |
| [backtesting-protocol-2026.md](backtesting-protocol-2026.md) | Outcomes analysis: metrics, small-N guards, cycle ledger | SR 11-7 outcomes analysis |
| [champion-challenger-thresholds.md](champion-challenger-thresholds.md) | Shadow-mode threshold challenge + decision log | SR 11-7 effective challenge |
| [eval-scorecard.md](eval-scorecard.md) | Longitudinal eval results ledger (backfilled from run history) | ISO 42001 9.1 |
| [citation-accuracy-metric.md](citation-accuracy-metric.md) | Advisor grounding metric: definition, target, exemption state | NIST AI RMF MEASURE |

## Operations & resilience runbooks

| Document | What it is | Framework ref |
|---|---|---|
| [ai-incident-runbook.md](ai-incident-runbook.md) | AI incident triggers, kill switch, response steps | ISO 42001 A.6; AI Act Art. 73-equivalent clocks in [eu-ai-act-assessment-2026.md §6](eu-ai-act-assessment-2026.md) |
| [operating-model.md](operating-model.md) | Squad shape, RACI, MLRO delegation matrix, scaling triggers | ISO 42001 5.3/7.2 |
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
