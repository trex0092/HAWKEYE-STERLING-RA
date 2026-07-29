# API Reference — Netlify Functions

The app's only backend: four serverless functions plus a shared rate limiter and a
CSP-report sink. **The Asana token and Anthropic key live in the Netlify
environment and never reach the browser.** All functions apply, at the boundary:
a **CORS origin allow-list** (same-origin + `PRIMARY_ORIGIN`/`ALLOWED_ORIGINS`),
**POST-only** (405 otherwise), **`application/json` only** (415), a **1 MB body
cap** (413), JSON validation (400), and a **per-IP sliding-window rate limit**
(429; best-effort per-instance — see [`_ratelimit.js`](../../netlify/functions/_ratelimit.js)).

Base path: `/.netlify/functions/`. All responses are JSON `{ ok: boolean, … }`.

---

## `asana-task` — deliver a completed assessment
Creates (or idempotently updates) one Asana task in **HAWKEYE STERLING APP**, filed
into the section matching the risk band and stamped with custom fields.

**Request** `POST /.netlify/functions/asana-task`
```json
{
  "name": "REF-123 · Acme DMCC · EDD 24",
  "notes": "…assessment narrative…",
  "band": "EDD",                 // CDD | SDD | EDD | PROHIBITED → section
  "score": "24",
  "ref": "REF-123",              // stable reference (dedup key)
  "due_on": "2026-12-31",        // YYYY-MM-DD → Next Review
  "gid": "1234567890"            // optional: update an existing task
}
```
**Response** `200` `{ ok, gid, url, section, updated?|deduplicated? }`
**Behaviour** — 60 s in-memory dedup cache; ref-prefix + `external.gid` dedup
against the project; custom fields applied best-effort (a bad GID never loses the
delivery); 429/5xx retried.

## `asana-mirror` — register / activity-log backup
Two-way mirror of the on-device register and audit log.

**Request** `POST` `{ "action": "write", "register": [...], "audit": [...] }` or
`{ "action": "read" }`.
**Response (write)** `{ ok, register: {gid,url}, audit: {gid,url} }` ·
**(read)** `{ ok, register: [...], audit: [...] }`.
**Guards** — 2 MB body cap, ≤10 000 register items, per-field 2 000-char clip.

## `risk-backup` — risk-data override mirror
Mirrors the officer's Risk Data overrides into one dedicated task (monthly git
commit gives an off-device audit trail).
**Request** `POST` `{ "sheet": { app, version, overrides: {...} } }` ·
**Response** `{ ok, gid, url }`.

## `brain-soul` — AI Advisor relay (gated on `ANTHROPIC_API_KEY`)
Relays an AML question to the Anthropic API behind the server-held key; returns a
guardrailed cited answer. **No customer record is sent.**

**Request** `POST /.netlify/functions/brain-soul`
```json
{ "mode": "speed|default|deep", "persona": "…", "question": "…", "context": "…" }
```
**Response** `{ ok, text, mode, model, elapsedMs, tippingOffFlagged, auditLine }`
**Behaviour** — model per mode (`claude-haiku-4-5` / `claude-sonnet-5` /
`claude-opus-5`); token budgets clipped to what the platform execution cap
affords, and deep mode degraded to balanced — visibly, via `modeDegraded` and
`modeDegradedReason` in the response — when the cap cannot carry it; SOUL charter
guardrails; tipping-off guard (P4) can withhold
output; injection/charter-leak detection; kill switch `ADVISOR_ENABLED`; upstream
error bodies are **not** reflected to the client.

## `csp-report` — CSP violation sink
Receives `report-uri` CSP violation reports for monitoring. No secrets, no PII.

---

## Environment variables (server-side only)
| Var | Used by | Purpose |
|---|---|---|
| `ASANA_ACCESS_TOKEN` | asana-task/mirror/risk-backup | Asana API auth |
| `ASANA_PROJECT_GID` | same | delivery target (default HAWKEYE STERLING APP) |
| `ASANA_CF_REF/TIER/SCORE/NEXT_REVIEW` | asana-task | custom-field GIDs |
| `ANTHROPIC_API_KEY` | brain-soul | Advisor (absent ⇒ Advisor off, no egress) |
| `PRIMARY_ORIGIN` / `ALLOWED_ORIGINS` | all | CORS allow-list |
| `ADVISOR_ENABLED` | brain-soul | kill switch |
| `ADVISOR_PLATFORM_CAP_MS` | brain-soul | the site's function execution cap (default 10000). The abort budget and every mode's token budget derive from it, so the function returns its own governed answer rather than being killed mid-flight — a killed invocation runs none of the guards |

*Error codes are uniform across functions: 400 invalid JSON · 403 origin/method ·
405 non-POST · 413 body too large · 415 wrong content-type · 429 rate-limited ·
5xx upstream (retried). Contracts reflect the code at 2 Jul 2026.*
