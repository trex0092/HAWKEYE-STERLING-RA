# Tool & Connector Register — MCP-class integration surfaces

**What may be invoked, by whom, with which secret, and how it is switched off.**

**Owner:** MLRO (accountable) · Compliance Engineering (operational)
**Source of truth:** [`data/tool-surfaces.json`](../../data/tool-surfaces.json) (machine-readable; this page is the human view)
**Enforcement:** [`test/tool-register.test.mjs`](../../test/tool-register.test.mjs) (CI, every pull request)
**Review cadence:** quarterly with the [AI asset register](ai-asset-register.md), and on any new action, credential or egress host.
**Last reviewed:** 2026-07-28

> **Why this register exists.** Three registers now sit side by side and answer
> different questions. [`ai-asset-register.md`](ai-asset-register.md): *which AI
> surfaces exist.* [`third-party-register.md`](../aims/third-party-register.md):
> *which processors we contract with, what data they get, under which DPA.* This
> one: *what the system may actually invoke* — the capability view. As tool and
> connector protocols (MCP among them) make it trivial to grant a model a live
> reach into systems of record, the gap between "we have a vendor list" and "we
> know what can be called, by which identity, with which credential" is where
> control is lost.

---

## 1. Posture: the two claims that matter

**No model in this suite can invoke anything.** Every model call is text-in /
text-out. No call declares `tools`, `tool_choice`, or any function-calling
parameter; the model classifies, drafts or advises, and deterministic code
decides what happens next. `test/tool-register.test.mjs` scans every model-API
caller and fails CI the moment a tool declaration appears while the register
says tool-calling is off — so re-opening that path is a reviewed code change,
never a quiet configuration flip.

**No MCP server is exposed and no MCP client ships.** Maintainers may reconcile
the Asana workspace through MCP tooling in their own assistant (see
[`asana-integration-audit.md`](../asana-integration-audit.md)); that acts as the
human, under the human's own credential, and any drift it creates is caught by
`scripts/asana-reconcile.mjs` like any other manual edit. **No repository secret
is ever handed to an MCP client.**

---

## 2. Action table — least privilege, enforced in code

The authority model lives in [`agents.py`](../../agents.py): each agent holds an
explicit allow-list, a credential broker is the single authority that hands out
a secret, and every grant *and denial* is logged. This table mirrors it; CI
fails if the two disagree in either direction.

| Action | Effect | Credential | Held by | Notes |
|---|---|---|---|---|
| `asana.read` | read | `ASANA_TOKEN` | IngestAgent | Load the live customer base |
| `asana.write` | write | `ASANA_TOKEN` | DeliveryAgent | Post the report. No decision authority |
| `llm.classify` | egress | `ANTHROPIC_API_KEY` | AdverseMediaAgent | Dormant while `LLM_TRIAGE=0` |
| `state.commit` | write | `GITHUB_TOKEN` | *(nobody)* | Declared in the broker, granted to no agent — a future grant is an explicit edit, not an omission |
| `lists.read` | read | — | SanctionsAgent | Public list downloads; no name sent |
| `web.read` | read | — | AdverseMediaAgent, PepAgent | Subject name is the query; no record leaves the runner |
| `match` | compute | — | SanctionsAgent | On-runner matching |
| `compute` | compute | — | RiskAgent, NetworkAgent | Deterministic scoring |
| `propose` | draft | — | CaseAgent | **Propose only** — no agent holds a filing action |
| `audit` | read | — | QAAgent | Pre-publish integrity gate |

**Invariants CI re-checks against `agents.py`, not just against this page:**
`asana.write` belongs to DeliveryAgent alone; `state.commit` is refused to
anyone but DeliveryAgent should it ever be granted; no agent can file, because
filing is an MLRO act; a denial is recorded as evidence rather than dropped.

**The Advisor is deliberately absent from this table.** It holds no action, no
credential beyond the server-held model key, and no write path. It answers and
stops — that is what makes it non-agentic in the asset register.

---

## 3. Connector surfaces

