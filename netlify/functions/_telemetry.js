'use strict';

/* Structured Netlify-function error telemetry.
 *
 * This wrapper observes two failure modes that used to be invisible:
 *   1) an endpoint returns a 5xx response;
 *   2) an endpoint throws before it can return.
 *
 * Privacy boundary: request bodies, query strings, tokens and response bodies
 * are never logged. Only endpoint name, method, path, status, request id and a
 * scrubbed exception class/message are emitted to the Netlify function log.
 */
const _recent = new Map();
const DEDUP_MS = 60 * 1000;

function safeText(value, max = 180) {
  return String(value == null ? '' : value)
    .replace(/bearer\s+[A-Za-z0-9._~+\/-]+/gi, 'Bearer <redacted>')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '<email>')
    .replace(/([?&](?:token|key|secret|code|sig|signature)=)[^&#\s]+/gi, '$1<redacted>')
    .replace(/[A-Za-z0-9_-]{40,}/g, '<token>')
    .slice(0, max);
}

function requestPath(event) {
  const direct = String((event && event.path) || '').trim();
  if (direct) return direct.split('?')[0].slice(0, 160);
  const raw = String((event && event.rawUrl) || '').trim();
  if (!raw) return '';
  try { return new URL(raw).pathname.slice(0, 160); }
  catch { return raw.split('?')[0].slice(0, 160); }
}

function requestId(event) {
  const h = (event && event.headers) || {};
  return safeText(
    h['x-nf-request-id'] || h['X-Nf-Request-Id'] ||
    h['x-request-id'] || h['X-Request-Id'] || '',
    100
  );
}

function shouldLog(signature, now = Date.now()) {
  const last = _recent.get(signature) || 0;
  if (now - last < DEDUP_MS) return false;
  _recent.set(signature, now);
  if (_recent.size > 200) {
    for (const [key, ts] of _recent) if (now - ts > DEDUP_MS) _recent.delete(key);
  }
  return true;
}

function emit(name, event, detail) {
  const rec = {
    event: 'function.error',
    function: safeText(name, 80),
    kind: detail.kind,
    status: Number(detail.status) || 500,
    method: safeText((event && event.httpMethod) || '', 12),
    path: requestPath(event),
    requestId: requestId(event),
  };
  if (detail.error) rec.error = safeText(detail.error, 80);
  if (detail.message) rec.message = safeText(detail.message, 180);

  const signature = [rec.function, rec.kind, rec.status, rec.error || ''].join('|');
  if (shouldLog(signature)) console.error('[function-error] ' + JSON.stringify(rec));
}

function withFunctionTelemetry(name, handler) {
  if (typeof handler !== 'function') throw new TypeError('handler must be a function');
  return async function telemetryWrappedHandler(event, context) {
    try {
      const response = await handler(event, context);
      const status = Number(response && response.statusCode) || 0;
      if (status >= 500) emit(name, event, { kind: 'response-5xx', status });
      return response;
    } catch (err) {
      emit(name, event, {
        kind: 'exception',
        status: 500,
        error: err && err.name ? err.name : 'Error',
        message: err && err.message ? err.message : 'Unhandled function exception',
      });
      throw err;
    }
  };
}

function _resetTelemetry() { _recent.clear(); }

module.exports = { withFunctionTelemetry, safeText, requestPath, _resetTelemetry };
