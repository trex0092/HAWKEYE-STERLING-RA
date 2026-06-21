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
| **Asana tasks** | Completed-assessment deliveries (Risk Assessments project), watcher alerts (Regulations/Governance/Sanctions), renewals (Compliance Renewals), customer records (Customer Database) | Per Asana workspace policy + the firm's AML record-keeping obligation (**5 years**, FDL No.10/2025 / FATF R.11) | Managed in Asana; tasks are an external audit trail, not the primary record | Server-held `ASANA_ACCESS_TOKEN` (never in browser); CORS-guarded Netlify functions |
| **Git history** | Reference risk data, regulatory/sanctions fingerprint state (`data/*-state.json`), AI drafts (`docs/research/auto`), this governance set | Permanent (version-controlled audit trail) | Immutable by design — provides lineage, not erasure | GitHub repo access controls; CodeQL + Gitleaks in CI |
| **Anthropic API (Advisor + reg-draft)** | The officer's question + any pasted context, transiently, per request | **Transient** — processed to generate a response; **no training on inputs**; the function persists nothing server-side | Nothing to erase server-side; do not paste data that must not leave the device | TLS in transit; server-held API key; 26 s timeout |

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

## Open items (Layer 2 residual gaps)

- **Formal DPIA** covering the on-device processing and the Anthropic processing (GDPR/PDPL).
- **Advisor bias review** — a periodic qualitative review of Advisor outputs for skew across
  jurisdictions/typologies (the structural invariants are checked by `scripts/advisor-eval.mjs`; bias
  is a human-judgement review, tracked here).

> **Guidance for officers.** Treat the Advisor as decision support. Do not paste material into it that
> must not leave the device. The authoritative record of any assessment is the on-device register and
> its signed report — not an Advisor conversation.
