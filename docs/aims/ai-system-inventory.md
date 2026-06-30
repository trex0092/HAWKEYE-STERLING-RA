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

## Decision-impact classification

Each AI/automated component is tiered by the weight of the decision it influences,
per FDL 10/2025 expectations. **No component is autonomous** — the highest tier any
AI surface reaches is *significant-decision support*; none is a *critical decision*
that executes without a human (see safeguards column).

| ID | Tier | Rationale | Required safeguards (in place) |
|---|---|---|---|
| AG-1 | **Administrative automation** | Orchestration/authorization plumbing; makes no risk call | Least-privilege, QA gate, deterministic |
| WEB-1 | **Administrative automation** | Deterministic rules + retrieval; analyst owns the outcome | Contributing factors shown; analyst-driven |
| AI-1 | **Significant-decision support** | Sharpens risk rating / adverse-media triage / STR drafts | Decision-support only; `[AI]`-labelled; deterministic fallback; MLRO owns the call |
| SCR-1 | **Significant-decision support** | Flags sanctions/PEP/adverse-media hits feeding CDD/EDD | **MLRO sign-off before acting**; non-Latin ⇒ MANUAL REVIEW; periodic bias/false-positive review |
| — | **Critical decision (autonomous, legal/serious effect)** | **None.** No AI surface auto-decides, blocks, files, or de-risks a customer without a human. | N/A — if ever introduced, requires DPIA refresh, explicit lawful basis, and senior-management approval before deployment |

> **Flag.** Any future change that would let an AI surface produce an output with
> legal or serious effect *without* a human review step moves it into the **critical
> decision** tier and must not ship until the safeguards in the last row are met.

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
