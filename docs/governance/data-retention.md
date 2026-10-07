# Data Retention & Handling — Hawkeye Sterling

**Layer 2 of the 6 Layers of Agentic AI Governance — Data Governance Foundation.**
*"Good data powers trustworthy AI."*

**Owner:** MLRO (accountable) · Compliance Engineering (operational)
**Last reviewed:** 2026-06-21
**Related:** [`ai-asset-register.md`](ai-asset-register.md) · [`ai-governance-gap-analysis-2026.md`](ai-governance-gap-analysis-2026.md)

This note documents **where data lives, how long it is kept, and who controls it** across the suite.
The suite is **zero-backend and offline-capable**: assessment data is created and held on the
compliance officer's own device, with explicit, auditable relays to Asana and git.

---

## Data stores

| Store | What it holds | Retention | Control / erasure | Protection |
|-------|---------------|-----------|-------------------|------------|
| **On-device `localStorage`** | Assessment drafts (`hsra.draft.v2`), register (`hsra.register.v1`), risk-data overrides (`hsra.riskdata.v1`), activity log (`hsra.audit.v1`), Asana delivery receipts | Held until the officer deletes/exports; **user-controlled** | In-app **delete** (`register.delete`) and **export** (JSON portability); clearing the browser profile erases all | **AES-256-GCM at rest** (WebCrypto), PBKDF2-derived key, passphrase gate, 15-min idle auto-lock |
| **Asana tasks** | Completed-assessment deliveries (HAWKEYE STERLING APP project), watcher alerts (Ongoing Monitoring), renewals (Compliance Renewals), customer records (Customer Database) | Per Asana workspace policy + the firm's AML record-keeping obligation (**5 years**, FDL No.10/2025 / FATF R.11) | Managed in Asana; tasks are an external audit trail, not the primary record | Server-held `ASANA_ACCESS_TOKEN` (never in browser); CORS-guarded Netlify functions |
| **Git history** | Reference risk data, regulatory/sanctions fingerprint state (`data/*-state.json`), AI drafts (`docs/research/auto`), this governance set | Permanent (version-controlled audit trail) | Immutable by design — provides lineage, not erasure | GitHub repo access controls; CodeQL + Gitleaks in CI |
| **Anthropic API (Advisor + reg-draft)** | The officer's question + any pasted context, transiently, per request | **Transient** — processed to generate a response; **no training on inputs**; the function persists nothing server-side | Nothing to erase server-side; **PII guard** warns before identifiers leave the device and flags them (`piiFlagged`) | TLS in transit; server-held API key; abort budget inside the platform execution cap; client PII warning |

---

## Principles

- **Data minimisation.** The Advisor caps inputs (question ≤ 4000 chars, context ≤ 2000 chars). No
  telemetry or analytics is collected — by design (privacy: client data stays on device).
- **Lineage.** Reference risk data is versioned (`RISK_DATA_VERSION`) and changes flow through git;
  regulatory/sanctions changes are fingerprinted in `data/*-state.json` so every change is traceable.
- **Quality.** Watcher inputs are fingerprinted and markup-only churn is ignored; fetch errors are
  recorded but never counted as changes (no false alerts). The AI asset register is schema-checked.
- **Third-party data risk.** Anthropic is the only LLM processor (see the asset register); regulatory
  sources are public. Asana is the task/record processor under the workspace agreement.

## Current residual items

The former DPIA and Advisor-bias-review gaps are no longer open: the 2026 DPIA is on file and the
2026-10-01 quarterly Advisor Bias Eval completed with 0 findings and 0 eval errors. Current residual
data-governance items are tracked rather than hidden here:

- **Vendor / cross-border evidence:** Asana and Anthropic assurance records still require the
  confirmations in open-actions items 35 and 36; Composio remains gated by item 29 and the transfer
  position remains subject to item 11.
- **Confidential endpoint identity:** the shared-token controls protect the configured path but are not
  verified per-user authentication or RBAC; open-actions item 20 is the closure path.
- **Persistence and recovery objective:** Asana mirrors provide off-device operational copies, while a
  dedicated authenticated persistence tier and explicit assessment-data RPO/RTO remain open under
  item 23.

> **Guidance for officers.** Treat the Advisor as decision support. Do not paste material into it that
> must not leave the device. The authoritative record of any assessment is the on-device register and
> its signed report — not an Advisor conversation.
