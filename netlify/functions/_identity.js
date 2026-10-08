'use strict';

/* Opt-in, server-verified OIDC JWT access for confidential Netlify functions.

   Default OFF until a real IdP, user provisioning and MLRO-approved role mapping
   exist. When APP_OIDC_REQUIRED is enabled, missing configuration fails closed.
   The JWT is verified using only the configured same-origin HTTPS JWKS, never
   an untrusted "jku", "x5u", role header or browser-supplied public key.
   RS256 signed JWT access tokens only. No runtime dependencies or client secret.
*/
const crypto = require('node:crypto');
const ROLES = new Set(['Analyst', 'Reviewer-MLRO', 'Admin']);
const MAX_JWT_BYTES = 16384;
const MAX_JWKS_BYTES = 65536;
const CLOCK_SKEW_SECONDS = 30;
let cached = { url: '', expires: 0, keys: [] };

function oidcRequired() {
  const value = String(process.env.APP_OIDC_REQUIRED || '').trim().toLowerCase();
  return !['', '0', 'false', 'off', 'no'].includes(value);
}

function validHttps(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && !u.username && !u.password &&
      !u.hash && (!u.port || u.port === '443');
  } catch (_) { return false; }
}

function configuration() {
  const issuer = String(process.env.APP_OIDC_ISSUER || '').trim();
  const audience = String(process.env.APP_OIDC_AUDIENCE || '').trim();
  const jwksUrl = String(process.env.APP_OIDC_JWKS_URL || '').trim();
  const maxTtl = Number(process.env.APP_OIDC_MAX_TTL_SECONDS || 3600);
  if (!issuer || !audience || !jwksUrl || !validHttps(issuer) ||
      !validHttps(jwksUrl) || audience.length > 256 ||
      new URL(issuer).origin !== new URL(jwksUrl).origin ||
      !Number.isInteger(maxTtl) || maxTtl < 60 || maxTtl > 86400) return null;
  return { issuer, audience, jwksUrl, maxTtl };
}

class AuthInvalid extends Error {}
class AuthUnavailable extends Error {}

function decodeJsonPart(part) {
  if (typeof part !== 'string' || part.length < 2 || part.length > 12000 ||
      !/^[A-Za-z0-9_-]+$/.test(part)) throw new AuthInvalid();
  try {
    const parsed = JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new AuthInvalid();
    return parsed;
  } catch (_) { throw new AuthInvalid(); }
}

async function getKeys(jwksUrl) {
  if (cached.url === jwksUrl && cached.expires > Date.now()) return cached.keys;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 3000);
  try {
    const response = await fetch(jwksUrl, {
      method: 'GET', headers: { Accept: 'application/json' },
      redirect: 'error', signal: ctrl.signal
    });
    if (!response.ok) throw new AuthUnavailable();
    const declared = Number(response.headers && response.headers.get &&
      response.headers.get('content-length'));
    if (declared > MAX_JWKS_BYTES) throw new AuthUnavailable();
    const body = await response.text();
    if (body.length > MAX_JWKS_BYTES) throw new AuthUnavailable();
    const parsed = JSON.parse(body);
    if (!parsed || !Array.isArray(parsed.keys) ||
        parsed.keys.length < 1 || parsed.keys.length > 32) throw new AuthUnavailable();
    cached = { url: jwksUrl, expires: Date.now() + 5 * 60000, keys: parsed.keys };
    return cached.keys;
  } catch (_) {
    throw new AuthUnavailable();
  } finally {
    clearTimeout(timer);
  }
}

async function verifyAccessToken(jwt, config) {
  if (typeof jwt !== 'string' || jwt.length > MAX_JWT_BYTES) throw new AuthInvalid();
  const parts = jwt.split('.');
  if (parts.length !== 3 || parts.some(p => !p)) throw new AuthInvalid();
  const header = decodeJsonPart(parts[0]);
  if (header.alg !== 'RS256' || !header.kid || typeof header.kid !== 'string' ||
      header.kid.length > 256 || (header.typ &&
        !['JWT', 'at+jwt'].includes(header.typ)) || header.crit) throw new AuthInvalid();

  const keys = await getKeys(config.jwksUrl);
  const matching = keys.filter(k => k && k.kid === header.kid && k.kty === 'RSA' &&
    (!k.use || k.use === 'sig') && (!k.alg || k.alg === 'RS256') &&
    (!k.key_ops || (Array.isArray(k.key_ops) && k.key_ops.includes('verify'))));
  if (matching.length !== 1) throw new AuthInvalid();
  let publicKey;
  try { publicKey = crypto.createPublicKey({ key: matching[0], format: 'jwk' }); }
  catch (_) { throw new AuthInvalid(); }
  if (!/^[A-Za-z0-9_-]+$/.test(parts[2]) ||
      !crypto.verify('RSA-SHA256', Buffer.from(parts[0] + '.' + parts[1]),
        publicKey, Buffer.from(parts[2], 'base64url'))) throw new AuthInvalid();

  const payload = decodeJsonPart(parts[1]);
  const now = Math.floor(Date.now() / 1000);
  const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (payload.iss !== config.issuer || !aud.includes(config.audience) ||
      typeof payload.sub !== 'string' || payload.sub.length < 1 || payload.sub.length > 256 ||
      !Number.isSafeInteger(payload.exp) || !Number.isSafeInteger(payload.iat) ||
      payload.exp <= now - CLOCK_SKEW_SECONDS ||
      payload.iat > now + CLOCK_SKEW_SECONDS ||
      payload.exp <= payload.iat ||
      payload.exp - payload.iat > config.maxTtl ||
      (payload.nbf !== undefined &&
        (!Number.isSafeInteger(payload.nbf) || payload.nbf > now + CLOCK_SKEW_SECONDS))) {
    throw new AuthInvalid();
  }
  if (typeof payload.hawkeye_role !== 'string' || !ROLES.has(payload.hawkeye_role)) {
    throw new AuthInvalid();
  }
  return { subject: payload.sub, role: payload.hawkeye_role };
}

async function requireIdentityRole(event, allowedRoles) {
  if (!oidcRequired()) return { ok: true, enabled: false };
  const config = configuration();
  if (!config) return { ok: false, statusCode: 503 };
  const headers = event && event.headers || {};
  const value = headers.authorization || headers.Authorization || '';
  const match = typeof value === 'string' && /^Bearer ([A-Za-z0-9._-]+)$/.exec(value);
  if (!match) return { ok: false, statusCode: 401 };
  try {
    const identity = await verifyAccessToken(match[1], config);
    if (!Array.isArray(allowedRoles) || !allowedRoles.includes(identity.role)) {
      return { ok: false, statusCode: 403 };
    }
    return { ok: true, enabled: true, ...identity };
  } catch (err) {
    return { ok: false, statusCode: err instanceof AuthUnavailable ? 503 : 401 };
  }
}

function _resetCache() {
  cached = { url: '', expires: 0, keys: [] };
}

module.exports = { oidcRequired, requireIdentityRole, _resetCache };
