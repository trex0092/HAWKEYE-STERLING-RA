/* Redacted, non-customer API quota/billing alerts.
 * A provider HTTP status is NOT a provider balance measurement. Never log
 * raw error bodies, customer prompts, account identifiers, or API keys.
 */
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const API_QUOTA_EVENTS_FILE = 'api-quota-alerts.jsonl';
const PROVIDER = new Set(['openai', 'anthropic']);
const FLOW = new Set(['screening-digest', 'regulatory-watch']);
const CAUSES = new Set(['rate_or_quota', 'billing_or_auth']);
const MODEL = /^[A-Za-z0-9][A-Za-z0-9._-]{1,79}$/;
const FIELDS = ['schema','observed_at','provider','workflow','model','http_status','cause'];

export function classifyApiQuotaFailure(status, sanitizedReason = '') {
  const s = Number(status);
  const safe = String(sanitizedReason || '').slice(0, 90);
  if ([401,402,403].includes(s) || /billing|credit|authentication/i.test(safe))
    return 'billing_or_auth';
  if (s === 429 || /rate limit|quota/i.test(safe)) return 'rate_or_quota';
  return null;
}

export function validApiQuotaEvent(e) {
  return !!e && typeof e === 'object' && !Array.isArray(e) &&
    Object.keys(e).sort().join('|') === [...FIELDS].sort().join('|') &&
    e.schema === 1 && PROVIDER.has(e.provider) && FLOW.has(e.workflow) &&
    CAUSES.has(e.cause) && typeof e.model === 'string' && MODEL.test(e.model) &&
    Number.isSafeInteger(e.http_status) && e.http_status >= 0 && e.http_status <= 599 &&
    typeof e.observed_at === 'string' &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(e.observed_at) &&
    Number.isFinite(Date.parse(e.observed_at));
}

export function appendApiQuotaEvent(e) {
  if (!validApiQuotaEvent(e)) return { ok: false, reason: 'quota_event_invalid' };
  appendFileSync(API_QUOTA_EVENTS_FILE, JSON.stringify(e) + '\n', {
    mode: 0o600, flag: 'a', encoding: 'utf8',
  });
  return { ok: true };
}

export function parseApiQuotaEvents(raw) {
  if (typeof raw !== 'string' || raw.length > 64000) {
    return { ok: false, reason: 'quota_events_oversized' };
  }
  if (!raw.trim()) return { ok: true, events: [] };
  const lines = raw.trimEnd().split('\n');
  if (lines.length > 100 || lines.some(line => line.length > 1200)) {
    return { ok: false, reason: 'quota_events_oversized' };
  }
  try {
    const events = lines.map(line => JSON.parse(line));
    if (events.some(e => !validApiQuotaEvent(e))) throw new Error('bad-schema');
    return { ok: true, events };
  } catch { return { ok: false, reason: 'quota_events_invalid' }; }
}

export function renderQuotaSummary(events) {
  if (!Array.isArray(events) || events.some(e => !validApiQuotaEvent(e))) {
    return '# API quota alerts\n\nStatus UNKNOWN: telemetry invalid.\n';
  }
  const groups = new Map();
  for (const e of events) {
    const key = e.provider + '/' + e.workflow + '/' + e.cause;
    const g = groups.get(key) || { provider: e.provider, workflow: e.workflow, cause: e.cause, count: 0 };
    g.count++; groups.set(key, g);
  }
  const rows = [...groups.values()];
  return ['# API credit and quota alerts', '',
    'HTTP and sanitized stop categories only. These are NOT verified vendor credit balances.',
    '', 'Recorded stop events: ' + events.length + '.',
    '', '| Provider | Workflow | Category | Occurrences |',
    '| --- | --- | --- | ---: |',
    ...rows.map(g => '| ' + [g.provider,g.workflow,g.cause,g.count].join(' | ') + ' |'),
    '', 'If unavailable, inspect provider billing/rate limits and keep optional AI enrichment disabled. Continue deterministic screening and human review.', ''].join('\n');
}

