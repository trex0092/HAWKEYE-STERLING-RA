# AI Framework and Threat-Control Adoption Decision (12-Item Review)

**Owner:** Compliance Engineering (implementation), MLRO (risk acceptance)  
**Review date:** 2026-10-13  
**Status:** Technical applicability assessment, **not** an MLRO approval, ISO certification, attestation of complete operational health or authorization to enable any external service.  
**Triggers to re-review:** new RAG use case; a self-hosted model; autonomous write-capable agent; a new data processor; production model egress; a significant attack or adverse-media coverage incident.

## Architecture baseline and decision

The Hawkeye Sterling sanctions, adverse-media, PEP and Asana workflow is **deterministic AML/CFT screening plus human disposition**, not an unsupervised AI-agent product. `agent_orchestrator.py` and `agent_plan.py` are bounded, offline, read-only coordinators. `mcp_server.py` and `mcp_tools.py` expose validated deterministic tools. The optional LLM classifier in `ai.py` remains off by default unless explicitly enabled and authorised. Do not add an agent orchestration stack or a vector database to work around an unavailable news feed.

The image groups unrelated kinds of technology. The following matrix is **the disposition of each of its 12 entries**, not an endorsement or an assertion that the named vendors are installed.

| # | Item in supplied image | Decision for this repository | Security, compliance or implementation reason | Reconsider only when |
|---|---|---|---|---|
| 1 | LangGraph | **Defer** | Stateful multi-agent orchestration is not required for deterministic screening. Existing approved tool plans are deliberately read-only and human-gated (`agent_orchestrator.py`, `agent_plan.py`). | A reviewed, bounded agent workflow cannot be implemented with existing orchestration and has a recorded MLRO approval boundary |
| 2 | CrewAI | **Defer** | Delegating compliance work between agents creates additional tool authority and non-deterministic outcomes. | Approved multi-agent use case with independent permission gates, evals, audit evidence, and human accountability |
| 3 | Microsoft Agent Framework | **Defer** | A second agent framework does not improve news provider uptime or Asana receipts. | A Microsoft-hosted workflow has an approved architecture, processor assessment and connector scopes |
| 4 | Haystack | **Defer** | Retrieval-augmented generation is not required for direct sanctions and live adverse-media source queries. | A document-grounded knowledge product is approved with retrieval accuracy and citation testing |
| 5 | FAISS | **Defer** | Embeddings and similarity indices are not a substitute for designation-list identity matching or verified adverse-media search. | An independently evaluated search corpus, leakage controls and false-negative benchmark exist |
| 6 | vLLM | **Defer** | Hosted/self-managed model serving adds compute, operations and model supply-chain obligations unrelated to the current outage. | A self-hosted inference model and lawful data-residency position are approved |
| 7 | Ollama | **Defer** | Local model execution is useful for prototyping but does not by itself make screening complete, current or compliant. | A bounded offline research use case is approved and adversarially evaluated |
| 8 | Chroma | **Defer** | An additional vector store creates data retention, deletion and provenance obligations without an approved RAG need. | A vector search use case is accepted against measurable privacy and accuracy criteria |
| 9 | Pinecone / Qdrant / Weaviate | **Defer** | These are alternative vector databases, not three extra screening sources. External service choices require processor, residency and audit assessment. | A vector index is necessary, with approved vendor/DPA and fail-closed retrieval tests |
| 10 | MITRE ATLAS | **Adopt as an AI threat-model reference** | Apply attacks such as prompt injection, untrusted external content, poisoning and data exfiltration to optional AI triage and MCP tool use. Existing tests: `test/redteam_injection.py`, `test/mcp_tools_test.py`; defenses: `ai.py`, `mcp_tools.py`. | Review attack scenarios when prompts, tools or model execution change |
| 11 | OWASP Top 10 for LLM Applications | **Adopt as a security-test checklist** | LLM01 prompt injection; LLM02 sensitive-data disclosure; LLM03 supply chain; LLM05 improper output handling; LLM06 excessive agency; LLM09 misinformation; LLM10 unbounded consumption. Not every category implies a deployed feature. | Each model/tool/retrieval change must add relevant exploit and safe-benign regression tests |
| 12 | MITRE ATT&CK | **Adopt selectively for platform threat modeling** | Focus on credentials, GitHub Actions workflows, software supply chain, malicious code execution and exfiltration. Evidence: `.github/workflows/gitleaks.yml`, `.github/workflows/codeql.yml`, `.github/workflows/semgrep.yml`, `agent_orchestrator.py`. | Reassess for new operational permissions, entry points or third-party connectors |

