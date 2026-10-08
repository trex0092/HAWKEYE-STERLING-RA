'use strict';

/* Optional, fail-closed shared quota contract for the billed Advisor endpoint.

   No backend is bundled, contacted or provisioned by this repository.
   When SHARED_RATE_LIMIT_ENABLED=1, an APPROVED external/owned quota service
   must provide one atomic counter across all Netlify function instances:
       POST { key: HMAC_SHA256(secret, endpoint|platform-peer-ip),
              limit: integer, window_ms: integer }
       HTTP 200 { allowed: true } OR
       HTTP 200 { allowed: false, retry_after_seconds: 1..3600 }
   The server must authenticate each request and enforce atomic updates and
   consistent TTLs. A mock or a 200 response alone cannot prove fleet-wide
   protection. Caller inputs NEVER select provider URL, credential or limits.

   Unknown/missing/unavailable/malformed provider response FAILS CLOSED (503).
   This complements, never replaces, the existing in-instance throttle.
   Keyed HMAC protects the raw peer IP from the provider but yields a
   linkable pseudonym, so processor and transfer approvals still apply.
*/

const crypto = require('node:crypto');
const net = require('node:net');
const { clientIp } = require('./_ratelimit');

function gateMode() {
  const configured = String(process.env.SHARED_RATE_LIMIT_ENABLED || '').trim().toLowerCase();
  if (['', '0', 'false', 'no', 'off'].includes(configured)) return 'off';
  if (['1', 'true', 'yes', 'on'].includes(configured)) return 'on';
  return 'invalid';
}
function enabled() { return gateMode() === 'on'; }

function config() {
  const value = String(process.env.SHARED_RATE_LIMIT_URL || '').trim();
  const token = String(process.env.SHARED_RATE_LIMIT_AUTH_TOKEN || '');
  const keySecret = String(process.env.SHARED_RATE_LIMIT_KEY_SECRET || '');
  let parsed;
  try { parsed = new URL(value); } catch (_) { return null; }
  const host = parsed.hostname.toLowerCase();
  if (parsed.protocol !== 'https:' || !host.includes('.') ||
      net.isIP(host) || /(?:^|\.)localhost$|(?:^|\.)local$/.test(host) ||
      parsed.username || parsed.password || parsed.hash || parsed.search ||
      (parsed.port && parsed.port !== '443') ||
      (token.length < 24 || keySecret.length < 24) ||
      token.length > 512 || keySecret.length > 512) return null;
  return { url: parsed.toString(), token, keySecret };
}

function errorResponse() {
  return {
    statusCode: 503,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: JSON.stringify({ ok: false, error: 'Shared rate limiter unavailable; Advisor is temporarily withheld.' })
  };
}
function quotaDenied(retrySeconds, limit) {
  return {
    statusCode: 429,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'Retry-After': String(retrySeconds),
      'RateLimit-Limit': String(limit),
      'RateLimit-Remaining': '0'
    },
    body: JSON.stringify({ ok: false, error: 'Shared rate limit exceeded', retry_after_seconds: retrySeconds })
  };
}

async function enforceSharedQuota(event, options = {}) {
  const mode = gateMode();
  if (mode === 'off') return null;
  if (mode !== 'on') return errorResponse();
  const c = config();
  const name = options.name;
  const limit = options.limit;
  const windowMs = options.windowMs;
  if (!c || typeof name !== 'string' || !/^[a-z0-9_-]{1,50}$/.test(name) ||
      !Number.isInteger(limit) || limit < 1 || limit > 5000 ||
      !Number.isInteger(windowMs) || windowMs < 1000 || windowMs > 3600000) {
    return errorResponse();
  }
  const clientKey = crypto.createHmac('sha256', c.keySecret)
    .update(name + '|' + clientIp(event)).digest('hex');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 2500);
  try {
    const response = await fetch(c.url, {
      method: 'POST',
      redirect: 'error',
      signal: ctrl.signal,
      headers: {
        Authorization: 'Bearer ' + c.token,
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({ key: clientKey, limit, window_ms: windowMs })
    });
    if (!response || response.status !== 200) return errorResponse();
    const raw = await response.text();
    if (typeof raw !== 'string' || raw.length > 1024) return errorResponse();
    const body = JSON.parse(raw);
    if (!body || typeof body !== 'object' || Array.isArray(body) ||
        typeof body.allowed !== 'boolean') return errorResponse();
    if (body.allowed) return null;
    const retry = body.retry_after_seconds;
    if (!Number.isInteger(retry) || retry < 1 || retry > 3600) return errorResponse();
    return quotaDenied(retry, limit);
  } catch (_) {
    return errorResponse();
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { enabled, enforceSharedQuota };
