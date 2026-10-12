/* Offline regression checks: Advisor live-eval errors must never expose
 * provider diagnostics, account IDs, reflected customer data, or credentials.
 * All API failures keep the eval INCOMPLETE rather than reporting a behavioural
 * regression or burning further API requests. */
import { classifyAdvisorEvalFailure } from '../scripts/advisor-eval-http.mjs';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

let passed = 0, failed = 0;
function check(name, predicate) {
  if (predicate) { passed++; console.log('  ok  ' + name); }
  else { failed++; console.error('FAIL ' + name); }
}
const sensitive = 'ACCOUNT-ID-PRIVATE-12345 KEY-SYNTHETIC-SECRET-CANNOT-BE-LOGGED';
const quota = classifyAdvisorEvalFailure(400,
  'You have reached your specified API usage limits. You will regain access on 2026-11-01. ' +
  sensitive);
check('monthly usage limit is an evaluation coverage outage, not behavioural drift',
  quota.category === 'quota_or_billing' && quota.stop_run === true &&
  quota.status_code === 400);
check('error body and customer/credential identifiers never enter error output',
  !JSON.stringify(quota).includes(sensitive) &&
  !JSON.stringify(quota).includes('2026-11-01'));
check('transient HTTP 429 stops repeated model calls for this evaluation run',
  classifyAdvisorEvalFailure(429, 'rate limit; retry later').category === 'rate_limited' &&
  classifyAdvisorEvalFailure(429, 'rate limit; retry later').stop_run === true);
check('authentication problems stop further requests without exposing content',
  classifyAdvisorEvalFailure(401, sensitive).category === 'access_denied' &&
  classifyAdvisorEvalFailure(403, sensitive).stop_run === true);
check('500/503 upstream failures stop a runaway eval loop',
  classifyAdvisorEvalFailure(500, '').category === 'provider_unavailable' &&
  classifyAdvisorEvalFailure(503, sensitive).stop_run === true);
check('ordinary HTTP 400 schema errors are not invented as monthly quota errors',
  classifyAdvisorEvalFailure(400, 'invalid max_tokens').category === 'invalid_request' &&
  classifyAdvisorEvalFailure(400, 'invalid max_tokens').stop_run === true);
check('402 billing error stops run even if response has no JSON message',
  classifyAdvisorEvalFailure(402).category === 'quota_or_billing' &&
  classifyAdvisorEvalFailure(402).stop_run);
check('unknown status remains bounded and source-independent',
  classifyAdvisorEvalFailure(Number.NaN, sensitive).status_code === 0 &&
  !JSON.stringify(classifyAdvisorEvalFailure(0, sensitive)).includes(sensitive));
// Drive BOTH real CLI entrypoints without a credential or network. A missing
// key used to exit zero, so Freshness Check accepted the skipped evaluation
// as genuine live assurance for the full cadence window.
for (const [script, report] of [
  ['advisor-eval.mjs', 'advisor-eval-report.md'],
  ['advisor-bias-eval.mjs', 'advisor-bias-eval-report.md'],
]) {
  const root = mkdtempSync(join(tmpdir(), 'hsra-eval-no-key-'));
  try {
    const cli = fileURLToPath(new URL('../scripts/' + script, import.meta.url));
    const run = spawnSync(process.execPath, [cli], {
      cwd: root, encoding: 'utf8', timeout: 12000,
      env: { ...process.env, ANTHROPIC_API_KEY: '' }
    });
    const body = readFileSync(join(root, report), 'utf8');
    check(script + ' fails closed on missing credentials and writes actual INCOMPLETE evidence',
      run.status === 1 && body.includes('**Result: INCOMPLETE') &&
      body.includes('NOT ') && !body.includes('Result: all ') &&
      !body.includes('no unexplained divergences'));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}
// Provider model overrides are untrusted configuration. Malformed overrides
// must fail BEFORE fetching and never produce "all 0 cases held".
for (const [script, report, model] of [
  ['advisor-eval.mjs', 'advisor-eval-report.md', ',,,'],
  ['advisor-eval.mjs', 'advisor-eval-report.md', 'claude-sonnet-5,claude-sonnet-5'],
  ['advisor-eval.mjs', 'advisor-eval-report.md',
    Array(7).fill('claude-sonnet-5').join(',')],
  ['advisor-bias-eval.mjs', 'advisor-bias-eval-report.md', ','],
]) {
  const root = mkdtempSync(join(tmpdir(), 'hsra-eval-bad-model-'));
  try {
    const cli = fileURLToPath(new URL('../scripts/' + script, import.meta.url));
    const run = spawnSync(process.execPath, [cli], {
      cwd: root, encoding: 'utf8', timeout: 12000,
      env: { ...process.env, ANTHROPIC_API_KEY: 'synthetic-offline-key',
        ANTHROPIC_MODEL: model }
    });
    const body = readFileSync(join(root, report), 'utf8');
    check(script + ' refuses malformed model list with no live requests',
      run.status === 1 && body.includes('**Result: INCOMPLETE') &&
      /\bno\b[^.]*evaluated/i.test(body) &&
      !body.includes('all 0 guardrail cases held') &&
      run.stderr.includes('invalid model routing configuration'));
  } finally { rmSync(root, { recursive: true, force: true }); }
}
console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