## Security threat paths and acceptance evidence

| Threat path | Relevant references | Current defensive mechanism | Verification and residual limitation |
|---|---|---|---|
| Untrusted news publisher or headline issues model commands | OWASP LLM01, MITRE ATLAS | `ai.py::detect_injection`, fail-closed deterministic triage, untrusted-content boundaries | `test/redteam_injection.py`. The Unicode/format-control adversarial extension is separately reviewable under PR #902. No finite red-team set proves every attack is caught |
| Model mislabels a sanctions/adverse-media finding or invents a report | OWASP LLM05, LLM09 | Real-source citation, deterministic severity floor, human MLRO decision gate; model prose off by default | `test/engine_test.py`, `test/redteam_injection.py`, `docs/AI-GOVERNANCE.md`. Live model evaluation and human inspection remain separate |
| Prompt/tool escalation to unauthorised case clearance or external writes | OWASP LLM06, MITRE ATLAS | Closed read-only allowlists (`agent_orchestrator.py`, `agent_plan.py`, `mcp_tools.py`), human-owned Asana dispositions | `test/mcp_tools_test.py`, `test/screening-cases.test.mjs`. A privileged client or compromised account requires separate identity/access testing |
| PII or secrets leak through model/Asana logs | OWASP LLM02, MITRE ATT&CK | `ai.py::redact_identifiers`, opt-in model egress, redacted Asana provider errors, secret scanning | `test/engine_test.py`, `test/asana-notify.test.mjs`, Gitleaks. Actual vendor retention/DPA and connected secrets cannot be proven by source tests |
| Dependency or GitHub workflow compromise | OWASP LLM03, MITRE ATT&CK | Lockfiles/hashes, CodeQL, Semgrep, Gitleaks, workflow least privilege and egress allowlists | CI workflow checks and independent review. Historical security alert inventory and protection settings must be verified by authorised repository administration |
| Embedding or vector retrieval poisoning | OWASP LLM08 | **Not applicable to deployed screening:** no approved embedding/vector index is used for AML conclusions | Reopen as a new design/security review **before** adopting Haystack/FAISS/Chroma/Qdrant/Pinecone/Weaviate |
| Screening news provider inaccessible or consent/rate-limit response | Operational source assurance (not solved by a model framework) | Three independent live news backbones, response-shape validation, provider-aware throttling, retry/second pass, non-clearance on outage | `scripts/adverse-media.mjs`, `scripts/sanctions-screen.mjs`, `scripts/screening-assurance.mjs`. **A verified 991/991 live result and Asana receipts are still required**; passing unit tests alone are insufficient |

## Operational acceptance gate for an honest 100% result

An operator must verify all of the following with actual *current* evidence:

1. Exact deployed/integrated `main` SHA passes required non-Netlify code, tests, SAST and secret/supply-chain checks.
2. A fresh full-book sanctions/PEP/adverse-media run screens **every subject**; all mandatory source floors and fresh PEP input pass; **zero subjects** are recorded with no verified adverse-media backbone coverage or skipped screening.
3. The independent `Screening Assurance` job reports **success using the persisted `screen-state` artifact from that completed run**, without changing thresholds, hiding exceptions, inventing coverage, or treating HTTP 200 error/interstitial pages as clean results.
4. Each required sanctions/adverse-media report, case lifecycle event and evidence attachment is verified in the approved Asana destination, with unresolved cases open and recorded for the MLRO.
5. Human owners separately confirm residual third-party source redundancy, unresolved provider outages, applicable DPA/processor obligations, risk acceptances and any required governance sign-off. Source-code tests **do not** grant ISO/IEC 42001 certification or MLRO approval.

A single successful feed or all-green repository CI is **not** proof of these five operational and human controls. If any fails, report **not 100% operational**, retain fail-closed case handling and leave incident alerts open.

**Scope exclusion:** No Netlify implementation, configuration, deployment or checks are modified by this decision. This is an architecture evaluation, not a new vendor integration or delegated AI authority.

**Companion records:** [AI asset register](../../data/ai-assets.json), [AI rulebooks crosswalk](ai-rulebooks-crosswalk-2026.md), [AI control testing calendar](ai-control-testing-calendar.md), [AI model governance](../AI-GOVERNANCE.md), [screening assurance](../../scripts/screening-assurance.mjs).
