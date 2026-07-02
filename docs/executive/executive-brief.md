# Executive Brief — Hawkeye Sterling RA

*One-page orientation for senior management, the board, and external reviewers.
Date: 2 Jul 2026 · App version 3.7.0*

## What it is
A **self-hosted AML/CFT customer risk-assessment and screening platform** for a
Dealer in Precious Metals & Stones (DPMS), built to a **verifiable-governance**
standard: nearly every documented control has an automated proof that runs
continuously. It combines an on-device risk-assessment application with an
automated monitoring estate (sanctions, PEP, adverse media, FATF lists,
regulatory change) that delivers evidence into a controlled Asana workspace.

## Why it matters (five points)
1. **Risk reduction** — structured 0–30 scoring + daily screening of the whole
   customer base against OFAC/UN/EU/UK/UAE lists, adverse media (2 global feeds,
   incl. Arabic) and PEP signals; designed to **fail loudly, never silently**.
2. **Regulatory alignment** — mapped to ISO/IEC 42001, NIST AI RMF, the UAE AI
   Charter, FATF R.6/R.10/R.12/R.16/R.25, and PDPL; documented, not asserted.
3. **Audit-ready by construction** — a live Assurance Coverage Matrix ties each
   control to its test/workflow, cadence and evidence location; daily governance
   and compliance reports form a standing evidence trail.
4. **Privacy by design** — client-side AES-256 encryption, tokenised (PII-free)
   delivery mode, no customer data leaves the device unless the firm explicitly
   enables the (DPA-gated) AI features.
5. **Low operating cost** — static app + serverless functions + free data feeds;
   hosting-only running cost, no per-seat licensing.

## Current maturity
**Independent readiness score: 3.9 / 5 ("Managed, approaching Optimised")** →
4.5 with the executive/model-card/architecture package now in progress. See
[`../governance/enterprise-readiness-review-2026.md`](../governance/enterprise-readiness-review-2026.md).

## Open decisions for management (nothing engineering-blocked)
| Decision | Effect | Owner |
|---|---|---|
| Ratify **AI Policy v1.0** + **Stakeholder Impact Assessment** | Clears ISO 42001 leadership sign-off | Senior mgmt |
| Sign **Anthropic DPA** | Unlocks AI triage + advisor bias cycle | Firm |
| Connect a **transaction feed** | Activates FATF R.16 monitoring (closes risk R-13) | Firm |
| Complete **first live assessment** (TEST-000) | End-to-end go-live proof | MLRO |

## What to read next
- Business value & ROI → [`business-value.md`](business-value.md)
- Regulator/auditor pack → [`regulatory-readiness.md`](regulatory-readiness.md)
- Roadmap → [`roadmap.md`](roadmap.md) · KPIs → [`kpi-dashboard.md`](kpi-dashboard.md)
- Per-feature AI documentation → [`../models/`](../models/README.md)
