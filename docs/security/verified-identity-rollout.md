# Verified Endpoint Identity, Staged Implementation

**Status: code staged, opt-in OFF. Does not close open action OA-20.**

The Netlify functions `asana-mirror` (read/write of the firm-wide assessment
register and activity mirror) and `risk-backup` (risk-data overrides) have a
server-side JWT verifier in `netlify/functions/_identity.js`.

## Authorization matrix

| Endpoint | Operation | Roles permitted when OIDC is required |
|---|---|---|
| `asana-mirror` | Read or write shared assessment/activity mirror | `Reviewer-MLRO`, `Admin` |
| `risk-backup` | Write risk-data override sheet | `Admin` |

Client-supplied local role settings are not accepted as proof of authority.
Only the signed token's `hawkeye_role` claim grants server-side access.
No role grants the right to file an STR/SAR or execute sanctions actions.

## How the gate works

- `APP_OIDC_REQUIRED=0` is the default. Existing authentication behavior
  remains unchanged. **This is not verified user authentication in production.**
- When required, **both** a valid RS256 bearer access JWT and an authorized
  `hawkeye_role` claim are mandatory for the two confidential endpoints.
- The verifier checks a fixed configured HTTPS issuer, expected API audience,
  signature against the fixed same-origin HTTPS JWKS, token expiry, issued time,
  a limited token lifetime, subject and allowed role.
- Missing bearer or invalid JWT returns 401; correct JWT with insufficient
  role returns 403; missing verifier configuration or unavailable JWKS returns
  503. Nothing is served in the fail-closed paths.
- Client-provided `jku`, `x5u`, arbitrary role headers and unsigned JWT
  algorithms are never used for key selection or authorization.
- An already configured `APP_SHARED_TOKEN` remains an additional gate.
  An embedded browser shared secret is **not** equivalent to user identity.

## Conditions before production enablement

1. The MLRO and IT approve a trustworthy IdP and a role-provisioning model.
   Every user needs a unique identity with periodic access review and rapid
   deprovisioning. The role claim must be minted by the IdP, never by JavaScript.
2. Complete the use-case/change-control and privacy/vendor assessments.
3. Integrate the browser sign-in process with a short-lived **access token**
   targeted to the backend API audience. Do not accept an ID token or opaque
   access token as a substitute. Implement logout and expired-token recovery.
4. Test in a nonproduction environment with real IdP keys and an authorized
   test account. Confirm the Analyst denial, allowed Reviewer and Admin
   operations, rotation of signing keys, IdP outage and wrong-audience behavior.
5. Establish monitoring for authorization denials **without logging bearer
   tokens or sensitive subject identifiers**.
6. Only then configure `APP_OIDC_REQUIRED=1`,
   `APP_OIDC_ISSUER`, `APP_OIDC_AUDIENCE` and `APP_OIDC_JWKS_URL`
   in the Netlify environment. Optional max lifetime is
   `APP_OIDC_MAX_TTL_SECONDS` (default 3600, bounded to 60-86400).
7. Re-run the browser and integration checks. If login or restore fails,
   revert the deployment configuration only under a documented MLRO-approved
   incident/change process; do not silently switch off identity enforcement.

## Incomplete work

This change intentionally does **not** include a browser OAuth/OIDC login
flow, customer tenant isolation, full platform endpoint authorization, a
production IdP, or end-to-end live integration evidence. Complete these in
separately reviewed changes before OA-20 is closed. The repository's local
UI role selector remains only a convenience control until identity is live.

**Offline evidence:** `node test/identity.test.js` exercises synthetic
signed RSA keys/JWTs, tampering, expiration, wrong issuer/audience, role
denial, endpoint denial and simulated IdP outage, with no external network.