// At most one GitHub issue per provider/flow/category; never create an issue
// on uncertain API state. If the issue list is paginated, fail closed.
export async function notifyApiQuotaIssues(events, {
  repository, token, fetchImpl = globalThis.fetch
} = {}) {
  if (!Array.isArray(events) || events.some(e => !validApiQuotaEvent(e)))
    return { ok: false, reason: 'quota_events_invalid' };
  if (!events.length) return { ok: true, created: 0, already_open: 0 };
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository || '') ||
      !token || typeof fetchImpl !== 'function') {
    return { ok: false, reason: 'github_issue_delivery_not_configured' };
  }
  const [owner, name] = repository.split('/');
  const url = 'https://api.github.com/repos/' + owner + '/' + name;
  const hdrs = { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json' };
  let existingResponse;
  try {
    existingResponse = await fetchImpl(url + '/issues?state=open&labels=api-quota&per_page=100', {
      headers: hdrs,
    });
  } catch { return { ok: false, reason: 'github_issue_index_unavailable' }; }
  if (!existingResponse.ok || String(existingResponse.headers?.get?.('link') || '').includes('rel="next"')) {
    return { ok: false, reason: 'github_issue_index_unavailable' };
  }
  let existing;
  try { existing = await existingResponse.json(); }
  catch { return { ok: false, reason: 'github_issue_index_unavailable' }; }
  if (!Array.isArray(existing)) return { ok: false, reason: 'github_issue_index_unavailable' };
  const titles = new Set(existing.filter(e => e && typeof e.title === 'string').map(e => e.title));
  const groups = [...new Set(events.map(e => e.provider + '/' + e.workflow + '/' + e.cause))];
  let created = 0, alreadyOpen = 0;
  for (const key of groups.slice(0, 5)) {
    const [provider, workflow, cause] = key.split('/');
    const title = 'API quota alert: ' + provider + ' / ' + workflow + ' / ' + cause;
    if (titles.has(title)) { alreadyOpen++; continue; }
    const body = [
      'Optional AI provider call was stopped in the GitHub workflow.',
      '',
      'Provider: ' + provider,
      'Workflow: ' + workflow,
      'Sanitized classification: ' + cause,
      '',
      'Check provider billing and rate-limit dashboards; this notice does not know the credit balance.',
      'Do not re-enable data egress or re-run paid calls without authorized review.',
    ].join('\n');
    let response;
    try {
      response = await fetchImpl(url + '/issues', { method: 'POST', headers: hdrs,
        body: JSON.stringify({ title, body, labels: ['api-quota'] }) });
    } catch { return { ok: false, reason: 'github_issue_creation_failed', created, already_open: alreadyOpen }; }
    if (!response.ok) return { ok: false, reason: 'github_issue_creation_failed', created, already_open: alreadyOpen };
    created++; titles.add(title);
  }
  return { ok: true, created, already_open: alreadyOpen };
}

async function main() {
  let parsed;
  try { parsed = parseApiQuotaEvents(existsSync(API_QUOTA_EVENTS_FILE)
    ? readFileSync(API_QUOTA_EVENTS_FILE, 'utf8') : ''); }
  catch { parsed = { ok: false }; }
  const report = renderQuotaSummary(parsed.ok ? parsed.events : null);
  console.log(report);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, report, 'utf8');
  if (!parsed.ok) { process.exitCode = 1; return; }
  if (process.env.API_QUOTA_ALERT_ISSUES === '1' && parsed.events.length) {
    const result = await notifyApiQuotaIssues(parsed.events, {
      repository: process.env.GITHUB_REPOSITORY, token: process.env.GITHUB_TOKEN,
    });
    console.log('api-quota: issue delivery ' + (result.ok ? 'completed' : 'unverified')
      + '; created=' + (result.created || 0));
    if (!result.ok) process.exitCode = 1;
  }
}
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) await main();
