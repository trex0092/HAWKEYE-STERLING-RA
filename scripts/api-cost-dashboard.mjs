/* Privacy-minimizing offline API cost dashboard. Supplied data is not an invoice. */
import { readFileSync, appendFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { parseApiPriceTable, quoteApiTokenCost } from './api-cost.mjs';

const HASH = /^[a-f0-9]{64}$/;
const LABEL = /^[A-Za-z0-9._-]{1,64}$/;
const MODEL = /^[A-Za-z0-9][A-Za-z0-9._-]{1,79}$/;
const FIELDS = ['receipt_hash', 'recorded_at', 'provider', 'model', 'workflow', 'usage'];
const MICRO = 1000000n;
function validEvent(e) {
  if (!e || typeof e !== 'object' || Array.isArray(e) ||
      Object.keys(e).sort().join('|') !== [...FIELDS].sort().join('|') ||
      typeof e.receipt_hash !== 'string' || !HASH.test(e.receipt_hash) ||
      typeof e.workflow !== 'string' || !LABEL.test(e.workflow) ||
      typeof e.model !== 'string' || !MODEL.test(e.model) ||
      !['openai', 'anthropic'].includes(e.provider) ||
      typeof e.recorded_at !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}T\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(e.recorded_at) ||
      !Number.isFinite(Date.parse(e.recorded_at)) ||
      new Date(e.recorded_at).toISOString().slice(0, 10) !== e.recorded_at.slice(0, 10) ||
      !e.usage || typeof e.usage !== 'object' || Array.isArray(e.usage)) return false;
  const keys = e.provider === 'openai' ?
    ['input_tokens', 'output_tokens', 'cached_input_tokens'] :
    ['input_tokens', 'output_tokens', 'cache_read_input_tokens', 'cache_creation_input_tokens'];
  return Object.keys(e.usage).sort().join('|') === [...keys].sort().join('|') &&
    keys.every(key => Number.isSafeInteger(e.usage[key]) && e.usage[key] >= 0);
}
/* Only an allowlisted metadata schema can reach the journal; no names,
 * prompts, source excerpts, credentials or response bodies are accepted.
 * The receipt is random: it is not a customer or GitHub identifier. */
export function prepareApiCostUsageEvent({
  provider, model, workflow, usage,
  recordedAt = new Date().toISOString(), receiptHash = randomBytes(32).toString('hex')
} = {}) {
  const event = { receipt_hash: receiptHash, recorded_at: recordedAt,
    provider, model, workflow, usage };
  return validEvent(event) ? event : null;
}

export function appendApiCostUsage(payload) {
  const event = prepareApiCostUsageEvent(payload);
  if (!event) return { ok: false, reason: 'invalid_sanitized_usage' };
  try {
    appendFileSync('api-cost-ledger.jsonl', JSON.stringify(event) + '\n', {
      mode: 0o600, flag: 'a', encoding: 'utf8'
    });
    return { ok: true };
  } catch {
    return { ok: false, reason: 'usage_journal_unavailable' };
  }
}

export function parseApiCostUsageLedger(raw) {
  if (typeof raw !== 'string' || raw.length > 2_000_000 || !raw.trim()) return null;
  try {
    const input = JSON.parse(raw);
    if (input?.schema === 1 && Array.isArray(input.records) &&
        input.records.length <= 5000) return input;
  } catch {
    // A bounded JSONL journal is the normal producer format.
  }
  const lines = raw.trimEnd().split('\n');
  if (!lines.length || lines.length > 5000 || lines.some(line => line.length > 3000)) return null;
  try {
    const records = lines.map(line => JSON.parse(line));
    return records.every(validEvent) ? { schema: 1, records } : null;
  } catch { return null; }
}

