'use strict';

const { rateLimit } = require('./_ratelimit');
const { withFunctionTelemetry, safeText } = require('./_telemetry');

const MAX_BODY = 8 * 1024;
const ALLOWED_KINDS = new Set(['window.error', 'unhandledrejection', 'manual-test']);

function cleanPath(value) {
  const s = String(value || '').split('?')[0].split('#')[0];
  return /^\/[A-Za-z0-9._~!$&'()*+,;=:@\/-]{0,159}$/.test(s) ? s : '';
}

function numberOrZero(value) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

async function handler(event) {
  const method = String((event && event.httpMethod) || '').toUpperCase();
  if (method === 'OPTIONS') return { statusCode: 204, body: '' };
  if (method !== 'POST') return { statusCode: 405, headers: { Allow: 'POST' }, body: '' };

  const limited = rateLimit(event, {
    name: 'client-error-report',
    limit: Number(process.env.RATE_LIMIT_CLIENT_ERROR) || 20,
    windowMs: 60000,
  });
  if (limited) return limited;

  const raw = String((event && event.body) || '');
  if (raw.length > MAX_BODY) return { statusCode: 413, body: '' };

  let data;
  try { data = JSON.parse(raw || '{}'); }
  catch { return { statusCode: 400, body: '' }; }

  const kind = ALLOWED_KINDS.has(String(data.kind)) ? String(data.kind) : 'window.error';
  const rec = {
    event: 'client.error',
    kind,
    page: cleanPath(data.page),
    source: cleanPath(data.source),
    line: numberOrZero(data.line),
    column: numberOrZero(data.column),
    message: safeText(data.message || 'Client error', 180),
  };
  console.warn('[client-error] ' + JSON.stringify(rec));
  return { statusCode: 204, body: '' };
}

exports.handler = withFunctionTelemetry('client-error-report', handler);
exports.__internals = { cleanPath, numberOrZero, MAX_BODY };
