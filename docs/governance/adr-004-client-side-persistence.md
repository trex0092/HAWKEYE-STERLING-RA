# ADR-004 — Client-Side Persistence, Effectively-Public Endpoints

**Status:** Accepted with registered exit path (in force since first release;
recorded retroactively 2026-08-04) · **Owner:** Maintainer + MLRO ·
**Revisit:** §4, and in any case with register items 20/23.

Assessment data persists in the officer's browser (`localStorage`); there is
no server-side database and no user authentication. This is the estate's most
consequential architecture decision and its costs are carried openly — this
record exists so nobody mistakes the posture for an oversight.

## 1. Context

- The firm is small: a handful of named officers, one device each. The
  cheapest way to hold PII is not to hold it — on-device data never crosses
  a border, which simplifies the PDPL position
  ([`dpia-2026.md`](dpia-2026.md), cross-border row).
- A static site cannot keep a secret: any token shipped to the browser is
  public by definition. [`../../netlify/functions/_auth.js`](../../netlify/functions/_auth.js)
  says this in its header rather than pretending otherwise.

## 2. Decision

- Assessments, the register and the activity log live in `localStorage`,
  exportable by the officer; the WebCrypto device lock protects at rest.
- Function endpoints check Origin and a shared token as a **deterrent**, not
  authentication; confidential-read surfaces are treated as effectively
  public in the threat model, and what they return is minimised accordingly.
- The one off-device copy is the override-sheet mirror
  (`data/risk-overrides-backup.json`, monthly).

## 3. Consequences

**Gained:** no server-side PII store to defend, breach-notify or localise;
no credential lifecycle; the PDPL/DPIA posture stays simple; the app works
offline.
**Paid:** clearing browser storage destroys the officer's register (RPO = the
last export or mirror); telemetry on the console is per-device, not
firm-wide; endpoint abuse is rate-limited and monitored rather than
identity-gated.

## 4. Revisit triggers

This ADR carries its own exit: **register item 20** (verified identity on
write + confidential-read endpoints, target 2027-03-31) and **item 23**
(server-side persistence tier + RPO/RTO statement, target 2027-06-30).
Earlier triggers: a second concurrent officer needing shared live state; a
regulator asking for firm-side retention of assessments; any incident where
the mirror was not enough. When item 23 lands, this record flips to
Superseded and the DPIA cross-border row is re-assessed in the same PR.
