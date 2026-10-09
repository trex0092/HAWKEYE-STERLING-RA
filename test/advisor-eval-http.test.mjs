/* Offline regression checks: Advisor live-eval errors must never expose
 * provider diagnostics, account IDs, reflected customer data, or credentials.
 * All API failures keep the eval INCOMPLETE rather than reporting a behavioural
 * regression or burning further API requests. */
import { classifyAdvisorEvalFailure } from '../scripts/advisor-eval-http.mjs';

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
console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
