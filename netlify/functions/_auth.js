'use strict';

/* Optional shared-secret gate — defence in depth, NOT user authentication.
 *
 * A static browser app cannot keep a secret (anyone can read app.js), so this
 * does not, and cannot, authenticate the browser. What it does:
 *
 *   - APP_SHARED_TOKEN UNSET (default) → sharedTokenOk() always returns true. The
 *     live site and existing server-to-server callers are completely unaffected;
 *     this file is inert until an operator opts in.
 *   - APP_SHARED_TOKEN SET → a request that carries NO browser Origin header (the
 *     server-to-server / curl path that otherwise slips past the origin guard,
 *     because a missing Origin is treated as allowed) MUST present a matching
 *     `X-App-Token` header. The browser path is still gated by Origin, not the
 *     token. This closes the "omit Origin to bypass the only access control" hole
 *     for a hardened deployment without breaking browser same-origin POSTs.
 *
 * NOTE: if you set APP_SHARED_TOKEN, update any server-side caller that POSTs to
 * these functions without an Origin (e.g. the verify curls in netlify-deploy.yml /
 * asana-delivery-diag.yml) to send `-H "X-App-Token: <token>"`.
 */
const crypto = require('crypto');

function safeEqual(a, b) {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ab.length !== bb.length) return false;      // length is not secret
  return crypto.timingSafeEqual(ab, bb);
}

function sharedTokenOk(event) {
  const required = process.env.APP_SHARED_TOKEN;
  if (!required) return true;                       // feature off → unchanged
  const h = (event && event.headers) || {};
  const origin = h.origin || h.Origin;
  if (origin) return true;                          // browser path (origin-guarded)
  const provided = h['x-app-token'] || h['X-App-Token'] || '';
  return !!provided && safeEqual(provided, required);
}

module.exports = { sharedTokenOk };
