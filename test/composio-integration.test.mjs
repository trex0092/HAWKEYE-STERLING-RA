import { createRequire } from 'node:module';
import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const composio = require('../netlify/functions/_composio.js');
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
  COMPOSIO_WEBHOOK_SECRET: process.env.COMPOSIO_WEBHOOK_SECRET,
  APP_SHARED_TOKEN: process.env.APP_SHARED_TOKEN,
};
const savedFetch = global.fetch;

try {
  process.env.COMPOSIO_ENABLED = '1';
  process.env.COMPOSIO_API_KEY = 'test-project-key';
  process.env.COMPOSIO_TOOLKITS = 'asana,gmail,googledrive,slack,github';

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

  const session = await composio.createSession('operator_1', { toolkits: ['asana', 'gmail'], mcp: true });
  check('session creation returns upstream payload', session.session_id === 'trs_test');
  check('session creation uses current v3.1 Tool Router endpoint',
    captured.url === 'https://backend.composio.dev/api/v3.1/tool_router/session');
  check('project key is carried only in x-api-key header',
    captured.init.headers['x-api-key'] === 'test-project-key'
    && !String(captured.init.body).includes('test-project-key'));
  const posted = JSON.parse(captured.init.body);
  check('session is restricted to requested approved toolkits',
    posted.toolkits.enable.join(',') === 'asana,gmail');
  check('session can expose MCP metadata without exposing the project key', posted.mcp === true);

  process.env.APP_SHARED_TOKEN = 'shared-test-token';
  const goodEvent = { headers: { 'x-app-token': 'shared-test-token' } };
  let gateOk = true;
  try { router.__internals.requireConfiguredToken(goodEvent); } catch { gateOk = false; }
  check('router requires and accepts configured APP_SHARED_TOKEN', gateOk);

  let gateDenied = false;
  try { router.__internals.requireConfiguredToken({ headers: {} }); } catch (e) { gateDenied = e.statusCode === 401; }
  check('router rejects missing APP_SHARED_TOKEN header', gateDenied);

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
