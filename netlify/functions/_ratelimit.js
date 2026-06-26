/* Shared per-IP rate limiter for the Netlify Functions (the app's only backend).
   Zero dependencies — a sliding-window counter held in module memory.

   USAGE (inside a function's inner handle(), right after the origin check):

       const limited = rateLimit(event, { name: 'asana-task', limit: 100, windowMs: 60000 });
       if (limited) return limited;          // 429 response object, or null when allowed

   The returned object has the same shape the functions' own resp() produces
   ({ statusCode, headers, body }), so the outer handler still stamps CORS onto
   it. When the caller is under the limit, rateLimit() returns null and the
   request proceeds normally.

   ── SCOPE / PRODUCTION NOTE ────────────────────────────────────────────────
   Netlify Functions are stateless and horizontally scaled: each running
   instance has its OWN module memory, and instances cold-start and recycle.
   So this limiter is a per-instance best-effort throttle — it stops a single
   client from hammering one warm instance (the common brute-force / runaway-
   script case) but is NOT a globally consistent quota across the whole fleet.
   For hard, distributed enforcement put a shared store in front:
     • Netlify Edge rate limiting (recommended, platform-native), or
     • a tiny Upstash Redis INCR keyed by the same `name|ip`.
   The limits here are env-tunable so they can be tightened without a redeploy. */

/* key: "name|ip" → array of request timestamps (ms) inside the current window. */
const _hits = new Map();

/* Best-effort memory bound: occasionally drop keys whose window has fully
   expired so a long-lived warm instance doesn't accumulate stale IPs. */
let _lastSweep = 0;
const SWEEP_EVERY_MS = 5 * 60 * 1000;
function sweep(now) {
  if (now - _lastSweep < SWEEP_EVERY_MS) return;
  _lastSweep = now;
  for (const [k, arr] of _hits) {
    if (!arr.length || now - arr[arr.length - 1] > 10 * 60 * 1000) _hits.delete(k);
  }
}

/* Best client IP from the platform headers. Netlify sets
   x-nf-client-connection-ip to the real peer; x-forwarded-for is a fallback
   (take the FIRST hop — the left-most entry is the original client). */
function clientIp(event) {
  const h = (event && event.headers) || {};
  const direct = h['x-nf-client-connection-ip'] || h['X-Nf-Client-Connection-Ip'];
  if (direct) return String(direct).trim();
  const xff = h['x-forwarded-for'] || h['X-Forwarded-For'];
  if (xff) return String(xff).split(',')[0].trim();
  const ci = h['client-ip'] || h['Client-Ip'];
  if (ci) return String(ci).trim();
  return 'unknown';
}

/* Returns null when the request is allowed, or a 429 response object when the
   caller has exceeded `limit` requests within `windowMs` for this `name`. */
function rateLimit(event, opts) {
  const name = (opts && opts.name) || 'fn';
  const limit = Number(opts && opts.limit) || 100;
  const windowMs = Number(opts && opts.windowMs) || 60000;

  const now = Date.now();
  sweep(now);

  const key = name + '|' + clientIp(event);
  const cutoff = now - windowMs;
  const arr = (_hits.get(key) || []).filter(ts => ts > cutoff);

  if (arr.length >= limit) {
    /* Over the limit: reject. Retry-After is whole seconds until the oldest
       in-window hit ages out and a slot frees up. */
    const oldest = arr[0];
    const retryMs = Math.max(0, (oldest + windowMs) - now);
    const retryAfter = Math.max(1, Math.ceil(retryMs / 1000));
    _hits.set(key, arr); /* persist the pruned window; this request is NOT counted */
    return {
      statusCode: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(retryAfter),
        'RateLimit-Limit': String(limit),
        'RateLimit-Remaining': '0',
        'RateLimit-Reset': String(retryAfter)
      },
      body: JSON.stringify({
        ok: false,
        error: 'Too Many Requests',
        message: 'Has superado el límite de ' + limit + ' solicitudes por minuto para esta operación. '
          + 'Esperá ' + retryAfter + ' segundo(s) e intentá de nuevo.',
        retry_after_seconds: retryAfter
      })
    };
  }

  /* Under the limit: record this hit and allow. */
  arr.push(now);
  _hits.set(key, arr);
  return null;
}

/* Test-only: reset the in-memory state between cases. */
function _reset() { _hits.clear(); _lastSweep = 0; }

module.exports = { rateLimit, clientIp, _reset };
