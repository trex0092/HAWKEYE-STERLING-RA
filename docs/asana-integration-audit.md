# Asana Integration — Audit, Fixes & Reconciliation Runbook

_Audit date: 2026-07-01 · Scope: the Hawkeye Sterling RA ↔ Asana delivery path
(`hawkeye-sterling-ra.netlify.app`)._

This document is the record of a source-level audit of the app's Asana
integration, the fixes applied, and a repeatable reconciliation procedure for
catching drift between the app and Asana on an ongoing basis.

> **What was verified, and what was not.** This audit was performed against the
> repository source. It did **not** have live Netlify or Asana API access in the
> session, so the *runtime* health checks (Phase 1 of the original plan — pulling
> real tasks, deploy/function logs, delivery success rates) are documented below
> as a runbook to be run where that access exists, not as executed results. Every
> code claim below is grounded in a cited file and line and is covered by a test.

---

## Phase 0 — Architecture ground truth

The integration is a **server-side proxy**, not a client-side call. The Asana
personal access token lives only in the Netlify environment
(`ASANA_ACCESS_TOKEN`) and never reaches the browser — confirmed in
[`netlify.toml`](../netlify.toml) (`connect-src 'self'`, functions directory) and
in each function's use of `process.env.ASANA_ACCESS_TOKEN`. **There is no exposed
token.**

```
Browser (app.js / console.js)
  │  fetch same-origin  (no token in the browser)
  ▼
Netlify Functions  (token in ASANA_ACCESS_TOKEN, server-side)
  ├─ asana-task.js    ── one task per completed assessment, filed by risk band
  ├─ asana-mirror.js  ── two-way backup of the Register + Activity Log
  └─ risk-backup.js   ── mirror of the risk-data score overrides
  │  Asana REST v1.0
  ▼
Asana project  "RISK ASSESSMENTS"  (default GID 1215653768729951)
     sections: LOW RISK (CDD) · MEDIUM RISK (SDD) · HIGH RISK (EDD) ·
               PROHIBITED (DO NOT ONBOARD) · ACTIVITY LOG (housekeeping mirrors)
```

Separately, the regulatory/sanctions watchers post to a **different** project via
[`scripts/asana-notify.mjs`](../scripts/asana-notify.mjs)
(`ASANA_REG_PROJECT_GID`, default `1215844297069727`) — not in scope here.

### Key facts

| Item | Value | Source |
|------|-------|--------|
| Delivery target project | `ASANA_PROJECT_GID` → default `1215653768729951` (RISK ASSESSMENTS) | `asana-task.js:8` |
| Token | `ASANA_ACCESS_TOKEN` (server-side only) | `asana-task.js:45` |
| Assignee | `ASANA_ASSIGNEE` → default `me` | `asana-task.js:114` |
| Allowed origins | same-origin + `PRIMARY_ORIGIN` + `ALLOWED_ORIGINS` | `asana-task.js:195` |
| Rate limit | `RATE_LIMIT_DEFAULT` (100/min/IP, per-instance best-effort) | `_ratelimit.js` |
| Trigger | marking an assessment **Complete** auto-fires delivery | `app.js:1488` |
| "Retry Asana Delivery" | recovers a payload stored on the last failed delivery | `app.js` retry path |
| Field mapping | task **name** + **notes** (plain text) + risk-band **section**; **no Asana custom fields** are used | `app.js` `asanaPayload()` |

The plan's memory of an "00 · Hawkeye Inbox" triage hub does **not** match the
current source: this app delivers directly into the single **RISK ASSESSMENTS**
project, filed into a section by risk band. Confirm the live GID against
`ASANA_PROJECT_GID` in the Netlify UI (see runbook).

---

## Phase 1 — Audit findings

Findings were produced by a fan-out of dimension-specific reviewers and then
**adversarially verified** (each finding was handed to an independent skeptic
told to refute it). **11 confirmed, 4 refuted.**

### Confirmed (all fixed — see Phase 2)

| # | Sev | File | Defect |
|---|-----|------|--------|
| 1 | High | `asana-task.js` | Cross-device dedup matched the **whole task name**, which embeds the mutable outcome+score; a re-scored assessment re-completed on another device created a **duplicate** for the same reference. |
| 2 | Med | `asana-task.js` | On the `gid` update path, a **transient** PUT failure (429/5xx) was treated the same as a 404 and fell through to **create a duplicate**. |
| 3 | Med | `asana-task.js` | Same class in the cross-instance dedup path: a found task whose PUT failed transiently was **duplicated**. |
| 4 | Med | `app.js` | Delivery failures wrote **nothing to the tamper-evident Activity Log** — only a transient toast + a retry payload. |
| 5 | Med | `app.js` | A failed delivery for a **non-current** reference was invisible and could never be retried (button + retry keyed only off the current ref). |
| 6 | Med | `asana-mirror.js` | On `read`, an expired token (401) was swallowed and returned **`ok:true` with an empty register** — a token failure looked identical to "no backups yet". |
| 7 | Med | `asana-task.js` | The 60s dedup cache short-circuited on `name+band`, so a re-submit with **edited notes/due date** returned the stale cached result — a **lost update**. |
| 8 | Low | `asana-mirror.js` | Read masking surfaced on the Console (a fetch failure replaced fetched rows with nothing and reported "Refreshed 0" as success). Resolved by #6. |
| 9 | Low | `asana-task.js`, `risk-backup.js`, `asana-mirror.js` | A `200` with an empty/non-JSON body dereferenced `body.data.gid`, throwing a `TypeError` **masked as a generic 502** — violating the module's own "surface the real status" contract. |
| 10 | Low | `asana-mirror.js` | The write path fully normalized/serialized an **unbounded** client register array before any size check (CPU/memory abuse vector). |
| 11 | Low | `asana-task.js`, `risk-backup.js`, `asana-mirror.js` | `ensureSection` did list-then-create with no idempotency, so two concurrent first-time completions of a new band created **duplicate sections**. |

