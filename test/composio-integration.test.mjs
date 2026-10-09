import { createRequire } from 'node:module';
import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const composio = require('../netlify/functions/_composio.js');
const policy = require('../netlify/functions/_composio-engine-policy.js');
const router = require('../netlify/functions/composio-router.js');
const webhook = require('../netlify/functions/composio-webhook.js');

let passed = 0, failed = 0;
const check = (name, cond) => {
  if (cond) { passed++; console.log('  ok  ' + name); }
  else { failed++; console.log('FAIL  ' + name); }
};

console.log('\nComposio integration tests\n');

const saved = {
  COMPOSIO_ENABLED: process.env.COMPOSIO_ENABLED,
  COMPOSIO_API_KEY: process.env.COMPOSIO_API_KEY,
  COMPOSIO_TOOLKITS: process.env.COMPOSIO_TOOLKITS,
  COMPOSIO_READ_TOOL_SLUGS: process.env.COMPOSIO_READ_TOOL_SLUGS,
  COMPOSIO_ALLOW_HOSTED_MCP: process.env.COMPOSIO_ALLOW_HOSTED_MCP,
  COMPOSIO_ALLOW_ADMIN_MUTATIONS: process.env.COMPOSIO_ALLOW_ADMIN_MUTATIONS,
  COMPOSIO_ALLOW_ADVANCED_SESSION: process.env.COMPOSIO_ALLOW_ADVANCED_SESSION,
  COMPOSIO_ALLOW_PRESIGNED_URLS: process.env.COMPOSIO_ALLOW_PRESIGNED_URLS,
  COMPOSIO_WEBHOOK_SECRET: process.env.COMPOSIO_WEBHOOK_SECRET,
  APP_SHARED_TOKEN: process.env.APP_SHARED_TOKEN,
};
const savedFetch = global.fetch;

