# AI Governance & Security — Gap Analysis (2026)

**Subject application:** Hawkeye Sterling — Entity Risk Assessment (RA)
**Assessed against:** *AI Governance & Security Periodic Table (2026)* — 36 building blocks
**Date:** 2026-06-14 · **Prepared by:** Compliance engineering

> **Revision 2026-06-19 (QA correction):** scope corrected — the suite ships an
> optional **LLM-backed Advisor** (`netlify/functions/brain-soul.js` → Anthropic
> API), so the generative-AI tiles are assessed for it in **§1a** rather than
> marked product-wide Not Applicable. The serverless-function count is corrected
> (four, not two). The deterministic RA engine (`index.html`) posture is unchanged.
>
> **Revision 2026-06-21 (in-code controls added):** every Periodic-Table tile that
> can be implemented **without an external integration or backend** has been built
> in code (no new dependencies, no Asana changes). New controls are tabulated in
> **§5**. Only **SSO, VDB, PIPE and central enterprise IAM** remain Not Applicable —
> each *requires* a backend/IdP/vector-DB service the project deliberately does not
> have, so they are out of scope by design (precondition named in §4 and §5).

---

## 1. Scope and framing

The periodic table enumerates building blocks for securing **enterprise AI/LLM
systems** (model drift, hallucination, vector databases, identity providers,
data-protection pipelines, and so on).

The Hawkeye Sterling RA **scoring engine** is **not an AI system**. It is a
single-file static web app (`index.html`) with:

- **no AI/LLM** — scoring is a deterministic, rules-based AML/CFT engine;
- **no backend / no server-side state** — it runs entirely in the browser and
  deploys to a static host (Netlify);
- **no user accounts** — a single compliance officer operates it on their device;
- **four serverless functions** (`netlify/functions/*`): three relay
  completed-assessment, entity-mirror and risk-data-backup events to Asana with a
  server-held token; one (`brain-soul.js`) backs the optional **Advisor** screen
  (`advisor.html`) by calling the **Anthropic API** with a server-held key — see §1a.

For the **RA scoring engine itself** (`index.html`), a large share of the table is
**Not Applicable (N-A)**: there is no model to drift, bias, hallucinate, or
red-team; no vector store; no data pipeline; and no backend on which to host an
enterprise identity provider. The tile-by-tile table in §2 assesses **that engine**
and marks those tiles N-A with the architectural precondition that would make them
relevant. The separate Advisor AI component is assessed in §1a.

This release **closes the genuinely-applicable gaps** for an on-device tool:
encryption-at-rest, a passphrase access gate with idle auto-lock, a tamper-evident
activity log, and edge/function hardening. See §3.

**Status key:** ✅ implemented · 🟡 partial / analogue · ❌ absent (applicable) ·
N-A not applicable to a non-AI, on-device app.

---

## 1a. AI component — the Advisor

The suite also ships an **optional, LLM-backed Advisor** (`advisor.html`) served by
`netlify/functions/brain-soul.js`, which calls the **Anthropic API** (server-held
`ANTHROPIC_API_KEY`; the key never reaches the browser). For this component the
generative-AI tiles — **HALL, BIAS, DRIFT, REDT, VDB** (if embeddings are added),
**ISO 42001** and the **EU AI Act** — are **in scope**, not N-A.

Guardrails already present in `brain-soul.js` are **prompt/charter-level**, enforced
through the `SOUL_CHARTER` system prompt, which instructs the model to:

- **not generate legal conclusions** — describe observable facts and flag them as
  indicators, red flags, or typology matches (P3);
- treat **training-data knowledge as non-current** and disclose the cutoff rather
  than presenting it as a live source (P8);
- **not assign a risk score without stating its methodology** (P9);
- flag **disambiguation gaps** instead of merging distinct candidates.

The function also applies a **tipping-off guard** on the output, a **request
timeout**, and emits an **audit line**. These reduce — but do **not formally
measure** — hallucination and bias.

**Open AI-governance gaps for the Advisor:** documented model-output evaluation,
bias testing, AI red-teaming, and a DPIA covering the Anthropic processing. Track
these separately from the RA engine's posture in §2.

> **Update 2026-06-21.** REDT / DRIFT / model-output evaluation for the Advisor are
> now **closed at the assurance level**: `test/advisor-assurance.test.js` (offline,
> in CI) runs a tipping-off red-team battery plus charter-integrity and
> model-routing drift guards, and `scripts/advisor-eval.mjs` (key-gated, weekly via
> `.github/workflows/advisor-eval.yml`) evaluates the live model against the charter
> guardrails. The AI surfaces are now inventoried in
> [`ai-asset-register.md`](ai-asset-register.md), retention in
> [`data-retention.md`](data-retention.md), and the full framework mapping in
> [`agentic-ai-governance-6layers-2026.md`](agentic-ai-governance-6layers-2026.md).
> **BIAS testing** and the **DPIA** remain open.

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

> **Note:** the DRIFT / BIAS / HALL / REDT markings above are for the deterministic
> RA engine. For the LLM-backed Advisor (`brain-soul.js`) these tiles are
> **applicable** — see §1a for current guardrails and open gaps.

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

> **Note:** ISO42K and AIACT are N-A for the deterministic RA engine, but **apply to
> the LLM-backed Advisor** (`brain-soul.js`); see §1a. GDPR also extends to the
> Advisor's Anthropic processing, which needs a DPIA.

---

## 3. What changed in this release (gaps closed)

