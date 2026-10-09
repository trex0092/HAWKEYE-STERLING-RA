'use strict';
const { withFunctionTelemetry } = require('./_telemetry');

const { rateLimit } = require('./_ratelimit');
const { dataTokenOk } = require('./_auth');
const composio = require('./_composio');
const enginePolicy = require('./_composio-engine-policy');

function allowedOrigins() {
  const primary = process.env.PRIMARY_ORIGIN || 'https://hawkeye-sterling-ra.netlify.app';
  const extra = String(process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  return [primary, ...extra].filter(Boolean);
}

function originAllowed(event) {
  const h = (event && event.headers) || {};
  const origin = h.origin || h.Origin;
  if (!origin) return true;
  const host = h.host || h.Host || '';
  const originHost = String(origin).replace(/^[a-z]+:\/\//i, '').split('/')[0];
  if (host && originHost === host) return true;
  return allowedOrigins().includes(origin);
}

function corsHeaders(event) {
  const h = (event && event.headers) || {};
  const origin = h.origin || h.Origin;
  const out = { Vary: 'Origin' };
  if (origin && originAllowed(event)) {
    out['Access-Control-Allow-Origin'] = origin;
    out['Access-Control-Allow-Methods'] = 'POST, OPTIONS';
    out['Access-Control-Allow-Headers'] = 'Content-Type, X-App-Token';
    out['Access-Control-Max-Age'] = '86400';
  }
  return out;
}

function resp(statusCode, body, event) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(event) },
    body: JSON.stringify(body),
  };
}

function requireConfiguredToken(event) {
  if (!process.env.APP_SHARED_TOKEN) {
    const err = new Error('APP_SHARED_TOKEN is required for Composio orchestration');
    err.statusCode = 503;
    throw err;
  }
  if (!dataTokenOk(event)) {
    const err = new Error('Unauthorized');
    err.statusCode = 401;
    throw err;
  }
}

function requireExplicitFlag(name) {
  if (!/^(1|true|yes|on)$/i.test(String(process.env[name] || ''))) {
    const err = new Error('Composio privileged action requires a separately approved server-side gate');
    err.statusCode = 403;
    throw err;
  }
}

