# AI Framework Selection and Threat Coverage, 2026-10-13

**Decision owner:** Compliance Engineering; accountable oversight by the MLRO.  
**Scope:** Hawkeye Sterling AML/CFT screening, AI-assisted triage, read-only MCP and agent planning, Asana evidence delivery.  
**Status:** Security reference adoption and code-level regression evidence, **not** ISO certification, production model approval or complete operational proof.

The twelve names in the supplied infographic are not twelve mandatory dependencies. They mix nine incompatible/overlapping application frameworks, stores and runtimes with three security knowledge bases. Installing them all would multiply credential paths, deployment complexity, data-access boundaries and model/embedding poisoning exposure without resolving the real screening-provider outage.

## Decision on all twelve

| # | Item in image | Decision | Repository rationale / reopening requirement |
|---|---|---|---|
| 1 | LangGraph | **Defer** | Local deterministic, human-approved orchestration already exists in `agent_orchestrator.py`. An autonomous planner requires a signed, bound approval model and new review. |
| 2 | CrewAI | **Defer** | Multi-agent delegation provides no evidence that external adverse-media sources answered. More agents mean more permissions to threat-model. |
| 3 | Microsoft Agent Framework | **Defer** | Current `agents.py` and `agent_plan.py` already separate roles and read-only actions. Do not introduce overlapping control planes. |
| 4 | Haystack | **Defer** | `scripts/verified-legal-retrieval.mjs` uses source validation; no approved customer-document RAG use case yet. |
| 5 | FAISS | **Defer** | No approved embedding corpus, retrieval benchmark, access control or deletion proof. |
| 6 | vLLM | **Defer** | No authorized GPU-hosted inference service or validated model/privacy/latency operations. |
| 7 | Ollama | **Defer** | Local inference may be useful later, but is not a substitute for risk classification validation or provider coverage. |
| 8 | Chroma | **Defer** | A new vector store must pass poisoning, tenancy, retention and PII controls first. |
| 9 | Pinecone / Qdrant / Weaviate | **Defer all** | Select **one** only if a future governed semantic-search requirement demonstrates benefit and privacy clearance. |
| 10 | MITRE ATLAS | **Adopt reference controls** | Threat-model poisoned news, prompt injection and adversarial manipulation of screening/model output. See `test/redteam_injection.py`, `scripts/adverse-media.mjs`. |
| 11 | OWASP Top 10 for LLM Applications | **Adopt reference controls** | Prioritize LLM01 prompt injection, LLM02 sensitive-data disclosure, LLM06 excessive agency and LLM10 unbounded consumption, with linked tests. |
| 12 | MITRE ATT&CK | **Adopt reference controls** | Apply credential, exfiltration and supply-chain adversary scenarios to CI and operator permissions. Existing Gitleaks and workflow hardening are only partial evidence. |

The machine-readable decision record is `data/ai-framework-selection.json`; its evidence paths and threat scenarios are checked by the existing CI-invoked `test/ai-assets.test.js`. The index of registered model-facing assets remains `data/ai-assets.json` and the enterprise controls remain `data/ai-controls.json`. This document does **not** register a new AI asset or grant production permissions.

## Concrete threats that matter here

| Security reference | Plausible failure | Implemented regression evidence | Residual gap |
|---|---|---|---|
| OWASP LLM01, MITRE ATLAS | Public news headline/source/date carries Unicode-obfuscated instructions | `ai.py`; `test/redteam_injection.py` | Continuous multilingual/adaptive red-team expansion required |
| OWASP LLM02 | Model request accidentally leaks sensitive identifiers | `ai.py`; `test/engine_test.py` | Legal vendor processing and cross-border approvals remain independent |
| OWASP LLM06 | Model selects an unapproved tool or bypasses MLRO review | `agent_orchestrator.py`; `test/mcp_tools_test.py` | Model-action adapters must remain disabled absent authenticated human approval |
| OWASP LLM10 | Model/token or network retry exhausts cost or time | `scripts/api-spend-guard.mjs`; `test/api-integration-contracts.test.mjs` | Live spend, rate-limits and continuity need operational observations |
| MITRE ATLAS | Poisoned source or source outage creates a false clear | `scripts/adverse-media.mjs`; `test/adverse-media.test.mjs`; `scripts/screening-assurance.mjs` | **Open:** last live run retained one uncovered subject; fail-closed status must stay red |
| MITRE ATT&CK | Automation credential compromise / CI tampering | `.github/workflows/gitleaks.yml`; `test/workflow-hardening.test.mjs` | Independent alert inventory and real incident drill evidence required |

**Important evidence distinction:** A test that validates a source parser or rejects prompt injection does not mean a news provider is reachable. The 2026-10-13 completed daily screen covered 990/991 subjects through at least one adverse-media backbone; sanctions and PEP were operational. It still correctly failed Screening Assurance because **one subject had no verifiable adverse-media source response**.

## Pre-approval gate for any deferred integration

A new runtime framework requires, *before dependency installation or deployment*: an approved business use case; updated AI asset/control and threat registers; data classification, vendor/privacy and residency position; named owner; bounded budget; read-only/action permissions; red-team evaluation; false-negative/recall validation for AML screening; reproducible tests and rollback; and documented human MLRO authorization. Choose the minimal number of frameworks satisfying that use case, not all nine.

No new production model, credential, network service, embedding store, agent autonomy or MLRO decision authority is approved by this mapping.