try {
  process.env.COMPOSIO_ENABLED = '1';
  process.env.COMPOSIO_API_KEY = 'test-project-key';
  process.env.COMPOSIO_TOOLKITS = 'asana,gmail,googledrive,slack,github';
  delete process.env.COMPOSIO_READ_TOOL_SLUGS;
  delete process.env.COMPOSIO_ALLOW_HOSTED_MCP;
  delete process.env.COMPOSIO_ALLOW_ADMIN_MUTATIONS;
  delete process.env.COMPOSIO_ALLOW_ADVANCED_SESSION;
  delete process.env.COMPOSIO_ALLOW_PRESIGNED_URLS;

  check('Composio is enabled only with switch plus key', composio.composioEnabled() === true);
  check('default approved toolkits include the five governed business apps',
    ['asana','gmail','googledrive','slack','github'].every(x => composio.configuredToolkits().includes(x)));

  let rejected = false;
  try { composio._test.assertAllowedToolkit('dropbox'); } catch { rejected = true; }
  check('unregistered toolkit is rejected', rejected);

  rejected = false;
  try { composio._test.cleanId('../escape', 'id'); } catch { rejected = true; }
  check('unsafe path-like identifiers are rejected', rejected);

  let captured;
  global.fetch = async (url, init) => {
    captured = { url: String(url), init };
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ session_id: 'trs_test', mcp: { url: 'https://backend.composio.dev/mcp/test' } }),
    };
  };

  let hostedDenied = false;
  try {
    await composio.createSession('operator_1', { toolkits: ['asana', 'gmail'], mcp: true });
  } catch (err) { hostedDenied = /Hosted Composio MCP is disabled/.test(err.message); }
  check('hosted MCP cannot be silently enabled by an admin session request', hostedDenied);

  const session = await composio.createSession('operator_1', { toolkits: ['asana', 'gmail'] });
  check('session creation returns upstream payload', session.session_id === 'trs_test');
  check('session creation uses current v3.1 Tool Router endpoint',
    captured.url === 'https://backend.composio.dev/api/v3.1/tool_router/session');
  check('project key is carried only in x-api-key header',
    captured.init.headers['x-api-key'] === 'test-project-key'
    && !String(captured.init.body).includes('test-project-key'));
  const posted = JSON.parse(captured.init.body);
  check('session is restricted to requested approved toolkits',
    posted.toolkits.enable.join(',') === 'asana,gmail');
  check('hosted MCP is OFF and no app tool is executable with empty read allowlist',
    posted.mcp === false && posted.tools.asana.enable.length === 0 &&
    posted.tools.gmail.enable.length === 0);

  process.env.COMPOSIO_READ_TOOL_SLUGS = 'ASANA_GET_TASK,GMAIL_FETCH_EMAILS,GITHUB_GET_COMMIT';
  const approvedSession = await composio.createSession('operator_2', { toolkits: ['asana', 'gmail'] });
  const narrowed = JSON.parse(captured.init.body);
  check('session server configuration enforces exact reviewed read tools',
    approvedSession.session_id === 'trs_test' &&
    narrowed.tools.asana.enable.join(',') === 'ASANA_GET_TASK' &&
    narrowed.tools.gmail.enable.join(',') === 'GMAIL_FETCH_EMAILS');
  let toolOverrideDenied = false;
  try { await composio.createSession('operator_3', {
    toolkits: ['asana'], tools: { asana: { enable: ['ASANA_DELETE_TASK'] } }
  }); } catch (err) { toolOverrideDenied = /Unreviewed session/.test(err.message); }
  check('session callers cannot override approved tool filters or workbench policy', toolOverrideDenied);
  process.env.COMPOSIO_ALLOW_HOSTED_MCP = '1';
  await composio.createSession('operator_4', { toolkits: ['asana'], mcp: true });
  check('hosted MCP requires a separate approved server-side switch',
    JSON.parse(captured.init.body).mcp === true &&
    JSON.parse(captured.init.body).tools.asana.enable.join(',') === 'ASANA_GET_TASK');
  delete process.env.COMPOSIO_ALLOW_HOSTED_MCP;


  let upstreamCalls = 0;
  global.fetch = async (url, init) => {
    upstreamCalls++;
    captured = { url: String(url), init };
    return {
      ok: true, status: 200,
      text: async () => JSON.stringify({ data: { synthetic: true }, log_id: 'log_test' }),
    };
  };
  const read = await router.__internals.dispatch('tools.execute', {
    session_id: 'trs_synthetic',
    execution: { tool_slug: 'ASANA_GET_TASK', arguments: { task_id: 'SYNTHETIC-001' } }
  });
  check('approved exact read-only Composio action can execute through the router',
    read.data.synthetic && upstreamCalls === 1 &&
    captured.url.endsWith('/api/v3.1/tool_router/session/trs_synthetic/execute') &&
    JSON.parse(captured.init.body).tool_slug === 'ASANA_GET_TASK');

  async function rejects(action, body, expected = '403') {
    const previous = upstreamCalls;
    try { await router.__internals.dispatch(action, body); return false; }
    catch (err) { return err.statusCode === Number(expected) && upstreamCalls === previous; }
  }

  check('unknown tool denied before provider cost or confidential data egress',
    await rejects('tools.execute', {
      session_id: 'trs_synthetic',
      execution: { tool_slug: 'ASANA_GET_USER', arguments: {} }
    }));
  check('write action denied even when present in an operator typo allowlist',
    (() => { process.env.COMPOSIO_READ_TOOL_SLUGS += ',GMAIL_SEND_EMAIL'; return true; })() &&
    await rejects('tools.execute', {
      session_id: 'trs_synthetic',
      execution: { tool_slug: 'GMAIL_SEND_EMAIL', arguments: { body: 'secret' } }
    }));
  check('meta remote shell is blocked independently of toolkit allowlist',
    await rejects('tools.execute_meta', {
      session_id: 'trs_synthetic', execution: { slug: 'COMPOSIO_REMOTE_BASH_TOOL', arguments: {} }
    }));
  check('meta multi-execute cannot bundle hidden write operations',
    await rejects('tools.execute_meta', {
      session_id: 'trs_synthetic', execution: {
        slug: 'COMPOSIO_MULTI_EXECUTE_TOOL', arguments: { tools: [] }
      }
    }));
  const meta = await router.__internals.dispatch('tools.execute_meta', {
    session_id: 'trs_synthetic',
    execution: { slug: 'COMPOSIO_GET_TOOL_SCHEMAS', arguments: { tool_slugs: ['ASANA_GET_TASK'] } }
  });
  check('read-only meta schema lookup remains available', meta.data.synthetic && upstreamCalls === 2);
  check('large tool arguments fail before external network call',
    await rejects('tools.execute', { session_id: 'trs_synthetic',
      execution: { tool_slug: 'ASANA_GET_TASK', arguments: { query: 'x'.repeat(9000) } }
    }));
  check('session update cannot unilaterally enable workbench or all tools',
    await (async () => {
      try { await composio.updateSession('trs_synthetic', { workbench: { enabled: true } });
        return false; } catch (err) { return /cannot be overridden/.test(err.message); }
    })());
  check('administrative mutations and presigned file links are disabled by default',
    await rejects('mount.delete', { session_id: 'trs_synthetic', mount_id: 'm_1', file: {} }) &&
    await rejects('mount.download_url', { session_id: 'trs_synthetic', mount_id: 'm_1', file: {} }) &&
    await rejects('triggers.create', { user_id: 'operator_2', slug: 'GITHUB_PUSH_EVENT' }) &&
    await rejects('webhooks.rotate_secret', { subscription_id: 'subscription_1' }));

  const currentPolicy = policy.readSlugs();
  check('Composio read-tool allowlist is explicit, not any discovered app tool',
    currentPolicy.has('ASANA_GET_TASK') && !currentPolicy.has('ASANA_DELETE_TASK'));

  process.env.APP_SHARED_TOKEN = 'shared-test-token';
  const goodEvent = { headers: { 'x-app-token': 'shared-test-token' } };
  let gateOk = true;
  try { router.__internals.requireConfiguredToken(goodEvent); } catch { gateOk = false; }
  check('router requires and accepts configured APP_SHARED_TOKEN', gateOk);

  let gateDenied = false;
  try { router.__internals.requireConfiguredToken({ headers: {} }); } catch (e) { gateDenied = e.statusCode === 401; }
  check('router rejects missing APP_SHARED_TOKEN header', gateDenied);


  global.fetch = async () => ({
    ok: false, status: 400,
    text: async () => JSON.stringify({
      error: { message: 'SECRET-ACCOUNT-ID-DO-NOT-EXPOSE', request_data: 'PRIVATE_PERSON' }
    }),
  });
  const apiErr = await router.handler({
    httpMethod: 'POST',
    headers: { 'x-app-token': 'shared-test-token', host: 'hawkeye-sterling-ra.netlify.app' },
    body: JSON.stringify({ action: 'tools.list', session_id: 'trs_synthetic' }),
  });
  check('Composio upstream failure never reflects provider account/PPI diagnostics',
    apiErr.statusCode === 400 &&
    !String(apiErr.body).includes('SECRET-ACCOUNT-ID-DO-NOT-EXPOSE') &&
    !String(apiErr.body).includes('PRIVATE_PERSON'));

  process.env.COMPOSIO_WEBHOOK_SECRET = 'webhook-test-secret';
  const id = 'msg_test';
  const ts = String(Math.floor(Date.now() / 1000));
  const payload = JSON.stringify({ type: 'composio.trigger.message', metadata: { trigger_slug: 'GITHUB_PUSH_EVENT' }, data: { x: 1 } });
  const sig = 'v1,' + crypto.createHmac('sha256', process.env.COMPOSIO_WEBHOOK_SECRET)
    .update(id + '.' + ts + '.' + payload).digest('base64');
  const verified = webhook.__internals.verify({
    body: payload,
    headers: { 'webhook-id': id, 'webhook-timestamp': ts, 'webhook-signature': sig },
  });
  check('signed Composio webhook verifies', verified.ok === true);

  const tampered = webhook.__internals.verify({
    body: payload + 'x',
    headers: { 'webhook-id': id, 'webhook-timestamp': ts, 'webhook-signature': sig },
  });
  check('tampered Composio webhook is rejected', tampered.ok === false && tampered.statusCode === 401);

  const adapterSrc = readFileSync('netlify/functions/_composio.js', 'utf8');
  const routerSrc = readFileSync('netlify/functions/composio-router.js', 'utf8');
  check('Composio code does not import screening or scoring engines',
    !/sanctions-screen|screen\.py|pep-worldwide|screening-assurance|risk-score/.test(adapterSrc + routerSrc));
  check('raw proxy execution remains separately gated',
    /COMPOSIO_ALLOW_PROXY/.test(routerSrc));
} finally {
  global.fetch = savedFetch;
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}

console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
if (failed) process.exitCode = 1;
