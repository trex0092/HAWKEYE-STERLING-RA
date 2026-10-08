/* Runtime telemetry regression tests.
 * Usage: node test/telemetry.test.mjs */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { SCHEMA, ZERO_HASH, sealEvidenceReceipt, verifyEvidenceReceipts } from '../scripts/evidence-receipts.mjs';

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


/* Offline decision-evidence metadata chain. The receipts do NOT contain names,
   prompt content or customer records, and are not durable until a protected
   separately owned append-only store preserves the external anchor. */
const evidenceSecret = 'synthetic-no-production-evidence-hmac-key-0123456789';
const fakeEvidence = createHash('sha256').update('synthetic-test-only', 'utf8').digest('hex');
const entry = {
  schema: SCHEMA, sequence: 1, case_ref: 'CASE-000001',
  event_time: '2026-10-08T09:00:00.000Z',
  actor_ref: 'actor:synthetic-001', actor_role: 'Analyst',
  action: 'REVIEW_REQUESTED', outcome: 'REVIEW_REQUIRED',
  evidence_hashes: [fakeEvidence], review_receipt_hash: null,
  prev_hash: ZERO_HASH
};
const first = sealEvidenceReceipt(entry, evidenceSecret);
const second = sealEvidenceReceipt({
  ...entry, sequence: 2, event_time: '2026-10-08T09:05:00.000Z',
  actor_ref: 'actor:synthetic-002', actor_role: 'Reviewer-MLRO',
  action: 'MLRO_REVIEWED', outcome: 'REVIEWED', prev_hash: first.hash
}, evidenceSecret);
const verified = verifyEvidenceReceipts([first, second], evidenceSecret, {
  expectedHeadHash: second.hash, expectedCount: 2
});
check('evidence receipt chain accepts metadata-only signed and externally anchored sequence',
  verified.valid && verified.count === 2 && verified.head_hash === second.hash);
check('receipt content is metadata only, never raw case evidence',
  !JSON.stringify([first, second]).includes('synthetic-test-only') &&
  !Object.hasOwn(first, 'case_notes') &&
  first.evidence_hashes.length === 1 && first.evidence_hashes[0] === fakeEvidence);
check('any forged event contents break HMAC and hash integrity',
  !verifyEvidenceReceipts([{ ...first, outcome: 'DELIVERED' }, second], evidenceSecret).valid);
check('a modified MAC is rejected',
  !verifyEvidenceReceipts([{ ...first, hmac: ZERO_HASH }, second], evidenceSecret).valid);
check('a different verification key cannot validate the original receipts',
  !verifyEvidenceReceipts([first, second], 'synthetic-different-secret-01234567890123').valid);
check('reordered receipts fail ordered chain sequence checking',
  !verifyEvidenceReceipts([second, first], evidenceSecret).valid);
check('a missing middle or first event breaks the original chain',
  !verifyEvidenceReceipts([second], evidenceSecret).valid);
check('an external expected count and head reveal truncation at the end',
  !verifyEvidenceReceipts([first], evidenceSecret,
    { expectedCount: 2, expectedHeadHash: second.hash }).valid);
check('a pure hash chain without a separately retained anchor cannot prove no suffix loss',
  verifyEvidenceReceipts([first], evidenceSecret).valid === true);

let rejectedNotes = false;
try { sealEvidenceReceipt({ ...entry, case_notes: 'customer private text' }, evidenceSecret); }
catch { rejectedNotes = true; }
check('receipt builder refuses unregistered sensitive metadata fields', rejectedNotes);

let rejectedAction = false;
try { sealEvidenceReceipt({ ...entry, action: 'FILE_SAR' }, evidenceSecret); }
catch { rejectedAction = true; }
check('receipt schema does not permit automatic regulatory filing actions', rejectedAction);

let rejectedName = false;
try { sealEvidenceReceipt({ ...entry, actor_ref: 'analyst@example.test' }, evidenceSecret); }
catch { rejectedName = true; }
check('receipt actor uses a bounded opaque reference, not an email address', rejectedName);

const badTime = sealEvidenceReceipt({
  ...entry, sequence: 2, event_time: '2026-10-08T08:00:00.000Z', prev_hash: first.hash
}, evidenceSecret);
check('a signed but chronologically reversed receipt is rejected',
  !verifyEvidenceReceipts([first, badTime], evidenceSecret).valid);

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
