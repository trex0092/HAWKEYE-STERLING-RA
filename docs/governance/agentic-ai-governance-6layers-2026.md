# 6 Layers of Agentic AI Governance — Alignment (2026)

**Subject:** Hawkeye Sterling suite (RA scoring engine, Advisor, operations console) **and** the
Asana automation layer (GitHub Actions watchers + assessment delivery).
**Assessed against:** *6 Layers of Agentic AI Governance — from AI Visibility to AI Assurance.*
**Date:** 2026-06-21 · **Prepared by:** Compliance engineering · **Owner:** MLRO

**Status key:** ✅ strong · 🟡 partial / analogue · 🔴 weak (applicable, open) · N-A not applicable.

> **Companion docs:** the AI inventory lives in [`ai-asset-register.md`](ai-asset-register.md) (L1),
> retention in [`data-retention.md`](data-retention.md) (L2), and the tile-level security posture in
> [`ai-governance-gap-analysis-2026.md`](ai-governance-gap-analysis-2026.md).

---

## What is and isn't AI here

The **RA scoring engine** (`index.html`), the **operations console** (`console.html`), and every
**Asana watcher** (`fatf-watchdog`, `sanctions-watch`, `sanctions-screen`, regulatory-watch
*detection*, `daily-brief`, the expiry notifier, assessment delivery via `asana-task.js`) are
**deterministic, rules-based automations — not AI**. They are auditable code on schedules, not
models. The only **AI surfaces** are the **MLRO Advisor** (`brain-soul.js` → Anthropic Claude) and
the optional **Regulatory-Watch AI draft** (`reg-draft.mjs`) — both inventoried in the asset register.

This matters for the framework: the *generative-AI* obligations (Layer 4 assurance, AI inventory in
Layer 1) bite on the Advisor; the Asana automations are governed as **deterministic data
automations** (lineage, quality, audit) rather than as models.

---

## Scorecard

| # | Layer | Before | After this change |
|---|-------|--------|-------------------|
| 1 | AI Discovery & Inventory | 🟡 | ✅ register + risk tiering added |
| 2 | Data Governance Foundation | 🟡 | 🟡→✅ retention/lineage documented (DPIA still open) |
| 3 | Security & Resilience | ✅ | ✅ |
| 4 | Model & Agent Assurance | 🔴 | 🟡→✅ red-team + charter-drift tests + live eval added |
| 5 | Human Oversight | ✅ | ✅ |
| 6 | Governance, Compliance & Audit | ✅ | ✅ |

---

## Layer 1 — AI Discovery & Inventory
*"You can't secure what you can't see."*

| Sub-block | Status | Evidence |
|---|---|---|
| AI asset register | ✅ | [`data/ai-assets.json`](../../data/ai-assets.json) + [`ai-asset-register.md`](ai-asset-register.md) |
| Shadow-AI detection | ✅ | Register `shadow_ai_note` + onboarding gate; small, fully-enumerated codebase |
| Agent classification | ✅ | Each asset classified assistive/agentic + autonomy described |
| Risk tiering | ✅ | Advisor = MEDIUM, reg-draft = LOW, with rationale |
| Ownership assignment | ✅ | MLRO accountable / Compliance Engineering operational |

**Verdict:** ✅. The register is the new control; any future AI surface must be added before deploy.

## Layer 2 — Data Governance Foundation
*"Good data powers trustworthy AI."*

| Sub-block | Status | Evidence |
|---|---|---|
| Data lineage | ✅ | Versioned risk data (`RISK_DATA_VERSION`); fingerprint state in `data/*-state.json`; git history |
| Data quality | ✅ | Watcher fingerprinting ignores markup churn; fetch errors never counted as changes; `ai-assets.json` schema |
| Bias screening | 🟡 | Deterministic engine has no model bias; Advisor bias is a tracked human review ([`data-retention.md`](data-retention.md)) |
| Retention controls | 🟡→✅ | [`data-retention.md`](data-retention.md): on-device, Asana, git, Anthropic stores; 5-yr AML record-keeping |
| Third-party data risk | ✅ | Anthropic (sole LLM processor) + Asana documented; regulatory sources are public |

**Verdict:** 🟡→✅ on documentation. Residual: a formal **DPIA**.

## Layer 3 — Security & Resilience
*"Protect AI systems, data, and tools."*

