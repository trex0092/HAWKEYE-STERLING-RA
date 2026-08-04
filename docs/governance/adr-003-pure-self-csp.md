# ADR-003 — Pure-`'self'` Content Security Policy

**Status:** Accepted (in force since the app.js/app.css externalisation;
recorded retroactively 2026-08-04) · **Owner:** Maintainer · **Revisit:** §4.

The CSP is a pure `'self'` policy: no `'unsafe-inline'` anywhere, no
third-party origins, no inline `<script>`/`<style>`/`on*` handlers, fonts
self-hosted. Guard: `test/csp.test.mjs`; byte-parity of the headers between
`netlify.toml` and `sws.toml` is separately guarded by
`test/security-headers.test.mjs`.

## 1. Context

- The app handles entity names, ownership structures and risk verdicts
  on-device. XSS is the highest-consequence client-side threat (STRIDE
  analysis in [`../architecture.md`](../architecture.md)).
- A `'self'`-only policy is the strongest CSP a zero-build static site can
  carry, and it is only sustainable if **nothing** inline ever returns —
  one inline handler forces `'unsafe-inline'` and the whole posture folds.

## 2. Decision

All logic and styling live in same-origin external files. Former inline
`on*` handlers became event delegation; former inline styles go through the
CSSOM. Fonts are self-hosted (`fonts.css` + `assets/fonts/`). Third-party
origins are banned outright — analytics included, which is why there are
none.

## 3. Consequences

**Gained:** script injection has no legal execution path inside the policy;
the CSP header is short enough to audit by eye; no consent/privacy surface
from third-party origins.
**Paid:** no CDN conveniences (see ADR-002 — the two decisions hold each
other up); dynamic styling is more verbose via CSSOM; every new page must be
built to the same discipline, which `test/csp.test.mjs` enforces rather than
trusts.

## 4. Revisit triggers

(a) a genuinely required third-party integration that cannot be proxied
through a Netlify function; (b) CSP Level 3 features (nonces/hashes) becoming
necessary for a capability the current policy blocks. Either is a
security-posture change: it goes through the incident-runbook's change path
with MLRO visibility, not a quiet header edit.
