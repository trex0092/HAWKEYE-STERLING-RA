# AI System Decommissioning & Retirement (AIMS A.6 — lifecycle end)

**Owner:** MLRO (decision + records) · system maintainer (execution).
**Approver:** MLRO · Registered as POL-33 in the [policy register](../governance/policy-register.md)
**Cadence:** dormant — executed on a retirement decision; reviewed annually by the
[internal audit](internal-audit.md) §4 (A.6 row). **Related:**
[`../governance/data-retention.md`](../governance/data-retention.md) ·
[`ai-system-inventory.md`](ai-system-inventory.md) ·
[`../governance/ai-asset-register.md`](../governance/ai-asset-register.md) ·
[`bcp.md`](bcp.md).

ISO/IEC 42001 treats the AI lifecycle as ending at retirement, not deployment.
This procedure closes that phase: how an AI surface (or the whole system) is taken
out of service without losing statutory records, leaving live credentials behind,
or stranding users on a cached app.

## 1. Retirement triggers

- MLRO decision (risk acceptance withdrawn, vendor exit, product sunset).
- A [BCP](bcp.md) event made permanent (vendor ceased, model family retired).
- Replacement go-live (cut-over checklist below applies to the *old* surface).
- Regulator direction.

## 2. Scope tiers

| Tier | What is retired | Examples |
|---|---|---|
| T1 | One AI surface | Advisor only (`advisor.html` + `brain-soul.js`), engine stays |
| T2 | One integration | Asana relay off; app remains standalone (localStorage-only) |
| T3 | Whole system | Site + functions + repo archived |

## 3. Procedure (execute top-to-bottom; record each step in §5)

### 3.1 Records first — before anything is switched off
1. **Statutory retention is not negotiable:** export the final state of all
   assessment records, screening evidence, audit logs, and retention snapshots
   (`data/retention/`) to the firm's archival store. UAE AML retention (10 years,
   FDL 26/2021 Art. 23) **survives the system** — decommissioning the software
   never decommissions the records
   ([`../governance/data-retention.md`](../governance/data-retention.md)).
2. Export the Asana projects (tasks are the filed compliance records) or confirm
   Asana-side retention ownership.
3. Snapshot the repo (tag `retired-<surface>-<date>`) so cited evidence
   (tests, workflows, docs) remains resolvable for auditors.

### 3.2 Switch off, in dependency order
4. **Ingress:** remove or stub the retiring page(s); for T3, disable the Netlify
   site. A tombstone page (static, no JS) should state the retirement date and
   where records live.
5. **Functions:** delete the retiring functions from `netlify/functions/` (T1:
   `brain-soul.js`; T2: `asana-*.js`, `risk-backup.js`) so the endpoints 404
   rather than idle with live credentials.
6. **Service worker:** ship a final `sw.js` that deletes the runtime cache and
   unregisters itself — otherwise retired users keep booting the cached app
   offline indefinitely (the PWA outlives the site). Bump `CACHE`, serve the
   self-destruct build, keep it up ≥ 90 days.
7. **Schedules:** disable the retiring GitHub Actions schedules (screening,
   watches, reports) so dead controls don't file STALE alarms forever; the daily
   governance report is retired **last** (it is the witness that everything else
   stopped cleanly).

### 3.3 Credentials & vendors
8. Revoke `ANTHROPIC_API_KEY` (T1/T3) and `ASANA_ACCESS_TOKEN` (T2/T3) in the
   issuing consoles, then delete the Netlify env vars and GitHub Actions secrets.
   The key inventory is `.env.example` — walk every name in it.
9. Update [`third-party-register.md`](third-party-register.md): vendor rows to
   **exited**, note contract/DPA end date and data-return/deletion confirmation
   from the vendor (PDPL requires disposal evidence).

### 3.4 Registers & users
10. Update [`ai-system-inventory.md`](ai-system-inventory.md) and
    [`../governance/ai-asset-register.md`](../governance/ai-asset-register.md):
    status → **retired**, with date and this procedure's log reference. Close or
    re-scope open risks in [`ai-risk-register.md`](ai-risk-register.md)
    (a retired surface's risks close; residual data-retention risks remain).
11. Notify interested parties per
    [`interested-parties-information.md`](interested-parties-information.md)
    (staff at minimum; regulator if the retirement affects filing capability).
12. File the retirement decision + completed checklist as a
    [management review](management-review.md) input and a CAPA-log entry if the
    retirement was incident-driven.

## 4. Verification (the retirement is done only when)

- [ ] Archived records verified readable outside the system.
- [ ] Endpoints return 404/410; site (T3) offline; tombstone live.
- [ ] Self-destruct SW confirmed on a previously-installed client.
- [ ] All revoked keys fail authentication (test each).
- [ ] Registers updated; audit trail of this checklist in §5.

## 5. Retirement log

| Date | Tier | Surface(s) | Executed by | Verified by | Records archive ref |
|---|---|---|---|---|---|
| _none — system in service_ | | | | | |
