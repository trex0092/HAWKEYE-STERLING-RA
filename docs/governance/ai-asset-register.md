# AI Asset Register — Hawkeye Sterling

**Layer 1 of the 6 Layers of Agentic AI Governance — AI Discovery & Inventory.**
*"You can't secure what you can't see."*

**Owner:** MLRO (accountable) · Compliance Engineering (operational)
**Source of truth:** [`data/ai-assets.json`](../../data/ai-assets.json) (machine-readable; this page is the human view)
**Review cadence:** Quarterly, and on any change to model id, provider, prompt charter, or data flow.
**Last reviewed:** 2026-07-15

> **Scope note.** The Hawkeye Sterling RA **scoring engine** (`index.html`), the operations console
> (`console.html`), and every watcher (`fatf-watchdog`, `sanctions-watch`, `sanctions-screen`,
> regulatory-watch *detection*, `daily-brief`, the expiry notifier) are **deterministic, rules-based
> — not AI**, and are deliberately excluded from this register. Only generative-AI/LLM surfaces are
> inventoried here.

---

## Inventory

| ID | Asset | Provider / Models | Risk tier | EU AI Act class | Oversight | Status |
|----|-------|-------------------|-----------|-----------------|-----------|--------|
| `advisor` | **MLRO Advisor** (`netlify/functions/brain-soul.js` → `advisor.html`) | Anthropic — Claude (haiku/sonnet/opus by mode) | **MEDIUM** | Limited risk (transparency) | Human-in-the-loop | active |
| `reg-draft` | **Regulatory-Watch AI Draft** (`scripts/reg-draft.mjs`) | Anthropic — Claude | **LOW** | Minimal risk | Human-on-the-loop | optional (off unless `ANTHROPIC_API_KEY` set) |
| `ai-triage` | **Adverse-Media LLM Triage** (`ai.py`) | Anthropic — Claude (haiku, classification only) | **MEDIUM** | Minimal risk | Human-in-the-loop | dormant (fail-closed: `LLM_TRIAGE=0` until the Anthropic DPA is executed) |

---

## 1. MLRO Advisor (`advisor`)

- **What it is:** An optional, on-request advisory assistant for the MLRO/Compliance Officer across
  AML/CFT, sanctions, operational and reporting questions. Served by `brain-soul.js` calling the
  Anthropic API (key held server-side, never in the browser). 16 personas; three modes (speed/
  balanced/deep) routing to Haiku/Sonnet/Opus respectively.
- **Risk tier — MEDIUM.** It is **decision support only**: it never decides, files, freezes, or
  records. The worst-case failure is a misleading suggestion, mitigated by mandatory MLRO review and
  the charter guardrails. It is therefore **not** an EU-AI-Act high-risk system — the human makes and
  records the compliance decision.
- **Agent classification:** Assistive generative-AI, **non-agentic** (no tools, no autonomous
  actions, no writes).
- **Controls:** `SOUL_CHARTER` (prohibitions P1–P10), refusal protocol, prompt-injection resistance,
  post-output tipping-off guard (Article 25, FDL 10/2025), 26 s timeout, audit line on every
  response, CORS origin guard. **Assurance:** `test/advisor-assurance.test.js` (offline, in CI) and
  the key-gated live eval `scripts/advisor-eval.mjs` (weekly).
- **Data flow & retention:** transient; Anthropic API usage with no training on inputs; the function
  persists nothing server-side. See [`data-retention.md`](data-retention.md).

## 2. Regulatory-Watch AI Draft (`reg-draft`)

- **What it is:** An optional drafting aid inside the Regulatory Watch workflow. When a public
  regulatory source changes **and** `ANTHROPIC_API_KEY` is set, it drafts a proposed update for human
  review. It reads public regulatory text only — **no customer data**.
- **Risk tier — LOW.** Off by default; output is a reviewed draft committed for human ratification;
  **never auto-published** (detection is automatic, the wording change stays a reviewed decision).
- **Oversight:** human-on-the-loop — every draft is ratified or discarded in a commit/PR.

## 3. Adverse-Media LLM Triage (`ai-triage`)

- **What it is:** Grounded relevance/severity classification of real, pre-existing adverse-media
  headlines inside a screening run (`ai.py`). It judges provided text only; the raw headline and
  link are always attached, and no generative prose ever enters a filed report
  (`REPORT_ALLOW_LLM=0`).
- **Risk tier — MEDIUM.** When enabled it sends a subject's **name + one public headline** to the
  processor (a cross-border transfer of personal data), so it is **fail-closed OFF**
  (`LLM_TRIAGE=0`) until the Anthropic DPA is executed — see
  [`../aims/anthropic-dpa-execution-pack.md`](../aims/anthropic-dpa-execution-pack.md).
- **Controls:** double gate (`ANTHROPIC_API_KEY` **and** `LLM_TRIAGE=1`), `GROUNDING_SYSTEM`
  prompt-security contract, in-code data minimisation (name + single headline only), degrade-loudly
  fallback to the deterministic path, mandatory MLRO review of every output.
- **Oversight:** human-in-the-loop — labels are decision support attached to raw evidence.

---

## Onboarding a new AI surface (process)

Before any new AI/LLM capability is deployed it **must**:

1. Be added to [`data/ai-assets.json`](../../data/ai-assets.json) with an owner and a **risk tier**.
2. Be classified (agentic vs assistive; EU AI Act tier) and have its data flow + retention documented.
3. Have guardrails and an **assurance test** (extend `test/advisor-assurance.test.js`) before merge.
4. Be reflected in the 6-layer mapping
   ([`agentic-ai-governance-6layers-2026.md`](agentic-ai-governance-6layers-2026.md)).

This register is the control that prevents **Shadow AI** — undocumented AI running in production.
