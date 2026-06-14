# AI Governance & Security — Gap Analysis (2026)

**Subject application:** Hawkeye Sterling — Entity Risk Assessment (RA)
**Assessed against:** *AI Governance & Security Periodic Table (2026)* — 36 building blocks
**Date:** 2026-06-14 · **Prepared by:** Compliance engineering

---

## 1. Scope and framing

The periodic table enumerates building blocks for securing **enterprise AI/LLM
systems** (model drift, hallucination, vector databases, identity providers,
data-protection pipelines, and so on).

Hawkeye Sterling RA is **not an AI system**. It is a single-file static web app
(`index.html`) with:

- **no AI/LLM** — scoring is a deterministic, rules-based AML/CFT engine;
- **no backend / no server-side state** — it runs entirely in the browser and
  deploys to a static host (Netlify);
- **no user accounts** — a single compliance officer operates it on their device;
- **two thin serverless functions** (`netlify/functions/*`) whose only job is to
  relay completed-assessment and risk-data-backup events to Asana with a
  server-held token.

Consequently, a large share of the table is **Not Applicable (N-A)**: there is no
model to drift, bias, hallucinate, or red-team; no vector store; no data pipeline;
and no backend on which to host an enterprise identity provider. Those tiles are
marked N-A with the architectural precondition that would make them relevant.

This release **closes the genuinely-applicable gaps** for an on-device tool:
encryption-at-rest, a passphrase access gate with idle auto-lock, a tamper-evident
activity log, and edge/function hardening. See §3.

**Status key:** ✅ implemented · 🟡 partial / analogue · ❌ absent (applicable) ·
N-A not applicable to a non-AI, on-device app.

---

## 2. Tile-by-tile assessment

### Identity & Access Control

| Tile | Intent | Status | Evidence | Applicability & recommendation |
|---|---|---|---|---|
| **RBAC** | Role-based permissions | N-A | — | No backend / multi-user model. A device passphrase gate now exists (`index.html` security module). True RBAC requires a backend IdP. |
| **ABAC** | Attribute-based access | N-A | — | Same precondition as RBAC. |
| **MFA** | Multi-factor auth | N-A → 🟡 | passphrase gate | One knowledge factor (passphrase) added. True MFA needs a backend + second factor. |
| **SSO** | Federated sign-on | N-A | — | No accounts; nothing to federate. Relevant only with a backend. |
| **IAM** | Central identity mgmt | 🟡 | `initSecurity`, `secSubmit` | Device-level access control added (passphrase unlock). Centralised IAM needs a backend. |
| **ZTA** | Zero-trust / verify always | 🟡 | idle auto-lock (`secLock`), function origin guard, edge headers | Session re-locks on inactivity; functions verify origin per request; CSP/headers at the edge. Full ZTA needs network identity. |

### Data Protection

| Tile | Intent | Status | Evidence | Applicability & recommendation |
|---|---|---|---|---|
| **DLP** | Prevent data leakage | 🟡 | on-device only; no third-party tracking; encryption-at-rest | Data never leaves the device except the explicit Asana relay (server-token). No exfiltration surface. |
| **MASK** | Mask/obfuscate sensitive data | 🟡 | encryption-at-rest | Stored data is unreadable without the passphrase. No field-level UI masking (low value for a single-operator tool). |
| **ENC** | Encryption at rest & in transit | ✅ | AES-256-GCM via WebCrypto (`encryptStr`/`SS`); HSTS + TLS (`netlify.toml`) | Implemented this release. PBKDF2-derived key; per-write random IV. |
| **TOKEN** | Tokenization | N-A | — | No tokenization need; the app holds minimal, locally-scoped data. |
| **PIPE** | Secure data pipelines | N-A | — | No data pipelines (no backend ingestion). |
| **VDB** | Secure vector database | N-A | — | No embeddings / vector store (no AI). |

### Risk Management

| Tile | Intent | Status | Evidence | Applicability & recommendation |
|---|---|---|---|---|
| **RISK** | Risk scoring | ✅ | `computeAssessment` | Core feature — but scores **customer/AML** risk, not AI risk. |
| **DRIFT** | Model drift detection | N-A | — | No model. (FATF Watchdog detects *list* changes, a data-freshness analogue.) |
| **BIAS** | Bias detection | N-A | — | Deterministic rules; methodology bias is reviewed by humans, not a model. |
| **HALL** | Hallucination detection | N-A | — | No generative model. |
| **REDT** | Red teaming | N-A → 🟡 | CodeQL SAST (`.github/workflows/codeql.yml`), security review skill | No AI to red-team; application-security testing exists. |
| **THREAT** | Threat intelligence | 🟡 | CSP, security headers, origin guard | Application threat-surface hardened. No AI-specific threat intel. |

### Monitoring & Observability

