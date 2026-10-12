/* Pure provider quota classification and redacted GitHub Actions notifications.
 * A 429 cannot by itself prove that a customer's API credits are exhausted.
 */
import { appendFileSync } from 'node:fs';
const PROVIDERS = new Set(['openai', 'anthropic']);
function finiteCounter(s) {
  if (s == null || !/^\d{1,12}$/.test(String(s))) return null;
  const n = Number(s);
  return Number.isSafeInteger(n) && n <= 1000000000 ? n : null;
}
export function classifyApiQuotaSignal(provider, status, headers = null) {
  if (!PROVIDERS.has(provider) || !Number.isInteger(status)) return null;
  const condition = status === 429 ? 'rate_or_quota' :
    [401, 402, 403].includes(status) ? 'billing_or_access' : null;
  if (!condition) return null;
  const get = key => {
    try { return headers && typeof headers.get === 'function' ? headers.get(key) : null; }
    catch { return null; }
  };
  return {
    schema: 1, provider, condition, http_status: status,
    retry_after_seconds: finiteCounter(get('retry-after')),
    remaining_requests: finiteCounter(get('x-ratelimit-remaining-requests')),
    remaining_tokens: finiteCounter(get('x-ratelimit-remaining-tokens'))
  };
}
export function renderApiQuotaAlert(signal) {
  if (!signal || signal.schema !== 1 || !PROVIDERS.has(signal.provider) ||
      !['rate_or_quota', 'billing_or_access'].includes(signal.condition) ||
      ![401, 402, 403, 429].includes(signal.http_status)) return null;
  const lines = ['# Provider API budget/limit alert', '', 'Provider: **' + signal.provider + '**',
    'Category: **' + signal.condition.replaceAll('_',' ') + '**',
    'HTTP: **' + signal.http_status + '**'];
  if (signal.retry_after_seconds !== null) lines.push('Retry-after: **' + signal.retry_after_seconds + ' seconds**');
  if (signal.remaining_requests !== null) lines.push('Requests remaining: **' + signal.remaining_requests + '**');
  if (signal.remaining_tokens !== null) lines.push('Tokens remaining: **' + signal.remaining_tokens + '**');
  lines.push('', 'Stop optional repeat calls and inspect the provider account manually.',
    'No actual credit balance is inferred from HTTP 429 alone.');
  return lines.join('\n') + '\n';
}
export function emitApiQuotaAlert(signal, { summaryPath = process.env.GITHUB_STEP_SUMMARY || '',
  warn = message => console.warn(message) } = {}) {
  const markdown = renderApiQuotaAlert(signal);
  if (!markdown) return false;
  if (summaryPath) {
    try { appendFileSync(summaryPath, '\n' + markdown); }
    catch { warn('API quota summary could not be written'); }
  }
  if (process.env.GITHUB_ACTIONS === 'true') warn('::warning title=Provider API limit::Review ' +
    signal.provider + ' account: HTTP ' + signal.http_status);
  return true;
}