### Refuted (correctly, no change)

- **"Complete marks the register regardless of Asana outcome."** By design — the
  assessment is a local AML record first; delivery is best-effort and now
  audit-logged (#4) and retryable (#5).
- **"The 1000-entry mirror cap silently drops audit history."** The mirror is an
  explicit off-device *summary* backup; the on-device hash-chained log
  (`auditAll()`) keeps every entry. Cap is intentional and consistent on both
  sides.
- **"Non-atomic register-then-log mirror write."** Both are idempotent upserts of
  fixed-name tasks; a partial write self-heals on the next mirror. Low real risk.
- **"`upsertTask` discards the upstream error body."** True but not a defect for a
  fire-and-forget mirror; the meaningful status (401) is now surfaced via #6.

---

## Phase 2 — Fixes applied

All changes preserve existing behavior (full suite green: `app.test.js`
277 passed, `asana-functions.test.js` 17 passed) and add regression tests.

| # | Fix | Test |
|---|-----|------|
| 1 | Client now sends a stable `ref` field; server matches an existing task by the `"<ref> · "` **prefix** (`findTaskByRef`), preferring an exact-name hit, and renames the task to the latest outcome. Placeholder/empty refs fall back to exact-name matching. | `asana-functions.test.js` — "matched by ref … no cross-device duplicate" |
| 2, 3 | A failed PUT now **only** recreates on a genuine **404**; 429/5xx/auth failures surface the status so the client retries the same reference instead of duplicating. | "transient PUT failure … not a duplicate" (×2) |
| 4 | `doSendToAsana` writes `asana.delivery.ok` / `asana.delivery.failed` to the hash-chained Activity Log on every outcome. | `app.test.js` — "recorded in the … activity log" (×2) |
| 5 | The retry button reflects **any** pending failed delivery (with a count in its title), and retry flushes **all** pending references, current-first. | `app.test.js` — "stays visible …", "flushes ALL pending …" |
| 6 | `asana-mirror` `findTask` throws on a non-OK upstream (carrying the status); a `401` surfaces as `401 "rotate ASANA_ACCESS_TOKEN"` instead of an empty success. | `asana-functions.test.js` — "read with an expired token surfaces 401" |
| 7 | The dedup cache key now includes a content hash of `notes+due_on`, so an edited re-submit misses the cache and is written through; identical double-clicks still dedup. | "identical rapid re-submit …", "edited re-submit … no lost update" |
| 9 | Created-task gid is guarded across all three functions; a malformed 2xx yields a clear `"asana returned no task id"` error. | "a 2xx create with no task id yields a clear error" |
| 10 | A raw-body cap (2 MB) rejects oversized requests before parsing; the register is item-capped and per-field length-capped before normalization; `total` is coerced to a primitive. | (covered by existing mirror tests staying green) |
| 11 | `ensureSection` re-lists after a failed/raced create and reuses the section that now exists, converging on one section. | "a raced section create converges" |

---

## Phase 3 — Ongoing reconciliation runbook

Run this where Asana + Netlify access exists (a session with the Asana/Netlify
MCP tools, or manually). It finds **drift** between the app and Asana.

### Inputs

1. **From the app** — Console → **Export (tokenised)** for the Activity Log, and
   the Assessment Register (Console → Refresh from Asana pulls the mirror). Use
   the **tokenised** export so PII never leaves the browser for the audit.
2. **From Asana** — list tasks in the RISK ASSESSMENTS project
   (`ASANA_PROJECT_GID`), fields `name, permalink_url, completed, due_on,
   memberships.section`.

### Diff procedure

For each register entry with a reference `R`:

- **Delivery gap** — `R` is marked complete in the app but **no** Asana task's
  name starts with `"R · "`. → the assessment never reached Asana (check the
  Activity Log for an `asana.delivery.failed` entry; use the retry button).
- **Orphan** — an Asana task whose name starts with `"R · "` exists but there is
  **no** register entry for `R`. → a manually-created or stale task.
- **Field mismatch** — the band token in the Asana task name (`… · <BAND> <score>`)
  or its **section** disagrees with the register's `outcome`. → a task that
  wasn't re-delivered after a re-score (now far less likely after fix #1).
- **Duplicate** — **two or more** Asana tasks share the `"R · "` prefix. → pre-fix
  residue; keep the most-recently-updated, delete the rest.

Output: a sorted, verified discrepancy list — the same format as the Fine Gold
LLC RA and Customer Database audits.

### Cadence

Weekly is sufficient given delivery is now audit-logged and retryable. Consider
standing this up as its own recurring Asana task assigned to the MLRO so it is
tracked like every other Hawkeye Sterling control.

---

## Phase 4 — Guardrails

- **Alert at time of failure.** `scripts/asana-alert.mjs` already raises a
  same-day Asana card from CI. The client now records `asana.delivery.failed` in
  the Activity Log; surface a count so a stuck delivery is noticed in-session, not
  days later in an audit (retry button now shows the pending count — fix #5).
- **Tokenised export is the reconciliation input.** Phase 3 uses the tokenised
  Activity Log export so PII stays in the browser.
- **Rotate on 401.** A `401` from Asana now surfaces a clear "rotate
  `ASANA_ACCESS_TOKEN`" message (fix #6, and `asana-notify.mjs` already does this
  for the watchers). Rotate the token in Netlify env + GitHub Actions secrets
  together.

### Netlify / Asana spot-checks (verify live)

1. Netlify → site **hawkeye-sterling-ra** → **Environment variables**: confirm
   `ASANA_ACCESS_TOKEN` is set and `ASANA_PROJECT_GID` points at RISK ASSESSMENTS
   (`1215653768729951` unless overridden). If `ASANA_PROJECT_GID` is unset the
   functions log a warning and fall back to the hardcoded default.
2. Netlify → **Functions** logs for `asana-task` / `asana-mirror`: look for `401`
   (token), `429` (rate limit), and the new explicit error strings.
3. Asana → RISK ASSESSMENTS: confirm one task per reference and that band
   sections exist (they are auto-created on demand).

---

## Enhancements & further hardening (2026-07 follow-up)

A second pass added capability and closed hardening gaps. **Shipped** (all tested):

| Ref | Change | Notes |
|---|---|---|
| A1 | **Native custom fields** | A completed assessment populates env-configured Asana custom fields (`ASANA_CF_REF/TIER/SCORE/NEXT_REVIEW`) so the project is sortable/reportable and reconciliation can be field-level. Applied best-effort **after** the task exists, so a wrong GID never loses a delivery. Inert until the GIDs are set. |
| A2 | **External-ID idempotency** | Each task is stamped with `external.gid = <ref>` at creation; delivery first tries an O(1) lookup by external id before the paginated scan. A stable, unique key that survives re-scores. |
| A3 | **Weekly reconciliation** | `scripts/asana-reconcile.mjs` + `.github/workflows/asana-reconcile.yml` diff the register mirror vs live tasks (delivery gaps / orphans / mismatches / duplicates) and file a **PII-free** card; GitHub-issue fallback if Asana is unreachable. |
| A5 | **Register delivery-status chip** | Each register row shows `ASANA ✓ / ✗ / …` (delivered / failed / pending) from the delivered & failed maps. |
| B2 | **Tokenised delivery mode** | A per-device toggle (`🔒 Asana: tokenise`) that keeps customer/staff **PII on the device** and sends Asana only ref + tier + score + dates. |
| B5 | **429 auto-retry** | Bounded exponential backoff on HTTP 429 (honours `Retry-After`); **5xx is never retried** so a create can't be duplicated. |
| B6 | **Content-type strictness** | A present, non-JSON `Content-Type` is rejected `415`. |

### Deliberately **not** shipped as originally specced — and why

- **A4 · Two-way sync from Asana → app.** Not architecturally possible here: the
  register lives in the browser's `localStorage`, and a serverless webhook cannot
  write to a user's browser. Would require a real backend store (a product
  decision). A limited *status-mirror* (webhook → update the mirror task) is
  possible but low value; deferred.
- **A6 · PDF attachment.** The app builds an HTML report, not a PDF; server-side
  PDF generation + multipart upload is heavyweight. Deferred. (Backfilling
  `external.gid` on pre-existing tasks is better handled by the A3 reconcile job.)
- **B1 · HMAC-signed function requests.** A browser cannot hold a signing secret
  *secretly* — anyone can read `app.js` — so client-side HMAC is **security
  theatre**, not real auth. The honest options are the existing origin guard +
  rate-limit + input caps (in place), or **real user auth** (Netlify Identity /
  login) if write-access must be restricted. Not shipped rather than fake it.
- **B3 · Distributed rate limiting.** Needs external infrastructure (Netlify Edge
  rate limiting or an Upstash Redis `INCR`), not a pure code change; the current
  limiter is documented as best-effort per-instance. Provision-then-wire.
- **B4 · Token scoping / rotation.** An Asana-admin/operational task (dedicated
  service account scoped to the four projects + rotation cadence), not code.
  Recommended, but must be done in the Asana console.