| Sub-block | Status | Evidence |
|---|---|---|
| Identity & access mgmt | 🟡 | Device passphrase gate + idle auto-lock (`index.html` security module). No backend IdP by design |
| Least privilege | ✅ | Scoped Action permissions (e.g. `contents: write, issues: write`); function CORS origin guard |
| Agent authentication | ✅ | Server-held `ANTHROPIC_API_KEY` / `ASANA_ACCESS_TOKEN`; never reach the browser |
| Secure tool access | ✅ | All Asana/Anthropic calls server-side (Netlify functions / Actions) |
| Cyber-resilience controls | ✅ | CSP + HSTS + anti-clickjacking (`netlify.toml`); CodeQL, Gitleaks, dependency-review in CI; AES-256 at rest |

**Verdict:** ✅ (backend RBAC/MFA/SSO N-A for a single-operator, zero-backend tool).

## Layer 4 — Model & Agent Assurance
*"Validate performance. Detect issues early."*

| Sub-block | Status | Evidence |
|---|---|---|
| Model validation | 🟡 | Underlying models are Anthropic's responsibility; we validate **our usage** of them |
| Agent testing | ✅ | [`test/advisor-assurance.test.js`](../../test/advisor-assurance.test.js): handler paths, 503/400/403 guards, audit line |
| Red teaming | ✅ | Tipping-off red-team battery (must-catch) + false-positive control in the same test |
| Drift monitoring | ✅ | Charter-integrity / model-routing pins (offline) + live [`scripts/advisor-eval.mjs`](../../scripts/advisor-eval.mjs) via [`advisor-eval.yml`](../../.github/workflows/advisor-eval.yml) (weekly) |
| Performance evaluation | 🟡→✅ | Live eval asserts P1/P4/P7/P9/P10 guardrails hold against the real model; regressions alert to Asana |

**Verdict:** 🔴→✅. This was the weak layer; the red-team + charter-drift tests and the key-gated live
eval close it. *(The red-team battery already surfaced and fixed two real gaps in the live tipping-off
guard — reversed-order "a SAR was filed" and "we are reporting".)*

## Layer 5 — Human Oversight
*"Humans decide. AI executes."* (here: AI **advises**; humans decide and execute.)

| Sub-block | Status | Evidence |
|---|---|---|
| Human-in-the-loop | ✅ | Every assessment is a human decision; Advisor is advisory only |
| Human-on-the-loop | ✅ | Watchers/AI-draft surface changes for human ratification; reg-draft never auto-publishes |
| Escalation protocols | ✅ | PROHIBITED / mandatory-EDD floors; MLRO four-eyes alerts; hard outcomes |
| Override authority | ✅ | One-way analyst override + mandatory justification; never weakens PROHIBITED |
| Accountability mapping | ✅ | MLRO sign-off + dual attestation; audit line "decision support, not a decision. MLRO review required." |

**Verdict:** ✅.

## Layer 6 — Governance, Compliance & Audit
*"Prove it. Improve it. Assure it."*

| Sub-block | Status | Evidence |
|---|---|---|
| NIST AI RMF | 🟡 | Mapped at framework level (this doc + gap analysis); not a formal conformity assessment |
| ISO 42001 | 🟡 | Prompt-charter-level AI management controls; open items tracked |
| EU AI Act | ✅ | Advisor classed **limited risk** (transparency) in the register; not high-risk (human decides) |
| Audit trails | ✅ | Tamper-evident hash-chained log (`index.html`); git + Asana trails; Advisor audit line |
| Continuous assurance | ✅ | Daily brief proves monitoring ran; daily/weekly watchers; CI on every push incl. assurance tests |

**Verdict:** ✅ operationally; residual: formal NIST/ISO conformity mapping.

---

## Overall verdict

**Broadly aligned.** Strong on Security (3), Human Oversight (5), and Governance/Audit (6); Discovery
(1) and Data Governance (2) are now documented; and **Model & Agent Assurance (4)** — previously the
weak point — now has offline red-team + charter-drift tests in CI and a key-gated live eval with
Asana alerting. Remaining open items are a formal **DPIA** (L2) and formal **NIST AI RMF / ISO 42001
conformity** mapping (L6); both are appropriate next steps rather than gaps in day-to-day control.

**Re-review** this document whenever an AI surface is added/changed (update the register first), when
the Advisor's models change, or if a backend is introduced.
