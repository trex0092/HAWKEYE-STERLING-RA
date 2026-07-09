'use strict';

/* Optional shared-secret gate — defence in depth, NOT user authentication.
 *
 * HONEST LIMITATION: the Origin header is set by browsers but is trivially
 * forgeable by any non-browser client (`curl -H 'Origin: https://…'`). So the
 * Origin allow-list is a hardening measure against casual cross-site abuse, not
 * an authentication boundary — treat every function endpoint as effectively
 * public. A static browser app also cannot keep a real secret (anyone can read
 * the token out of the page), so even the token below cannot fully authenticate
 * the browser; it only raises the bar from "zero-effort curl" to "must read the
 * page/JS". Confidential data must not rely on these gates alone.
 *
 * Three modes:
 *   - APP_SHARED_TOKEN UNSET (default) → sharedTokenOk() always returns true.
 *     The live site and server-to-server callers are unaffected; this file is
 *     inert until an operator opts in.
 *   - APP_SHARED_TOKEN SET, APP_STRICT_TOKEN unset (default token mode) → a
 *     request with NO browser Origin (the curl / server-to-server path) MUST
 *     present a matching `X-App-Token`; a request that carries a site Origin is
 *     still allowed without the token. This closes the "omit Origin to bypass"
 *     hole but, per the limitation above, does NOT stop an Origin-forging curl.
 *   - APP_SHARED_TOKEN SET **and** APP_STRICT_TOKEN=1 (strict mode) → EVERY
 *     request must present a matching `X-App-Token`, including browser requests.
 *     This is the only mode that resists Origin forgery. The browser sends the
 *     token via a same-origin <meta name="hsra-app-token"> tag the operator
 *     fills in at deploy time (see index.html/console.html and the README); the
 *     repo's own verify/health curls must add `-H "X-App-Token: <token>"`.
 */
const crypto = require('crypto');

function safeEqual(a, b) {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ab.length !== bb.length) return false;      // length is not secret
  return crypto.timingSafeEqual(ab, bb);
}

function strictMode() {
  return /^(1|true|yes|on)$/i.test(String(process.env.APP_STRICT_TOKEN || ''));
}

function sharedTokenOk(event) {
  const required = process.env.APP_SHARED_TOKEN;
  if (!required) return true;                       // feature off → unchanged
  const h = (event && event.headers) || {};
  if (!strictMode()) {
    const origin = h.origin || h.Origin;
    if (origin) return true;                        // default mode: browser path (origin-guarded)
  }
  const provided = h['x-app-token'] || h['X-App-Token'] || '';
  return !!provided && safeEqual(provided, required);   // strict mode: token required on every path
}

module.exports = { sharedTokenOk, strictMode };
