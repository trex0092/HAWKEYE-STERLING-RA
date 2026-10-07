/* Runtime telemetry regression tests.
 * Usage: node test/telemetry.test.mjs */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const require = createRequire(import.meta.url);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const telemetry = require('../netlify/functions/_telemetry');
const client = require('../netlify/functions/client-error-report');
const limiter = require('../netlify/functions/_ratelimit');

let passed = 0, failed = 0;
function check(name, cond) {
  if (cond) { passed++; console.log('  ok  ' + name); }
  else { failed++; console.log('FAIL  ' + name); }
}

console.log('\n— browser + function error telemetry —\n');

for (const page of ['index.html', 'console.html', 'advisor.html']) {
  const html = readFileSync(join(ROOT, page), 'utf8');
  check(page + ' loads telemetry.js', /<script defer src="telemetry\.js"><\/script>/.test(html));
}

const browser = readFileSync(join(ROOT, 'telemetry.js'), 'utf8');
check('browser collector listens for synchronous errors', browser.includes("addEventListener('error'"));
check('browser collector listens for unhandled promise rejections', browser.includes("addEventListener('unhandledrejection'"));
check('browser collector does not read localStorage', !/localStorage\s*(?:\.|\[)/.test(browser));
check('browser collector does not transmit stack traces', !/\.stack\b/.test(browser));
check('browser collector uses same-origin telemetry endpoint', browser.includes('/.netlify/functions/client-error-report'));

const publicFunctions = [
  'asana-mirror.js', 'asana-task.js', 'brain-soul.js', 'composio-router.js',
  'composio-webhook.js', 'csp-report.js', 'risk-backup.js', 'client-error-report.js'
];
for (const name of publicFunctions) {
  const src = readFileSync(join(ROOT, 'netlify', 'functions', name), 'utf8');
  check(name + ' is wrapped by structured function telemetry', src.includes("require('./_telemetry')") && /withFunctionTelemetry\(/.test(src));
}

telemetry._resetTelemetry();
const errors = [];
const oldError = console.error;
console.error = (line) => errors.push(String(line));
const returned = telemetry.withFunctionTelemetry('test-return', async () => ({ statusCode: 503, body: 'secret body' }));
const response = await returned({ httpMethod: 'POST', path: '/x?token=secret', headers: { 'x-nf-request-id': 'req-1' } });
check('returned 5xx is preserved', response.statusCode === 503);
check('returned 5xx emits structured function-error telemetry', errors.some(x => x.includes('[function-error]') && x.includes('"kind":"response-5xx"')));
check('function telemetry strips query strings and does not log response body', errors.every(x => !x.includes('token=secret') && !x.includes('secret body')));

telemetry._resetTelemetry();
errors.length = 0;
const thrown = telemetry.withFunctionTelemetry('test-throw', async () => { throw new Error('failure for user@example.com bearer abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG'); });
let threw = false;
try { await thrown({ httpMethod: 'GET', path: '/boom', headers: {} }); } catch { threw = true; }
check('thrown exception is rethrown after logging', threw);
check('thrown exception is logged without raw email/bearer token', errors.some(x => x.includes('[function-error]')) && errors.every(x => !x.includes('user@example.com') && !/bearer abcdef/i.test(x)));
console.error = oldError;

limiter._reset();
const warnings = [];
const oldWarn = console.warn;
console.warn = (line) => warnings.push(String(line));
const payload = {
  kind: 'window.error',
  page: '/advisor.html?case=private',
  source: '/advisor.js?token=private',
  line: 42,
  column: 7,
  message: 'Failed for analyst@example.com Bearer abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG'
};
const reportRes = await client.handler({
  httpMethod: 'POST',
  body: JSON.stringify(payload),
  headers: { 'x-nf-client-connection-ip': '203.0.113.10' }
});
console.warn = oldWarn;
check('client error report accepts valid telemetry with 204', reportRes.statusCode === 204);
check('client error report appears in monitoring log trail', warnings.some(x => x.includes('[client-error]') && x.includes('"line":42')));
check('client error log strips URL queries and sensitive message material',
  warnings.every(x => !x.includes('case=private') && !x.includes('token=private') && !x.includes('analyst@example.com') && !/Bearer abcdef/i.test(x)));

const huge = await client.handler({
  httpMethod: 'POST',
  body: 'x'.repeat(client.__internals.MAX_BODY + 1),
  headers: { 'x-nf-client-connection-ip': '203.0.113.11' }
});
check('oversize telemetry is rejected', huge.statusCode === 413);

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