| Connector | Hosts | Credential | What leaves | Kill switch |
|---|---|---|---|---|
| **Anthropic** | `api.anthropic.com` | `ANTHROPIC_API_KEY` | Advisor: the officer's question. Triage: name + one headline. Reg-draft: public regulatory text | Unset the key · `LLM_TRIAGE=0` · `ADVISOR_ENABLED=false` · `REPORT_ALLOW_LLM=0` |
| **Asana** | `app.asana.com` | `ASANA_TOKEN` (Python) / `ASANA_ACCESS_TOKEN` (Node, Netlify) | Customer records — it is the system of record | Unset the token (the Python engine refuses to start; Node paths degrade to a GitHub issue) · revoke the PAT |
| **GitHub** | `api.github.com`, `github.com` | `GITHUB_TOKEN` | Run metadata, alert text | Per-job least-privilege permissions · harden-runner egress allow-lists |
| **Sanctions lists** | OFAC, UN, OFSI, OpenSanctions, Canada | — | **Nothing** — pull-only; matching is on-runner | `PEP_MIRROR_FALLBACK=0` · `ADVERSE_WATCHLIST=0` · `EOCN_MIRROR_CROSSCHECK=0`; empty core list = DEGRADED, never a silent clear |
| **Adverse media** | `news.google.com`, `api.gdeltproject.org`, `www.bing.com` | — | Subject name + risk terms as a query | `SCREEN_ADVERSE_MEDIA=0` |
| **PEP reference** | `www.wikidata.org` | — | Individual name as a query | `SCREEN_PEP=0` |
| **Entity reference** | `api.gleif.org`, `ws-public.interpol.int` | — | Entity/individual name as a query | Disable the individual check workflows |
| **Regulatory watch** | `www.fatf-gafi.org`, `web.archive.org` | — | Nothing; public pages by URL | Disable the workflow · remove the source from `data/reg-sources.json` |
| **Own site** | `hawkeye-sterling-ra.netlify.app` | — | Nothing beyond the probe | Disable site-health/currency · `PRIMARY_ORIGIN` / `ALLOWED_ORIGINS` bound the functions |

Two names, one workspace: the Python engine reads `ASANA_TOKEN` (required at
import — the engine refuses to start rather than degrade silently) while Node
and the Netlify functions read `ASANA_ACCESS_TOKEN`;
`.github/workflows/netlify-deploy.yml` bridges them. Both are secrets; neither
reaches the browser.

Vendor terms, DPA status, data residency and cross-border basis for these same
services are **not** repeated here — they live in
[`third-party-register.md`](../aims/third-party-register.md) and
[`dpia-2026.md`](dpia-2026.md), which remain the reference for the processor
relationship.

---

## 4. Onboarding a new tool, connector or MCP server

1. **Register it** — a row here: action, credential, egress host, kill switch.
2. **Vendor path** — if a new processor is involved, a row in
   [`third-party-register.md`](../aims/third-party-register.md) and a DPA.
3. **Privacy path** — if personal data crosses a new boundary, a DPIA delta
   ([`dpia-2026.md`](dpia-2026.md)) and, for a new jurisdiction, the
   [cross-border position](cross-border-transfer-position-2026.md).
4. **Authority** — if an agent gains the action, the least-privilege allow-list
   and `preflight_credentials()` in `agents.py` change with it.
5. **Approval** — MLRO approval recorded in the change.

CI fails at step 1, before the question of approval arises: an action, agent, or
credential that exists in code but not here (or here but not in code) is a red
build.

---

## 5. Framework mapping

| Framework | Clause | How this register satisfies it |
|---|---|---|
| ISO/IEC 42001 | A.4.2 (AI system resources), A.10.2 (suppliers), A.9.2 (responsible use) | The capability inventory that sits beneath the asset and vendor registers |
| NIST AI RMF | MAP 4.1, GOVERN 6.1 (third-party risk) | Integration surfaces enumerated with owner, credential and revocation path |
| UAE "Securing Agentic AI" | Agent Identity & Authorization · Observability | Allow-list per agent, brokered credentials, audited denials — enforced in `agents.py` and re-checked in CI |
| EU AI Act (voluntary) | Art. 12-style record-keeping | Every action an automated pipeline can take is documented and logged |

---

**Related:** [`ai-asset-register.md`](ai-asset-register.md) ·
[`prompt-lifecycle-register.md`](prompt-lifecycle-register.md) ·
[`third-party-register.md`](../aims/third-party-register.md) ·
[`agentic-ai-governance-6layers-2026.md`](agentic-ai-governance-6layers-2026.md)