function usd(m) {
  return (m / MICRO).toString() + '.' + (m % MICRO).toString().padStart(6, '0');
}
export function buildApiCostDashboard(ledger, priceTable, options = {}) {
  if (!ledger || typeof ledger !== 'object' || Array.isArray(ledger) ||
      ledger.schema !== 1 || !Array.isArray(ledger.records) ||
      ledger.records.length > 5000) {
    return { status: 'incomplete', reason: 'missing_or_invalid_usage_ledger' };
  }
  const seen = new Map(), providers = new Map(), workflows = new Map(), days = new Map();
  let rejected = 0, unpriced = 0, duplicate = 0, collisions = 0, priced = 0;
  let total = 0n;
  for (const e of ledger.records) {
    if (!validEvent(e)) { rejected++; continue; }
    const canonical = JSON.stringify(e);
    if (seen.has(e.receipt_hash)) {
      if (seen.get(e.receipt_hash) !== canonical) collisions++;
      else duplicate++;
      continue;
    }
    seen.set(e.receipt_hash, canonical);
    const quote = quoteApiTokenCost(priceTable, e, options);
    if (quote.status !== 'priced') { unpriced++; continue; }
    const micro = BigInt(quote.micro_usd);
    total += micro;
    priced++;
    for (const [map, key] of [
      [providers, e.provider], [workflows, e.workflow], [days, e.recorded_at.slice(0, 10)]
    ]) map.set(key, (map.get(key) || 0n) + micro);
  }
  const complete = rejected === 0 && unpriced === 0 && collisions === 0 &&
    ledger.records.length > 0;
  const rows = map => [...map].sort((a, b) => a[0].localeCompare(b[0]))
    .map(([name, amount]) => ({ name, estimated_usd: usd(amount) }));
  return {
    status: complete ? 'priced_estimate' : 'incomplete',
    currency: 'USD', estimated_usd_of_priced_usage: usd(total),
    priced, unpriced, rejected, duplicate, collisions,
    total_input_records: ledger.records.length,
    by_provider: rows(providers), by_workflow: rows(workflows), by_utc_day: rows(days),
    note: 'Usage-based estimate only, not invoiced charges. Unpriced or invalid events make this incomplete.'
  };
}
export function renderApiCostDashboard(result) {
  if (!result || !['priced_estimate', 'incomplete'].includes(result.status)) {
    return '# API cost dashboard\n\nUnavailable: no verified usage summary.\n';
  }
  const output = ['# API cost dashboard', '', '**Estimate only, not a provider invoice.**', '',
    'Coverage: **' + (result.status === 'priced_estimate' ? 'Complete for supplied records' : 'INCOMPLETE') + '**',
    '', 'Estimated total from priced events: **$' + result.estimated_usd_of_priced_usage + ' USD**',
    '', 'Events: priced ' + result.priced + ', unpriced ' + result.unpriced +
       ', invalid ' + result.rejected + ', duplicates ' + result.duplicate +
       ', collisions ' + result.collisions + '.', '',
    '## By provider', '', '| Provider | Estimated USD |', '| --- | ---: |'];
  for (const row of result.by_provider || []) output.push('| ' + row.name + ' | $' + row.estimated_usd + ' |');
  output.push('', '## By workflow', '', '| Workflow | Estimated USD |', '| --- | ---: |');
  for (const row of result.by_workflow || []) output.push('| ' + row.name + ' | $' + row.estimated_usd + ' |');
  output.push('', '## By UTC day', '', '| Day | Estimated USD |', '| --- | ---: |');
  for (const row of result.by_utc_day || []) output.push('| ' + row.name + ' | $' + row.estimated_usd + ' |');
  output.push('', 'No prompts, customer identifiers, API keys or response bodies are displayed.');
  return output.join('\n') + '\n';
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  if (args.length !== 4 || args[0] !== '--ledger' || args[2] !== '--prices') {
    console.error('Usage: node scripts/api-cost-dashboard.mjs --ledger <sanitized.json> --prices <verified-prices.json>');
    process.exitCode = 2;
  } else {
    try {
      const raw = readFileSync(args[1], 'utf8');
      if (raw.length > 2_000_000) throw new Error('usage file too large');
      const prices = parseApiPriceTable(readFileSync(args[3], 'utf8'));
      const result = buildApiCostDashboard(parseApiCostUsageLedger(raw),
        prices.ok ? prices.table : null);
      const output = renderApiCostDashboard(result);
      console.log(output);
      if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, output);
      if (result.status !== 'priced_estimate') process.exitCode = 1;
    } catch {
      console.error('API dashboard unavailable: invalid or missing sanitized evidence');
      process.exitCode = 1;
    }
  }
}