async function dispatch(action, body) {
  switch (action) {
    case 'session.create':
      return composio.createSession(body.user_id, body);
    case 'session.get':
      return composio.getSession(body.session_id);
    case 'session.update':
      return composio.updateSession(body.session_id, body.patch);
    case 'session.delete':
      requireExplicitFlag('COMPOSIO_ALLOW_ADMIN_MUTATIONS');
      return composio.deleteSession(body.session_id);
    case 'session.attach':
      requireExplicitFlag('COMPOSIO_ALLOW_ADVANCED_SESSION');
      return composio.attachSession(body.session_id, body.attach || {});
    case 'tools.list':
      return composio.sessionTools(body.session_id);
    case 'toolkits.list':
      return composio.sessionToolkits(body.session_id);
    case 'tools.search':
      return composio.searchTools(body.session_id, body.query);
    case 'tools.execute':
      return composio.executeTool(body.session_id,
        enginePolicy.readExecution(body.execution, composio.configuredToolkits()));
    case 'tools.execute_meta':
      return composio.executeMeta(body.session_id,
        enginePolicy.readMetaExecution(body.execution));
    case 'auth.link':
      return composio.linkToolkit(body.session_id, body.link);
    case 'proxy.execute':
      if (!/^(1|true|yes|on)$/i.test(String(process.env.COMPOSIO_ALLOW_PROXY || ''))) {
        const err = new Error('Composio proxy execution is disabled');
        err.statusCode = 403;
        throw err;
      }
      return composio.proxyExecute(body.session_id, body.request);
    case 'mount.items':
      return composio.listMountItems(body.session_id, body.mount_id, body.query);
    case 'mount.upload_url':
      requireExplicitFlag('COMPOSIO_ALLOW_ADMIN_MUTATIONS');
      return composio.mountUploadUrl(body.session_id, body.mount_id, body.file);
    case 'mount.download_url':
      requireExplicitFlag('COMPOSIO_ALLOW_PRESIGNED_URLS');
      return composio.mountDownloadUrl(body.session_id, body.mount_id, body.file);
    case 'mount.delete':
      requireExplicitFlag('COMPOSIO_ALLOW_ADMIN_MUTATIONS');
      return composio.mountDelete(body.session_id, body.mount_id, body.file);
    case 'triggers.types':
      return composio.listTriggerTypes(body.query);
    case 'triggers.type':
      return composio.getTriggerType(body.slug);
    case 'triggers.list':
      return composio.listActiveTriggers(body.query);
    case 'triggers.create':
      requireExplicitFlag('COMPOSIO_ALLOW_ADMIN_MUTATIONS');
      return composio.createTrigger(body.user_id, body.slug, {
        connectedAccountId: body.connected_account_id,
        triggerConfig: body.trigger_config,
        toolkitVersions: body.toolkit_versions,
      });
    case 'triggers.enable':
      requireExplicitFlag('COMPOSIO_ALLOW_ADMIN_MUTATIONS');
      return composio.updateTrigger(body.trigger_id, 'enable');
    case 'triggers.disable':
      requireExplicitFlag('COMPOSIO_ALLOW_ADMIN_MUTATIONS');
      return composio.updateTrigger(body.trigger_id, 'disable');
    case 'triggers.update':
      requireExplicitFlag('COMPOSIO_ALLOW_ADMIN_MUTATIONS');
      return composio.updateTrigger(body.trigger_id, body.patch);
    case 'triggers.delete':
      requireExplicitFlag('COMPOSIO_ALLOW_ADMIN_MUTATIONS');
      return composio.deleteTrigger(body.trigger_id);
    case 'webhooks.list':
      return composio.listWebhookSubscriptions(body.query);
    case 'webhooks.create':
      requireExplicitFlag('COMPOSIO_ALLOW_ADMIN_MUTATIONS');
      return composio.createWebhookSubscription(body.subscription);
    case 'webhooks.update':
      requireExplicitFlag('COMPOSIO_ALLOW_ADMIN_MUTATIONS');
      return composio.updateWebhookSubscription(body.subscription_id, body.subscription);
    case 'webhooks.rotate_secret':
      requireExplicitFlag('COMPOSIO_ALLOW_ADMIN_MUTATIONS');
      return composio.rotateWebhookSecret(body.subscription_id);
    default: {
      const err = new Error('Unknown Composio action');
      err.statusCode = 400;
      throw err;
    }
  }
}

async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return resp(204, {}, event);
  if (event.httpMethod !== 'POST') return resp(405, { ok: false, error: 'Method Not Allowed' }, event);
  if (!originAllowed(event)) return resp(403, { ok: false, error: 'Forbidden origin' }, event);

  const limited = rateLimit(event, {
    name: 'composio-router',
    limit: Number(process.env.RATE_LIMIT_COMPOSIO) || 30,
    windowMs: 60000,
  });
  if (limited) return { ...limited, headers: { ...(limited.headers || {}), ...corsHeaders(event) } };

  try {
    requireConfiguredToken(event);
    if (!composio.composioEnabled()) {
      return resp(503, { ok: false, error: 'Composio orchestration is disabled' }, event);
    }

    let body;
    try { body = JSON.parse(event.body || '{}'); }
    catch { return resp(400, { ok: false, error: 'Invalid JSON' }, event); }

    const action = String(body.action || '').trim();
    if (!action) return resp(400, { ok: false, error: 'action is required' }, event);

    const data = await dispatch(action, body);
    return resp(200, { ok: true, data }, event);
  } catch (err) {
    const status = Number(err && err.statusCode) || 500;
    // Composio errors can reflect account IDs, token fragments, provider
    // messages or request fields. Never echo raw upstream JSON to the caller.
    const upstream = Boolean(err && err.composio);
    const out = { ok: false, error: upstream
      ? 'Composio request rejected by upstream provider (details withheld)'
      : err && err.message ? err.message : 'Internal error' };
    return resp(status, out, event);
  }
}

exports.handler = handler;
exports.__internals = { originAllowed, requireConfiguredToken, dispatch };

/* Structured 5xx/exception telemetry. The wrapper never logs request bodies. */
exports.handler = withFunctionTelemetry('composio-router', exports.handler);
