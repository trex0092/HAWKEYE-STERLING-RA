'use strict';

/* Server-side Composio adapter for Hawkeye Sterling.
 *
 * This wrapper intentionally uses Composio's documented HTTP API directly
 * instead of adding a runtime npm dependency to the static application.
 * The COMPOSIO_API_KEY never reaches the browser.
 *
 * Scope:
 *   - Tool Router sessions
 *   - toolkit/tool discovery
 *   - account linking
 *   - tool execution
 *   - MCP session metadata
 *   - proxy execution
 *   - session mounts/files
 *   - trigger discovery/management
 *   - webhook subscription management
 *
 * Hawkeye's sanctions, PEP, adverse-media, scoring and assurance engines do
 * not depend on this adapter. Composio is an outer orchestration layer only.
 */

const DEFAULT_BASE_URL = 'https://backend.composio.dev';
const DEFAULT_TOOLKITS = ['asana', 'gmail', 'googledrive', 'slack', 'github'];

function boolEnv(name, fallback = false) {
  const raw = process.env[name];
  if (raw === undefined || raw === null || raw === '') return fallback;
  return /^(1|true|yes|on)$/i.test(String(raw));
}

function composioEnabled() {
  return boolEnv('COMPOSIO_ENABLED', false) && Boolean(process.env.COMPOSIO_API_KEY);
}

function baseUrl() {
  return String(process.env.COMPOSIO_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, '');
}

function configuredToolkits() {
  const raw = String(process.env.COMPOSIO_TOOLKITS || '').trim();
  const items = raw ? raw.split(',') : DEFAULT_TOOLKITS;
  const out = items.map(x => x.trim().toLowerCase()).filter(Boolean);
  return [...new Set(out)];
}

function cleanId(value, label) {
  const v = String(value || '').trim();
  if (!v || !/^[A-Za-z0-9._:@-]{1,200}$/.test(v)) {
    throw new Error('invalid ' + label);
  }
  return v;
}

function cleanSlug(value, label = 'slug') {
  const v = String(value || '').trim().toLowerCase();
  if (!v || !/^[a-z0-9_-]{1,100}$/.test(v)) throw new Error('invalid ' + label);
  return v;
}

function assertAllowedToolkit(value) {
  const slug = cleanSlug(value, 'toolkit');
  if (!configuredToolkits().includes(slug)) {
    throw new Error('toolkit not allowed: ' + slug);
  }
  return slug;
}

function allowedToolkits(values) {
  const list = Array.isArray(values) && values.length ? values : configuredToolkits();
  return [...new Set(list.map(assertAllowedToolkit))];
}

function encodeQuery(query) {
  if (!query || typeof query !== 'object') return '';
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) {
      for (const item of value) params.append(key, String(item));
    } else {
      params.set(key, String(value));
    }
  }
  const s = params.toString();
  return s ? '?' + s : '';
}

