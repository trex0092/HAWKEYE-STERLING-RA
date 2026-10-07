'use strict';
const { withFunctionTelemetry } = require('./_telemetry');

const crypto = require('crypto');

function header(event, name) {
  const headers = (event && event.headers) || {};
  const target = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === target) return Array.isArray(value) ? value[0] : value;
  }
  return '';
}

function timingSafeTextEqual(a, b) {
  const aa = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
}

function verify(event, nowMs = Date.now()) {
  const secret = process.env.COMPOSIO_WEBHOOK_SECRET;
  if (!secret) return { ok: false, statusCode: 503, error: 'COMPOSIO_WEBHOOK_SECRET is not configured' };

  const id = String(header(event, 'webhook-id') || '');
  const timestamp = String(header(event, 'webhook-timestamp') || '');
  const signature = String(header(event, 'webhook-signature') || '');
  const payload = String((event && event.body) || '');

  if (!id || !timestamp || !signature) {
    return { ok: false, statusCode: 401, error: 'missing Composio webhook verification headers' };
  }

  const ts = Number(timestamp);
  const tolerance = Math.max(30, Number(process.env.COMPOSIO_WEBHOOK_TOLERANCE_SECONDS) || 300);
  if (!Number.isFinite(ts) || Math.abs((nowMs / 1000) - ts) > tolerance) {
    return { ok: false, statusCode: 401, error: 'webhook timestamp outside tolerance' };
  }

  const digest = crypto
    .createHmac('sha256', secret)
    .update(id + '.' + timestamp + '.' + payload)
    .digest('base64');
  const expected = 'v1,' + digest;
  const candidates = signature.split(' ').map(x => x.trim()).filter(Boolean);

  if (!candidates.some(candidate => timingSafeTextEqual(candidate, expected))) {
    return { ok: false, statusCode: 401, error: 'invalid webhook signature' };
  }
  return { ok: true, statusCode: 200 };
}

function parsePayload(raw) {
  let body;
  try { body = JSON.parse(String(raw || '{}')); }
  catch { return { type: 'unknown', triggerSlug: '', userId: '', data: null }; }

  const metadata = body.metadata || body.meta || {};
  const data = body.data || body.payload || {};
  return {
    type: String(body.type || body.event_type || ''),
    triggerSlug: String(metadata.trigger_slug || metadata.trigger_name || body.trigger_slug || body.trigger_name || ''),
    userId: String(metadata.user_id || body.user_id || ''),
    connectedAccountId: String(metadata.connected_account_id || metadata.connection_id || body.connected_account_id || body.connection_id || ''),
    triggerId: String(metadata.trigger_id || body.trigger_id || ''),
    data,
  };
}

async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: false }) };
  }

  const checked = verify(event);
  if (!checked.ok) {
    return {
      statusCode: checked.statusCode,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, error: checked.error }),
    };
  }

  const parsed = parsePayload(event.body);
  console.log(JSON.stringify({
    event: 'composio.webhook',
    type: parsed.type,
    triggerSlug: parsed.triggerSlug,
    triggerId: parsed.triggerId,
    connectedAccountId: parsed.connectedAccountId,
    userId: parsed.userId,
  }));

  /* Intentionally no automatic compliance action here. Trigger delivery is
   * accepted and audit-labelled, but tool execution remains an explicit,
   * authenticated call through composio-router. */
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ok: true, received: true }),
  };
}

exports.handler = handler;
exports.__internals = { verify, parsePayload, timingSafeTextEqual, header };

/* Structured 5xx/exception telemetry. The wrapper never logs request bodies. */
exports.handler = withFunctionTelemetry('composio-webhook', exports.handler);