| Control | Tiles advanced | Implementation |
|---|---|---|
| **Encryption-at-rest** | ENC ✅, MASK 🟡, DLP 🟡 | AES-256-GCM (WebCrypto) over all sensitive `localStorage` keys via the `SS` facade; key derived from a passphrase with PBKDF2 (250k iterations, random salt), random IV per write. |
| **Passphrase access gate** | IAM 🟡, MFA 🟡 | First-run setup (or opt-out), unlock-on-return, wrong-passphrase rejection via an AES-GCM verifier. The engine still boots underneath the overlay so the page always renders. |
| **Idle auto-lock** | ZTA 🟡 | Clears the in-memory key and re-locks after 15 minutes of inactivity; manual **Lock device** control. |
| **Tamper-evident activity log** | LOG ✅, AUDIT ✅, TRACE ✅, RCause 🟡 | Append-only, SHA-256 hash-chained record of completions, overrides, exports, deletions, and unlocks; viewable, exportable, printed as a report appendix, with chain-integrity verification. |
| **Edge & function hardening** | THREAT 🟡, ZTA 🟡, POLICY 🟡 | Strict CSP + HSTS + anti-clickjacking/Referrer/Permissions headers (`netlify.toml`); cross-origin allow-list guard on the Netlify functions. |

---

## 4. Out of scope (architectural preconditions)

The following would require a **backend service**, which this project deliberately
does not have (it is offline-capable, zero-backend, and keeps all data on the
user's device):

- **Backend identity:** real RBAC/ABAC/MFA/SSO/IAM, centralised audit.
- **Data-platform controls:** TOKEN, PIPE (no backend ingestion to secure).

These remain **Not Applicable** to the deterministic RA engine unless its
architecture changes. The **generative-AI controls** — DRIFT, BIAS, HALL, REDT,
VDB (if embeddings are added), **ISO/IEC 42001** and the **EU AI Act** — are
**N-A for the RA engine but applicable to the LLM-backed Advisor** (`brain-soul.js`);
their current guardrails and open gaps are in §1a. Revisit this document whenever
the Advisor's model usage changes, or if a backend is introduced.

---

## 5. In-code controls added (2026-06-21)

Every tile addable **without a backend or external integration** is now enforced in
code. No new dependencies and no Asana changes. Tests: `test/app.test.js` (engine /
device controls) and `test/advisor-assurance.test.js` (Advisor guards).

### Advisor AI runtime guards — `netlify/functions/brain-soul.js`
Each is a pure guard surfaced in the response JSON and the `auditLine`, exercised
offline via `exports.__internals`.

| Tile | Control | Evidence |
|---|---|---|
| **HALL** | Hallucination guard — flags definitive sanctions/adverse-media assertions or fabricated URLs/case-numbers when **no source** was supplied (runtime P1/P2/P8). | `hallucinationGuard`, `hallFlagged` |
| **THREAT** | Prompt-injection guard — flags injected commands ("ignore previous…", planted "subject cleared", base64 blobs) in operator/context input. | `injectionGuard`, `injectionFlagged` |
| **ANOM** | Output-anomaly guard — abnormally short output, charter-text leakage, degenerate repetition. | `anomalyGuard`, `anomFlagged` |
| **PERF** | Output-quality score 0–100 (citation, scope/methodology, gaps, next steps, disclaimer). | `qualityScore`, `quality` |
| **LAT** | Latency surfaced as a first-class signal (`latencyFlagged`) alongside `elapsedMs`. | `budgetFlag` → `latencyFlagged` |

### Advisor client — `advisor.html` (on-device, privacy-preserving)
- **LAT / USAGE / MON**: on-device telemetry (`govRecord`/`govStats`) — latency p50/p95,
  per-mode/persona usage counts, and a health indicator — stored only in `localStorage`
  (no telemetry leaves the device). Governance chips render the guard flags beside each answer.

### Deterministic engine + device — `index.html`
| Tile | Control | Evidence |
|---|---|---|
| **MFA** ✅ | Optional **TOTP second factor** (RFC 6238, HMAC-SHA1 via WebCrypto) layered on the passphrase; secret stored encrypted; fails open on corruption to avoid lock-out. | `totpVerify`, `mfaToggle`, `secTotp` |
| **RBAC / ABAC** 🟡→✅ (analogue) | Operator **role** (Analyst / Reviewer-MLRO / Admin) with action gating — second-line approval, risk-data edits and security changes are role-gated and logged. Defaults to Admin (backward compatible). | `currentRole`, `can`, gated `toggleComplete`/`rdSetOverride` |
| **MASK** ✅ | Field-level masking toggle for registration no., address, contact and principals. | `toggleMask`, `.mask-field` / `body.mask-on` |
| **TOKEN** ✅ | Pseudonymised activity-log export — identifiers replaced by stable SHA-256 tokens (`ID-…`, `REF-…`). | `exportAuditTokenized` |
| **RCause** 🟡→✅ | Structured **root-cause-analysis** record appended to the tamper-evident hash-chained log and printed in the report appendix. | `addRCA`, `rcaSubmit` (`rca.record`) |
| **POLICY** 🟡→✅ | Completion gate — finalising warns/blocks on missing mandated sign-off fields (driven by `POLICIES`). | `policyMissing` in `toggleComplete` |

### Still Not Applicable (require an external integration/backend — out of scope by design)
| Tile | Precondition |
|---|---|
| **SSO** | An external identity provider (OAuth / SAML / OIDC) to federate. |
| **IAM** (central/enterprise) | A backend identity service; the on-device role model above is the in-code analogue. |
| **VDB** | An embeddings provider + a vector-database service. |
| **PIPE** | A backend data-ingestion pipeline to secure. |

> **ISO42K / AIACT / GDPR** are governance regimes evidenced by the documents in
> `docs/governance/` plus the technical controls above (encryption, audit, role
> gating, transparency notice, data-subject export/erasure). They are documentation-
> and-control posture, not a single code path.