async function request(method, path, { body, query, timeoutMs = 20000 } = {}) {
  if (!composioEnabled()) {
    const err = new Error('Composio is disabled or COMPOSIO_API_KEY is not configured');
    err.statusCode = 503;
    throw err;
  }
  if (!/^\/api\/v3(?:\.1)?\//.test(path)) {
    throw new Error('refusing non-Composio API path');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(1000, Number(timeoutMs) || 20000));
  try {
    const response = await fetch(baseUrl() + path + encodeQuery(query), {
      method,
      headers: {
        'x-api-key': process.env.COMPOSIO_API_KEY,
        'accept': 'application/json',
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });

    const text = await response.text();
    let payload = null;
    if (text) {
      try { payload = JSON.parse(text); }
      catch { payload = { raw: text.slice(0, 4000) }; }
    }

    if (!response.ok) {
      const err = new Error('Composio API request failed with HTTP ' + response.status);
      err.statusCode = response.status;
      err.composio = payload;
      throw err;
    }
    return payload;
  } finally {
    clearTimeout(timer);
  }
}

function sessionPath(sessionId, suffix = '') {
  return '/api/v3.1/tool_router/session/' + encodeURIComponent(cleanId(sessionId, 'session id')) + suffix;
}

async function createSession(userId, options = {}) {
  const toolkits = allowedToolkits(options.toolkits);
  const body = {
    user_id: cleanId(userId, 'user id'),
    toolkits: { enable: toolkits },
    manage_connections: options.manageConnections === false ? false : true,
    mcp: options.mcp === true,
  };

  if (options.authConfigs && typeof options.authConfigs === 'object') body.auth_configs = options.authConfigs;
  if (options.connectedAccounts && typeof options.connectedAccounts === 'object') body.connected_accounts = options.connectedAccounts;
  if (options.tools && typeof options.tools === 'object') body.tools = options.tools;
  if (options.tags && typeof options.tags === 'object') body.tags = options.tags;
  if (options.preload && typeof options.preload === 'object') body.preload = options.preload;
  if (options.workbench && typeof options.workbench === 'object') body.workbench = options.workbench;

  return request('POST', '/api/v3.1/tool_router/session', { body });
}

function getSession(sessionId) {
  return request('GET', sessionPath(sessionId));
}

function updateSession(sessionId, patch) {
  if (!patch || typeof patch !== 'object') throw new Error('session patch is required');
  const body = { ...patch };
  if (body.toolkits) {
    const requested = Array.isArray(body.toolkits) ? body.toolkits : body.toolkits.enable;
    body.toolkits = { enable: allowedToolkits(requested) };
  }
  return request('PATCH', sessionPath(sessionId), { body });
}

function deleteSession(sessionId) {
  return request('DELETE', sessionPath(sessionId));
}

function attachSession(sessionId, body = {}) {
  return request('POST', sessionPath(sessionId, '/attach'), { body });
}

function sessionTools(sessionId) {
  return request('GET', sessionPath(sessionId, '/tools'));
}

function sessionToolkits(sessionId) {
  return request('GET', sessionPath(sessionId, '/toolkits'));
}

function searchTools(sessionId, query) {
  if (!query || typeof query !== 'object') throw new Error('search query body is required');
  return request('POST', sessionPath(sessionId, '/search'), { body: query });
}

function executeTool(sessionId, body) {
  if (!body || typeof body !== 'object') throw new Error('tool execution body is required');
  return request('POST', sessionPath(sessionId, '/execute'), { body, timeoutMs: 60000 });
}

function executeMeta(sessionId, body) {
  if (!body || typeof body !== 'object') throw new Error('meta-tool execution body is required');
  return request('POST', sessionPath(sessionId, '/execute_meta'), { body, timeoutMs: 60000 });
}

function linkToolkit(sessionId, body) {
  if (!body || typeof body !== 'object') throw new Error('link body is required');
  if (body.toolkit) body = { ...body, toolkit: assertAllowedToolkit(body.toolkit) };
  if (body.toolkit_slug) body = { ...body, toolkit_slug: assertAllowedToolkit(body.toolkit_slug) };
  return request('POST', sessionPath(sessionId, '/link'), { body });
}

function proxyExecute(sessionId, body) {
  if (!body || typeof body !== 'object') throw new Error('proxy body is required');
  return request('POST', sessionPath(sessionId, '/proxy_execute'), { body, timeoutMs: 60000 });
}

function listMountItems(sessionId, mountId, query = {}) {
  const mount = encodeURIComponent(cleanId(mountId, 'mount id'));
  return request('GET', sessionPath(sessionId, '/mounts/' + mount + '/items'), { query });
}

function mountDownloadUrl(sessionId, mountId, body) {
  const mount = encodeURIComponent(cleanId(mountId, 'mount id'));
  return request('POST', sessionPath(sessionId, '/mounts/' + mount + '/download_url'), { body });
}

function mountUploadUrl(sessionId, mountId, body) {
  const mount = encodeURIComponent(cleanId(mountId, 'mount id'));
  return request('POST', sessionPath(sessionId, '/mounts/' + mount + '/upload_url'), { body });
}

function mountDelete(sessionId, mountId, body) {
  const mount = encodeURIComponent(cleanId(mountId, 'mount id'));
  return request('POST', sessionPath(sessionId, '/mounts/' + mount + '/delete'), { body });
}

function listTriggerTypes(query = {}) {
  return request('GET', '/api/v3.1/triggers_types', { query });
}

function getTriggerType(slug) {
  return request('GET', '/api/v3.1/triggers_types/' + encodeURIComponent(cleanId(slug, 'trigger slug')));
}

function listActiveTriggers(query = {}) {
  return request('GET', '/api/v3.1/trigger_instances/active', { query });
}

function createTrigger(userId, slug, options = {}) {
  const toolkit = String(slug || '').split('_')[0].toLowerCase();
  if (toolkit) assertAllowedToolkit(toolkit === 'google' ? 'googledrive' : toolkit);
  const body = {
    user_id: cleanId(userId, 'user id'),
    trigger_config: options.triggerConfig || {},
  };
  if (options.connectedAccountId) body.connected_account_id = cleanId(options.connectedAccountId, 'connected account id');
  if (options.toolkitVersions) body.toolkit_versions = options.toolkitVersions;
  return request('POST', '/api/v3.1/trigger_instances/' + encodeURIComponent(cleanId(slug, 'trigger slug')) + '/upsert', { body });
}

function updateTrigger(triggerId, statusOrPatch) {
  const body = typeof statusOrPatch === 'string' ? { status: statusOrPatch } : statusOrPatch;
  if (!body || typeof body !== 'object') throw new Error('trigger patch is required');
  return request('PATCH', '/api/v3.1/trigger_instances/manage/' + encodeURIComponent(cleanId(triggerId, 'trigger id')), { body });
}

function deleteTrigger(triggerId) {
  return request('DELETE', '/api/v3.1/trigger_instances/manage/' + encodeURIComponent(cleanId(triggerId, 'trigger id')));
}

function listWebhookSubscriptions(query = {}) {
  return request('GET', '/api/v3.1/webhook_subscriptions', { query });
}

function createWebhookSubscription(body) {
  if (!body || typeof body !== 'object') throw new Error('webhook subscription body is required');
  return request('POST', '/api/v3.1/webhook_subscriptions', { body });
}

function updateWebhookSubscription(id, body) {
  if (!body || typeof body !== 'object') throw new Error('webhook subscription body is required');
  return request('PATCH', '/api/v3.1/webhook_subscriptions/' + encodeURIComponent(cleanId(id, 'subscription id')), { body });
}

function rotateWebhookSecret(id) {
  return request('POST', '/api/v3.1/webhook_subscriptions/' + encodeURIComponent(cleanId(id, 'subscription id')) + '/rotate_secret');
}

module.exports = {
  DEFAULT_TOOLKITS,
  composioEnabled,
  configuredToolkits,
  request,
  createSession,
  getSession,
  updateSession,
  deleteSession,
  attachSession,
  sessionTools,
  sessionToolkits,
  searchTools,
  executeTool,
  executeMeta,
  linkToolkit,
  proxyExecute,
  listMountItems,
  mountDownloadUrl,
  mountUploadUrl,
  mountDelete,
  listTriggerTypes,
  getTriggerType,
  listActiveTriggers,
  createTrigger,
  updateTrigger,
  deleteTrigger,
  listWebhookSubscriptions,
  createWebhookSubscription,
  updateWebhookSubscription,
  rotateWebhookSecret,
  _test: { allowedToolkits, assertAllowedToolkit, cleanId, cleanSlug, encodeQuery, boolEnv },
};
