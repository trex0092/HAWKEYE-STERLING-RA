# Backup, Recovery & Export Integrity

**Owner:** Compliance Engineering (operational) · MLRO (accountable)
**Review cadence:** annually, and on any change to the stores or the export format.

This runbook covers how Hawkeye Sterling RA data is backed up, how to restore it,
and how to independently verify the integrity of an exported record. It
complements the data-retention controls in
[`data-retention.md`](data-retention.md) and the record-keeping obligations under
UAE Federal Decree-Law No. (26) of 2021, Art. 23 (10-year retention).

## What is stored where

| Data | Primary store | Off-device backup |
|---|---|---|
| Assessment drafts / register | Browser `localStorage` (AES-256-GCM at rest) | Asana mirror ("ASSESSMENT REGISTER (auto-backup)") |
| Activity log (hash-chained) | Browser `localStorage` | Asana mirror ("ACTIVITY LOG (auto-backup)") |
| Risk-data overrides | Browser `localStorage` | Asana mirror + monthly commit to `data/risk-overrides-backup.json` |
| Regulatory / sanctions / FATF state | Git (`data/*.json`) | Git history (audit trail) |

On-device data never leaves the device except through the server-side Asana
relay (token held in Netlify env, never in the browser).

## Current preservation limitation

The Asana mirrors are off-device operational copies, but they are not treated as a
dedicated authenticated persistence tier with a defined assessment-data recovery
objective. **Open action 23 remains open** until an authenticated persistence/sync
tier is live, recovery is rehearsed against it, and the BCP records the applicable
RPO/RTO for assessment data. This document does not infer those controls from the
existence of the mirrors alone.

## Export integrity (independent verification)

Every JSON export carries an `integrity` envelope:

```json
"integrity": { "algorithm": "SHA-256", "value": "<hex>", "auditChainHead": "<hash|null>" }
```

- **Assessment export** (`exportJSON`): `value` = SHA-256 of `JSON.stringify(export.state)`.
- **Risk-data sheet** (`rdExportSheet`): `value` = SHA-256 of `JSON.stringify(export.overrides)`.
- **Activity log** (`exportAudit`): `value` = SHA-256 of `JSON.stringify(export.entries)`;
  each entry additionally carries its own chained `hash`.
- `auditChainHead` binds the export to the head of the tamper-evident activity
  log at export time.

### Verify a file (any environment)

```bash
# Assessment export — recompute the digest over the `state` field and compare
# it to export.integrity.value. Example with Node:
node -e '
  const c = require("crypto"), f = require("fs");
  const x = JSON.parse(f.readFileSync(process.argv[1], "utf8"));
  const h = c.createHash("sha256").update(JSON.stringify(x.state)).digest("hex");
  console.log(h === x.integrity.value ? "OK: integrity verified" : "MISMATCH: tampered or altered");
' ./my-assessment.json
```

For the risk-data sheet use `x.overrides`; for the activity log use `x.entries`.
A mismatch means the record was altered after export. The append-only activity
log is additionally verifiable in-app via the chain-integrity check (`auditVerify`).

> Note: the digest is computed over `JSON.stringify(<field>)` using the key order
> as serialised in the file, which the export preserves — so a verifier that
> stringifies the parsed field reproduces the exact bytes.

## Restore procedures

### A. Restore an assessment on a new device (from an export file)
1. Open the app, unlock (or continue without encryption).
2. Verify the file's integrity (above).
3. Import the JSON (the import path validates and whitelists fields via
   `mergeState`; unknown/non-scalar fields are dropped).
4. Confirm the score, band and hard outcome match the recorded `result`.

### B. Restore from the Asana auto-backup
1. Open the relevant auto-backup task (Register / Activity Log / Risk Data Sheet)
   in the Asana RISK ASSESSMENTS project.
2. Copy the JSON payload from the task body / attachment.
3. Import it via the corresponding in-app import (assessment or risk-data sheet),
   verifying integrity first.

### C. Restore regulatory/sanctions/FATF state
These live in git (`data/*.json`); restore by checking out the desired commit.
The watchers "degrade loudly" — a missing/old state file triggers a re-seed or a
GitHub issue rather than a silent all-clear.

## Recovery testing

`test/export-integrity.test.js` (run in CI) asserts that an export carries a
verifiable SHA-256 digest, that tampering is detected, and that the import path
round-trips the whitelisted record losslessly. Re-run it after any change to the
export/import code.

## Concurrency safety

Activity-log appends are serialised in-app (`auditAppend` → `_auditChain`) so
two near-simultaneous events cannot lose an entry to a read-modify-write race;
the hash chain therefore stays complete and verifiable.

---

## Secondary screening-delivery failure channel, staged only

The `delivery-watchdog.yml` workflow checks that the due day's daily
screening report and full-results attachments reached Asana. Its existing
alert task also goes to Asana, so an Asana outage can hide both the report
and the incident alert. A second job can create or reuse a generic GitHub
Issue using `scripts/github-fallback-alert.mjs` on a FAILED watchdog check.

**DEFAULT OFF:** the second job executes only when the repository variable
`SECONDARY_ALERT_ENABLED` is explicitly set to `true`. It gets a
job-scoped `issues: write` GitHub token and has **no Asana credential**.
The issue contains the UTC detection time and workflow-run link, but no
names, cases, transactions, source secrets, or actual screening results.
An existing open issue with the exact static title is reused to prevent
routine duplicates. GitHub lookup outages fail without speculative writes.

**Human activation gate:** GitHub Issues for this repository may be public.
MLRO/IT must assess whether revealing that a daily compliance delivery was
unverified is acceptable, determine who will monitor the new issues and
set an acknowledgment/escalation SLA. Until that is approved, leave the
variable disabled. A GitHub-hosted issue is independent of Asana as a
destination but **not independent of GitHub's workflow infrastructure**,
nor is it a guaranteed paging service. OA-21 still needs a truly
independently monitored route, delivery/receipt testing and owner sign-off.

Offline tests in `test/delivery-watchdog.test.mjs` cover gating,
idempotency, safe payloads, failed GitHub responses and workflow wiring.
No live issue is created by the test suite.
