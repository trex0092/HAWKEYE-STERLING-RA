# AI System Inventory (AIMS A.4.2)

All AI / automated-decision components in scope, their purpose, data, and controls.
Reviewed at least annually and on change.

## In-scope systems

| ID | Component | Purpose | Type | Human oversight |
|---|---|---|---|---|
| SCR-1 | `screen.py` — unified screening engine | Daily sanctions + adverse-media + PEP screening of every customer and UBO | Rules + fuzzy match + optional LLM triage | MLRO reviews & files every alert |
| AI-1 | `ai.py` — AI layer | Risk rating, adverse-media triage, summaries, transliteration, STR draft | Deterministic + opt-in LLM (grounded classification only) | All outputs decision-support |
| AG-1 | `agents.py` — agentic operating model | Agent identity, least-privilege authorization, credential broker, QA gate | Deterministic orchestration | No agent decides/files |
| WEB-1 | `index.html` / `advisor.html` / `console.html` | On-device entity risk assessment, cited Q&A | Rules-based scoring + retrieval | Analyst-driven |

## Models / external AI services

| Service | Use | Provider | Data sent | Gating |
|---|---|---|---|---|
| Anthropic Claude (`AI_MODEL`) | Grounded adverse-media triage (classify real headlines); optional summaries | Anthropic | Subject name + a single news headline (no full customer record) | **Opt-in** via `ANTHROPIC_API_KEY`; off ⇒ no egress |
| Wikidata `wbsearchentities` | PEP auto-detection | Wikimedia (CC0) | Individual name | Always-on, public API |
| Google News RSS | Adverse-media search | Google | Subject name + risk terms | Always-on, public feed |

## Data sources (inputs)

| Source | Content | Classification |
|---|---|---|
| Asana "Customer Database" (GID 1214107620220121) | Customers, KYC notes, UBOs | Confidential (customer PII) |
| OFAC SDN · UN · EU FSF · UK OFSI · UAE EOCN · Canada SEMA | Designation lists | Public |
| Google News RSS / Wikidata | Adverse media / PEP | Public |

## Outputs / destinations

| Output | Destination | Retention |
|---|---|---|
| Unified daily report + MLRO case subtasks | Asana "Ongoing Monitoring" (GID 1213914392047129) | 10 years |
| Confirmed-hit comment | Customer's Asana task | 10 years |
| Delta-state (what was reported) | `data/screen-delta-state.json` (git) | git history |

## Boundaries (out of scope)
Transaction/payment monitoring; identity-document verification; model training
(no models are trained — the LLM is external and used read-only).
