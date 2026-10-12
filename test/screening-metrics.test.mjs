/* Unit tests for screening-metrics pure logic (offline).
   Usage: node test/screening-metrics.test.mjs */
import { computeMetrics, buildReport } from '../scripts/screening-metrics.mjs';
import { buildApiCostDashboard, renderApiCostDashboard } from '../scripts/api-cost-dashboard.mjs';

let passed = 0, failed = 0;
function check(name, cond) {
  if (cond) { passed++; console.log('  ok  ' + name); }
  else { failed++; console.log('FAIL  ' + name); }
}

console.log('\n— screening-metrics unit tests —\n');

const state = {
  updated: '2026-06-25',
  subjects: {
    a: { name: 'UYA ENERJİ ÜRETİM', band: 'high', topScore: 94, recommendation: 'sanctions-match', lists: ['OFAC SDN', 'UN'] },
    b: { name: 'Plain Co Ltd',      band: 'clear', topScore: 41, recommendation: 'clear',          lists: [] },
    c: { name: 'ŞIRKET A.Ş.',       band: 'medium', topScore: 82, recommendation: 'review',        lists: ['EU FSF'] },
  },
};

const m = computeMetrics(state);
check('counts all subjects', m.total === 3);
check('matches = high band + any list hit (a and c)', m.matches === 2);
check('multi-list hit counted (a has 2 lists)', m.multiList === 1);
check('diacritic folding detected on non-ASCII names (a and c)', m.diacriticFolded === 2);
check('score bucket 90-100 has one', m.scoreBuckets['90-100'] === 1);
check('score bucket 80-89 has one', m.scoreBuckets['80-89'] === 1);
check('score bucket <70 has one', m.scoreBuckets['<70'] === 1);
check('band distribution counts high', m.byBand.high === 1);
check('recommendation distribution counts clear', m.byRecommendation.clear === 1);

// empty / malformed input must not throw
const empty = computeMetrics({});
check('empty state yields zero total', empty.total === 0);
check('buildReport renders without throwing', /Screening Metrics/.test(buildReport(m)));
check('report notes the licensed-feed scope caveat', /World-Check/.test(buildReport(m)));


// Synthetic mathematical rates, not current market prices.
const costPrices = { schema: 1, models: [{
  provider: 'openai', model: 'fixture-model', verified_on: '2026-10-10',
  source_url: 'https://platform.openai.com/docs/pricing',
  usd_per_million: { input: '2', cached_input: '1', output: '8' }
}] };
const costEvt = { receipt_hash: 'a'.repeat(64), recorded_at: '2026-10-12T07:20:00Z',
  provider: 'openai', model: 'fixture-model', workflow: 'daily-screen',
  usage: { input_tokens: 1000, cached_input_tokens: 200, output_tokens: 100 } };
const costOpts = { nowMs: Date.parse('2026-10-12T12:00:00Z') };
const dashboard = buildApiCostDashboard({ schema: 1, records: [costEvt, costEvt] }, costPrices, costOpts);
check('cost dashboard deduplicates repeated receipts and retains micro-USD precision',
  dashboard.status === 'priced_estimate' && dashboard.priced === 1 &&
  dashboard.duplicate === 1 && dashboard.estimated_usd_of_priced_usage === '0.002600');
check('dashboard reports only bounded provider, workflow and UTC day aggregates',
  dashboard.by_workflow[0].name === 'daily-screen' &&
  dashboard.by_provider[0].estimated_usd === '0.002600' &&
  dashboard.by_utc_day[0].name === '2026-10-12' &&
  renderApiCostDashboard(dashboard).includes('Estimate only, not a provider invoice'));
const costEvt2 = { ...costEvt, receipt_hash: 'b'.repeat(64), workflow: 'reg-watch',
  usage: { ...costEvt.usage, output_tokens: 200 } };
const twice = buildApiCostDashboard({ schema: 1, records: [costEvt, costEvt2] }, costPrices, costOpts);
check('dashboard aggregates distinct workflows without rounding intermediate totals',
  twice.priced === 2 && twice.estimated_usd_of_priced_usage === '0.006000');
check('unknown pricing and unknown model cannot be presented as a complete $0 invoice',
  buildApiCostDashboard({ schema: 1, records: [costEvt] }, null, costOpts).status === 'incomplete' &&
  buildApiCostDashboard({ schema: 1, records: [costEvt, { ...costEvt,
    receipt_hash: 'c'.repeat(64), model: 'unknown' }] }, costPrices, costOpts).unpriced === 1);
check('conflicting receipt hashes make the report incomplete',
  buildApiCostDashboard({ schema: 1, records: [costEvt,
    { ...costEvt, usage: { ...costEvt.usage, output_tokens: 0 } }] },
    costPrices, costOpts).status === 'incomplete');
check('free-text and confidential fields are never accepted into the ledger',
  buildApiCostDashboard({ schema: 1, records: [{ ...costEvt, prompt: 'PRIVATE' }] },
    costPrices, costOpts).rejected === 1 &&
  buildApiCostDashboard({ schema: 1, records: [{ ...costEvt, workflow: 'bad\nline' }] },
    costPrices, costOpts).rejected === 1);
check('missing and empty ledgers are explicitly incomplete',
  buildApiCostDashboard({ schema: 1, records: [] }, costPrices, costOpts).status === 'incomplete' &&
  buildApiCostDashboard({}, costPrices, costOpts).status === 'incomplete');

console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
if (failed) process.exitCode = 1;
