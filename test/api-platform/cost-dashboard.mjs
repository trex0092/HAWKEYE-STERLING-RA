import { buildApiCostDashboard, renderApiCostDashboard, parseApiCostUsageLedger,
  prepareApiCostUsageEvent } from '../../scripts/api-cost-dashboard.mjs';

export async function run(check) {
  const prices = { schema: 1, models: [{ provider: 'openai', model: 'fixture-model',
    verified_on: '2026-10-12', source_url: 'https://openai.com/api/pricing/',
    usd_per_million: { input: '2', cached_input: '1', output: '8' } }] };
  const nowMs = Date.parse('2026-10-12T12:00:00Z');
  const event = prepareApiCostUsageEvent({ provider: 'openai', model: 'fixture-model',
    workflow: 'screening-digest', recordedAt: '2026-10-12T07:00:00Z', receiptHash: 'a'.repeat(64),
    usage: { input_tokens: 1000, cached_input_tokens: 200, output_tokens: 100 } });
  const summarize = records => buildApiCostDashboard({ schema: 1, records }, prices, { nowMs });
  const reordered = Object.fromEntries(Object.entries(event).reverse());
  reordered.usage = Object.fromEntries(Object.entries(event.usage).reverse());
  reordered.recorded_at = '2026-10-12T07:00:00.000Z';
  const same = summarize([event, reordered]);
  check('cost dashboard: equivalent JSON property order and timestamp precision deduplicate',
    same.status === 'priced_estimate' && same.duplicate === 1 && same.collisions === 0 &&
    same.estimated_usd_of_priced_usage === '0.002600');
  const conflict = { ...event, usage: { ...event.usage, output_tokens: 900 } };
  const good = { ...event, receipt_hash: 'b'.repeat(64) };
  const forward = summarize([event, conflict, good]);
  const reverse = summarize([conflict, event, good]);
  check('cost dashboard: all conflicting receipt copies are excluded irrespective of input order',
    forward.status === 'incomplete' && forward.collisions === 1 && forward.priced === 1 &&
    forward.estimated_usd_of_priced_usage === '0.002600' &&
    reverse.estimated_usd_of_priced_usage === forward.estimated_usd_of_priced_usage);
  check('cost dashboard: future-dated usage is rejected, not added to current spend',
    summarize([{ ...event, recorded_at: '2026-12-12T07:00:00Z' }]).rejected === 1);
  check('cost dashboard: missing evidence renders UNKNOWN, not undefined USD or a false zero',
    renderApiCostDashboard(buildApiCostDashboard(null, prices)).includes('UNKNOWN') &&
    !renderApiCostDashboard(buildApiCostDashboard(null, prices)).includes('undefined'));
  check('cost dashboard: arbitrary Markdown data cannot be injected into rendered reports',
    renderApiCostDashboard({ ...same, by_workflow: [{ name: 'bad|SECRET\n', estimated_usd: '0.002600' }] })
      .includes('UNKNOWN') &&
    !renderApiCostDashboard({ ...same, by_workflow: [{ name: 'bad|SECRET\n', estimated_usd: '0.002600' }] })
      .includes('SECRET'));
  check('cost dashboard: the journal producer/parser contract survives the dedup enhancement',
    summarize(parseApiCostUsageLedger(JSON.stringify(event) + '\n').records).priced === 1);
}
