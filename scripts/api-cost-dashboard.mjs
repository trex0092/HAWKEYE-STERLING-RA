/* Non-identifying API cost dashboard, generated from local approved telemetry.
 *
 * This dashboard reports VERIFIED-PRICE ESTIMATES, not provider invoices,
 * vendor credit balances, nor an account-wide global spending ledger.
 * All events are strictly metadata-only. Customer names, prompts, response
 * bodies, tokens, secrets and account identifiers are forbidden.
 */
import { appendFileSync, readFileSync, existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { parseUsdMicro } from './api-cost-budget.mjs';

export const API_COST_EVENTS_FILE = 'api-cost-events.jsonl';
const VALID_MODEL = /^[A-Za-z0-9][A-Za-z0-9._-]{1,79}$/;
const FIELDS = ['schema', 'observed_at', 'provider', 'model', 'workflow',
  'requests', 'status', 'estimated_usd', 'input_tokens', 'output_tokens'];
const PROVIDERS = new Set(['openai', 'anthropic']);
const FLOWS = new Set(['screening-digest', 'regulatory-watch']);
const STATUSES = new Set(['priced', 'unknown_reserved', 'blocked']);

export function validateApiCostEvent(event) {
  if (!event || typeof event !== 'object' || Array.isArray(event) ||
      Object.keys(event).sort().join('|') !== [...FIELDS].sort().join('|')) return false;
  if (event.schema !== 1 || !PROVIDERS.has(event.provider) ||
      !FLOWS.has(event.workflow) || !STATUSES.has(event.status) ||
      typeof event.model !== 'string' || !VALID_MODEL.test(event.model) ||
      typeof event.observed_at !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(event.observed_at) ||
      !Number.isFinite(Date.parse(event.observed_at)) ||
      !Number.isSafeInteger(event.requests) || event.requests < 0 ||
      event.requests > 1000 ||
      !Number.isSafeInteger(event.input_tokens) || event.input_tokens < 0 ||
      !Number.isSafeInteger(event.output_tokens) || event.output_tokens < 0) return false;
  const priced = event.status !== 'blocked';
  return priced
    ? parseUsdMicro(event.estimated_usd) !== null && event.requests > 0
    : event.estimated_usd === null;
}

export function appendApiCostEvent(event) {
  if (!validateApiCostEvent(event)) {
    return { ok: false, reason: 'invalid_nonidentifying_cost_event' };
  }
  // Fixed path, owner-only permissions, validated exact schema. Never accept
  // a client-provided path or freeform metadata as a log field.
  appendFileSync(API_COST_EVENTS_FILE, JSON.stringify(event) + '\n', {
    encoding: 'utf8', mode: 0o600, flag: 'a',
  });
  return { ok: true };
}

export function parseApiCostEvents(text) {
  if (typeof text !== 'string' || text.length > 256000)
    return { ok: false, reason: 'cost_telemetry_missing_or_oversized' };
  if (!text.trim()) return { ok: true, events: [] };
  const lines = text.trimEnd().split('\n');
  if (lines.length > 2000 || lines.some(line => line.length > 2000)) {
    return { ok: false, reason: 'cost_telemetry_missing_or_oversized' };
  }
  const events = [];
  try {
    for (const line of lines) {
      const event = JSON.parse(line);
      if (!validateApiCostEvent(event)) {
        return { ok: false, reason: 'cost_event_schema_invalid' };
      }
      events.push(event);
    }
    return { ok: true, events };
  } catch {
    return { ok: false, reason: 'cost_event_schema_invalid' };
  }
}

function usd(micro) {
  return (micro / 1000000n).toString() + '.' +
    (micro % 1000000n).toString().padStart(6, '0');
}

export function summarizeApiCostEvents(events) {
  if (!Array.isArray(events) || events.some(e => !validateApiCostEvent(e))) {
    return { ok: false, reason: 'invalid_cost_telemetry' };
  }
  const groups = new Map();
  for (const e of events) {
    const key = e.provider + '|' + e.model + '|' + e.workflow;
    let row = groups.get(key);
    if (!row) {
      row = { provider: e.provider, model: e.model, workflow: e.workflow,
        requests: 0, observed_events: 0, priced: 0n, unknown: 0n, blocked: 0 };
      groups.set(key, row);
    }
    row.requests += e.requests;
    row.observed_events++;
    if (e.status === 'priced') row.priced += parseUsdMicro(e.estimated_usd);
    else if (e.status === 'unknown_reserved') row.unknown += parseUsdMicro(e.estimated_usd);
    else row.blocked++;
  }
  const rows = [...groups.values()].sort((a,b) =>
    (a.provider+a.model+a.workflow).localeCompare(b.provider+b.model+b.workflow))
    .map(row => ({
      provider: row.provider, model: row.model, workflow: row.workflow,
      requests: row.requests, observed_events: row.observed_events,
      priced_estimate_usd: usd(row.priced),
      unknown_usage_reserved_usd: usd(row.unknown),
      blocked_events: row.blocked,
    }));
  return { ok: true, rows, observed_events: events.length,
    requests: rows.reduce((n, x) => n + x.requests, 0),
    // Totals kept separate because unknown-usage reservations are NOT invoices.
    priced_estimate_usd: usd([...groups.values()].reduce((n,x)=>n+x.priced,0n)),
    unknown_usage_reserved_usd: usd([...groups.values()].reduce((n,x)=>n+x.unknown,0n)),
    blocked_events: rows.reduce((n,x)=>n+x.blocked_events,0) };
}

export function renderApiCostDashboard(summary) {
  if (!summary || summary.ok !== true) {
    return '# API cost dashboard\n\nTelemetry invalid or unavailable; costs are UNKNOWN, not zero.\n';
  }
  const intro = ['# API Cost Dashboard', '',
    'Estimated USD from operator-verified model rates. These are not provider invoices or current account balances.',
    '',
    'Observed events: ' + summary.observed_events +
      ', paid requests: ' + summary.requests +
      ', blocked events: ' + summary.blocked_events + '.',
    'Priced usage estimate: $' + summary.priced_estimate_usd +
      '. Unknown-usage reservations: $' + summary.unknown_usage_reserved_usd + '.',
    '', '| Provider | Model | Workflow | Paid calls | Priced estimate (USD) | Unknown usage reserved (USD) | Blocked |',
    '| --- | --- | --- | ---: | ---: | ---: | ---: |'];
  for (const row of summary.rows) {
    intro.push('| ' + [row.provider, row.model, row.workflow,
      row.requests, row.priced_estimate_usd,
      row.unknown_usage_reserved_usd, row.blocked_events].join(' | ') + ' |');
  }
  intro.push('', 'Missing telemetry is not evidence of zero spending. Compare with provider invoices and independently maintained spending limits.', '');
  return intro.join('\n');
}

function main() {
  let summary;
  try {
    const parsed = parseApiCostEvents(existsSync(API_COST_EVENTS_FILE)
      ? readFileSync(API_COST_EVENTS_FILE, 'utf8') : '');
    summary = parsed.ok ? summarizeApiCostEvents(parsed.events) : parsed;
  } catch {
    summary = { ok: false };
  }
  const markdown = renderApiCostDashboard(summary);
  console.log(markdown);
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown, 'utf8');
  }
  if (!summary.ok) process.exitCode = 1;
}
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) main();
