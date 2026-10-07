# AI & AI-Adjacent Vendor Assurance View

**Owner:** MLRO / DPO  
**Source of truth:** [AIMS Third-Party Register](../aims/third-party-register.md)  
**Metric:** [`data/grc-metrics.json`](../../data/grc-metrics.json) → `thirdPartyAssessmentCoverage`  
**Related control:** EAI-DMG-05.

This page is a focused view of providers that can affect AI governance. It does **not** create a second vendor register. Contractual safeguards, DPA status, transfer basis, residency and vendor-specific facts remain authoritative in the AIMS third-party register and related execution packs.

## Provider view

| Provider | AI-governance relevance | Current governance posture |
|---|---|---|
| **Anthropic** | Model provider for the MLRO Advisor, Regulatory-Watch AI draft and the dormant adverse-media LLM triage path | Governed model calls are inventoried. The adverse-media LLM triage path remains fail-closed until the required Anthropic DPA condition recorded in the AI asset register/DPA execution pack is satisfied. The third-party coverage metric must be used for the current assurance state rather than copying a percentage here. |
| **Composio** | Optional orchestration layer that can expose connected business-app tools to governed workflows | Default OFF. The third-party register requires DPA/PDPL transfer-basis confirmation before production enablement. It is not part of the sanctions, PEP, adverse-media, scoring or runtime-assurance decision path. |
| **Asana** | Operational evidence/alert destination, including AI-governance cards; not a model provider | Treat as AI-adjacent because governance evidence and escalations can flow through it. Current safeguard/transfer status is maintained only in the third-party register. |
| **Netlify** | Hosts the serverless Advisor relay and static application | Security, secrets and function boundaries are documented in architecture/security evidence; vendor position remains in the third-party register. |
| **GitHub** | Source control, CI, security scanning and governance evidence | Repository protections, Actions permissions and evidence retention are governed separately; vendor position remains in the third-party register. |

## Minimum assurance questions for an AI provider

Before a new provider is approved, record:

1. legal entity and contracted service;
2. processing purpose and data categories;
3. whether customer, employee, case or screening data is transferred;
4. processing/residency regions and cross-border basis;
5. DPA and subprocessor position;
6. provider retention and training-on-inputs position for the contracted service;
7. security assurance available under the contracted plan;
8. incident-notification commitment;
9. business continuity and exit/export options;
10. model/version change notification or operational strategy;
11. ability to disable the integration without breaking deterministic compliance controls;
12. owner, review date and unresolved conditions.

## Gate

A vendor assurance gap must be represented as one of the following, never silently treated as complete:

- feature disabled;
- feature restricted to a lower-risk/public-data path;
- compensating control with named owner and deadline;
- explicit human risk acceptance within appetite.

The generated six-layer dashboard reads the live third-party coverage metric from `data/grc-metrics.json`; this page therefore cannot make the vendor layer appear green by wording alone.

