# ADR-004 — Client-Side Persistence, Shared-Token Endpoint Gate

**Status:** Accepted with registered exit path (in force since first release;
recorded retroactively 2026-08-04) · **Owner:** Maintainer + MLRO ·
**Revisit:** §4, and in any case with register items 20/23.

Assessment data persists primarily in the officer's browser (`localStorage`);
there is no dedicated server-side database and no verified per-user identity or
role-based authorization on the function endpoints. A shared `X-App-Token` can
gate the configured paths, but it is a bearer secret rather than user identity.
This is the estate's most consequential architecture decision and its costs are
carried openly so nobody mistakes the posture for an oversight.

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
- Function endpoints check Origin and can enforce a shared `X-App-Token`. The
  shared token materially gates configured paths, including confidential reads,
  but it is not verified per-user authentication or RBAC; item 20 remains the
  identity closure path.
- Off-device operational copies exist in Asana for the assessment register,
  activity log and risk-data sheet, with a monthly git backup for risk overrides.
  These mirrors are not treated as a dedicated authenticated persistence tier or
  as proof of a documented/rehearsed assessment-data RPO/RTO; item 23 remains open.

## 3. Consequences

**Gained:** no server-side PII store to defend, breach-notify or localise;
no credential lifecycle; the PDPL/DPIA posture stays simple; the app works
offline.
**Paid:** browser storage remains the primary working store, so recovery depends
on the latest export or operational mirror until item 23 lands; telemetry on the
console is per-device, not firm-wide; endpoint abuse is shared-token/rate-limit
protected rather than identity-gated.

## 4. Revisit triggers

This ADR carries its own exit: **register item 20** (verified identity on
write + confidential-read endpoints, target 2027-03-31) and **item 23**
(server-side persistence tier + RPO/RTO statement, target 2027-06-30).
Earlier triggers: a second concurrent officer needing shared live state; a
regulator asking for firm-side retention of assessments; any incident where
the available mirrors were not enough. When item 23 lands, this record flips to
Superseded and the DPIA cross-border row is re-assessed in the same PR.
