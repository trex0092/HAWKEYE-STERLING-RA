/* Provider quota classification and redacted GitHub Actions notifications.
 * HTTP 429 alone does not prove exhausted credits. Deduplication below is
 * process/job-local, not a durable cross-run notification-delivery receipt.
 */
import { appendFileSync } from 'node:fs';
const PROVIDERS = new Set(['openai', 'anthropic']);
const COUNTERS = ['retry_after_seconds', 'remaining_requests', 'remaining_tokens'];
const FIELDS = ['schema', 'provider', 'condition', 'http_status', ...COUNTERS];
const sent = new Set();
function finiteCounter(s) {
  if (s == null || !/^\d{1,12}$/.test(String(s))) return null;
  const n = Number(s);
  return Number.isSafeInteger(n) && n <= 1000000000 ? n : null;
}
function conditionFor(status) {
  return status === 429 ? 'rate_or_quota' :
    [401, 402, 403].includes(status) ? 'billing_or_access' : null;
}
function validSignal(signal) {
  return signal && typeof signal === 'object' && !Array.isArray(signal) &&
    Object.keys(signal).sort().join('|') === [...FIELDS].sort().join('|') &&
    signal.schema === 1 && PROVIDERS.has(signal.provider) &&
    conditionFor(signal.http_status) !== null &&
    signal.condition === conditionFor(signal.http_status) &&
    COUNTERS.every(key => signal[key] === null ||
      (Number.isSafeInteger(signal[key]) && signal[key] >= 0 && signal[key] <= 1000000000));
}
export function classifyApiQuotaSignal(provider, status, headers = null) {
  if (!PROVIDERS.has(provider) || !Number.isInteger(status)) return null;
  const condition = conditionFor(status);
  if (!condition) return null;
  const get = key => {
    try { return headers && typeof headers.get === 'function' ? headers.get(key) : null; }
    catch { return null; }
  };
  // Anthropic documents its own header names. A legacy x-ratelimit fallback
  // is retained only when the native header is absent, not when malformed.
  // https://platform.claude.com/docs/en/api/rate-limits#response-headers
  const remaining = type => {
    const native = provider === 'anthropic' ? get('anthropic-ratelimit-' + type + '-remaining') : null;
    return finiteCounter(native == null ? get('x-ratelimit-remaining-' + type) : native);
  };
  return {
    schema: 1, provider, condition, http_status: status,
    retry_after_seconds: finiteCounter(get('retry-after')),
    remaining_requests: remaining('requests'), remaining_tokens: remaining('tokens')
  };
}
export function renderApiQuotaAlert(signal) {
  if (!validSignal(signal)) return null;
  const lines = ['# Provider API budget/limit alert', '', 'Provider: **' + signal.provider + '**',
    'Category: **' + signal.condition.replaceAll('_', ' ') + '**',
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
  const key = JSON.stringify([summaryPath, process.env.GITHUB_RUN_ID || '',
    signal.provider, signal.condition]);
  if (sent.has(key)) return true;
  let emitted = false, failed = false;
  const warning = text => { try { warn(text); return true; } catch { return false; } };
  if (summaryPath) {
    try { appendFileSync(summaryPath, '\n' + markdown); emitted = true; }
    catch { failed = true; warning('API quota summary could not be written'); }
  }
  if (process.env.GITHUB_ACTIONS === 'true') {
    const ok = warning('::warning title=Provider API limit::Review ' + signal.provider +
      ' account: HTTP ' + signal.http_status);
    emitted ||= ok;
    failed ||= !ok;
  }
  if (emitted && !failed) {
    if (sent.size >= 64) sent.delete(sent.values().next().value);
    sent.add(key);
  }
  // true means a valid signal was handled; it is NOT an external receipt.
  // Failed writes are not remembered, so a subsequent attempt may recover.
  return !failed;
}