| Tile | Intent | Status | Evidence | Applicability & recommendation |
|---|---|---|---|---|
| **MON** | System monitoring | 🟡 | `.github/workflows/site-health.yml` | Weekly headless-Chrome uptime/compute check on the live site. |
| **ANOM** | Anomaly detection | N-A | — | No runtime telemetry to analyse. |
| **LOG** | Logging | ✅ | tamper-evident activity log (`auditAppend`) | Implemented this release: hash-chained local log of key actions. |
| **LAT** | Latency monitoring | N-A | — | No server request path to measure. |
| **USAGE** | Usage analytics | N-A | — | No telemetry **by design** (privacy: client data stays on device). |

### Audit & Accountability

| Tile | Intent | Status | Evidence | Applicability & recommendation |
|---|---|---|---|---|
| **AUDIT** | Auditability | ✅ | screening evidence, git/Asana trail, risk-data override audit fields, new activity log | Strong. |
| **TRACE** | Traceability | ✅ | per-factor breakdown, override reasons, hash-chained log | Decisions are traceable to inputs and overrides. |
| **RCause** | Root-cause analysis | 🟡 | activity log supports investigation | No formalised RCA workflow; the log is the substrate for one. |
| **ESC** | Escalation | ✅ | prohibited / mandatory-EDD floors, analyst override | High-risk cases escalate to human reviewers / EDD. |
| **APPROVE** | Approval systems | ✅ | first/second-line sign-off & attestation blocks | Human approval before completion. |
| **HITL** | Human-in-the-loop | ✅ | entirely human-driven; analyst override; narrative | Every outcome is a human decision. |
| **PERF** | Performance tracking | N-A | — | No model accuracy/efficiency to track. Assessment quality is governed by review cycles. |
| **RESP** | Responsibility mapping | ✅ | MLRO ownership in sign-off | Ownership of the decision is recorded. |

### Compliance & Governance

| Tile | Intent | Status | Evidence | Applicability & recommendation |
|---|---|---|---|---|
| **DOC** | Documentation | ✅ | `README.md`, this report, `docs/research/`, `.env.example` | Well documented. |
| **POLICY** | Policy enforcement | 🟡 | firm policies cited by name in narratives; CSP/headers enforce technical policy | Business policies are *referenced*, not technically *enforced* in-app; edge policy now enforced. |
| **ISO42K** | ISO/IEC 42001 (AI mgmt) | N-A | — | An **AI** management-system standard; no AI in scope. AML/CFT governance is the applicable regime. |
| **AIACT** | EU AI Act | N-A | — | No AI system; the app is not within the AI Act's material scope. |
| **GDPR** | Data protection law | 🟡 | on-device storage, encryption-at-rest, export (portability) & register delete (erasure), no trackers | Privacy-by-design posture; formal DPIA/records would complete it. |

---

## 3. What changed in this release (gaps closed)

| Control | Tiles advanced | Implementation |
|---|---|---|
| **Encryption-at-rest** | ENC ✅, MASK 🟡, DLP 🟡 | AES-256-GCM (WebCrypto) over all sensitive `localStorage` keys via the `SS` facade; key derived from a passphrase with PBKDF2 (250k iterations, random salt), random IV per write. |
| **Passphrase access gate** | IAM 🟡, MFA 🟡 | First-run setup (or opt-out), unlock-on-return, wrong-passphrase rejection via an AES-GCM verifier. The engine still boots underneath the overlay so the page always renders. |
| **Idle auto-lock** | ZTA 🟡 | Clears the in-memory key and re-locks after 15 minutes of inactivity; manual **Lock device** control. |
| **Tamper-evident activity log** | LOG ✅, AUDIT ✅, TRACE ✅, RCause 🟡 | Append-only, SHA-256 hash-chained record of completions, overrides, exports, deletions, and unlocks; viewable, exportable, printed as a report appendix, with chain-integrity verification. |
| **Edge & function hardening** | THREAT 🟡, ZTA 🟡, POLICY 🟡 | Strict CSP + HSTS + anti-clickjacking/Referrer/Permissions headers (`netlify.toml`); cross-origin allow-list guard on both Netlify functions. |

---

## 4. Out of scope (architectural preconditions)

The following would require a **backend service** and/or introducing an **AI/LLM
component**, which this project deliberately does not have (it is offline-capable,
zero-backend, and keeps all data on the user's device):

- **Backend identity:** real RBAC/ABAC/MFA/SSO/IAM, centralised audit.
- **AI controls:** DRIFT, BIAS, HALL, REDT (model), VDB, TOKEN, PIPE, and
  conformity to **ISO/IEC 42001** and the **EU AI Act**.

These remain correctly **Not Applicable** unless and until the product's
architecture changes. This document should be revisited if a backend or any
AI/ML component is introduced.
