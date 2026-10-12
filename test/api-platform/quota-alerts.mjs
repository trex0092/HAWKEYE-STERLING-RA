import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { classifyApiQuotaSignal, renderApiQuotaAlert, emitApiQuotaAlert }
  from '../../scripts/api-quota-alerts.mjs';

export async function run(check) {
  const headers = values => ({ get: key => values[key] ?? null });
  const native = classifyApiQuotaSignal('anthropic', 429, headers({
    'anthropic-ratelimit-requests-remaining': '2', 'anthropic-ratelimit-tokens-remaining': '3000',
    'x-ratelimit-remaining-tokens': '9999', 'retry-after': '47'
  }));
  check('quota alerts: native Anthropic headers take precedence over generic names',
    native.remaining_requests === 2 && native.remaining_tokens === 3000 && native.retry_after_seconds === 47);
  const legacy = classifyApiQuotaSignal('anthropic', 429, headers({ 'x-ratelimit-remaining-tokens': '120' }));
  check('quota alerts: absent native headers retain compatible legacy observations', legacy.remaining_tokens === 120);
  const malformed = classifyApiQuotaSignal('anthropic', 429, headers({
    'anthropic-ratelimit-tokens-remaining': 'Bearer PRIVATE', 'x-ratelimit-remaining-tokens': '9999'
  }));
  check('quota alerts: malformed native data is unknown, not replaced by a healthier fallback',
    malformed.remaining_tokens === null && !renderApiQuotaAlert(malformed).includes('PRIVATE'));
  check('quota alerts: rendered metadata cannot contain forged counters or contradictory categories',
    renderApiQuotaAlert({ ...native, remaining_tokens: 'SECRET\n::error' }) === null &&
    renderApiQuotaAlert({ ...native, condition: 'billing_or_access' }) === null &&
    renderApiQuotaAlert({ ...native, credential: 'SECRET' }) === null);
  check('quota alerts: a 429 remains ambiguous and normal HTTP success is not a credit alarm',
    renderApiQuotaAlert(native).includes('No actual credit balance') &&
    classifyApiQuotaSignal('openai', 200) === null);
  const root = mkdtempSync(join(tmpdir(), 'quota-fixture-'));
  const oldActions = process.env.GITHUB_ACTIONS;
  try {
    process.env.GITHUB_ACTIONS = 'true';
    const file = join(root, 'summary.md');
    const warnings = [];
    const sink = { summaryPath: file, warn: value => warnings.push(value) };
    check('quota alerts: duplicate job-local warnings and summaries are emitted once',
      emitApiQuotaAlert(native, sink) && emitApiQuotaAlert(native, sink) &&
      warnings.length === 1 && readFileSync(file, 'utf8').split('# Provider API').length === 2);
    check('quota alerts: a distinct provider remains independently alertable',
      emitApiQuotaAlert(classifyApiQuotaSignal('openai', 429), sink) && warnings.length === 2);
    check('quota alerts: summary write failures remain failures and do not suppress recovery',
      !emitApiQuotaAlert(native, { summaryPath: root, warn: () => {} }) &&
      emitApiQuotaAlert(native, { summaryPath: join(root, 'recovered.md'), warn: () => {} }));
  } finally {
    if (oldActions === undefined) delete process.env.GITHUB_ACTIONS;
    else process.env.GITHUB_ACTIONS = oldActions;
    rmSync(root, { recursive: true, force: true });
  }
}
