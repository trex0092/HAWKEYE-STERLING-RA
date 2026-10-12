import { classifyApiQuotaFailure, validApiQuotaEvent, parseApiQuotaEvents,
  renderQuotaSummary, notifyApiQuotaIssues } from '../scripts/api-quota-alerts.mjs';
import { validateApiCostEvent, parseApiCostEvents, summarizeApiCostEvents,
  renderApiCostDashboard } from '../scripts/api-cost-dashboard.mjs';
import { makeApiUsdBudget, parseUsdMicro } from '../scripts/api-cost-budget.mjs';
import {
  validateApiPriceTable, parseApiPriceTable, quoteApiTokenCost
} from '../scripts/api-cost.mjs';

/* No-network checks for Regulatory Watch AI budget, source/filename safety,
 * provider quota classification and usage telemetry. */
import {
  boundedInt, draftBudget, validatedReportDate, boundedLines, boundedItems,
  evidenceCount, missingExcerptNotice, deferredDraftCause,
  manualDraftSection, approvedWatchSource, approvedWatchSourceDetails,
  providerStopReason, usageCounts
} from '../scripts/reg-draft-budget.mjs';

let passed = 0, failed = 0;
function check(name, ok) {
  if (ok) { passed++; console.log('  ok  ' + name); }
  else { failed++; console.error('FAIL ' + name); }
}

const defaults = draftBudget({});
check('conservative model-call budget is active by default',
  defaults.maxCalls === 8 && defaults.maxTokens === 1000 && defaults.timeoutMs === 20000);
check('max token and call settings are capped against runaway cost',
  draftBudget({ REG_DRAFT_MAX_API_CALLS: '999999', REG_DRAFT_MAX_OUTPUT_TOKENS: '99999' })
    .maxCalls === 30 &&
  draftBudget({ REG_DRAFT_MAX_API_CALLS: '999999', REG_DRAFT_MAX_OUTPUT_TOKENS: '99999' })
    .maxTokens === 1000);
check('invalid budget settings use safe defaults',
  draftBudget({ REG_DRAFT_MAX_API_CALLS: 'wat', REG_DRAFT_API_TIMEOUT_MS: 'Infinity' })
    .maxCalls === 8 &&
  draftBudget({ REG_DRAFT_MAX_API_CALLS: 'wat', REG_DRAFT_API_TIMEOUT_MS: 'Infinity' })
    .timeoutMs === 20000);
check('minimum bounded budget prevents invalid zero-length request',
  boundedInt('0', 8, 1, 30) === 1 &&
  draftBudget({ REG_DRAFT_MAX_OUTPUT_TOKENS: '0' }).maxTokens === 256);
check('regulatory report date rejects path traversal and malformed dates',
  validatedReportDate('../config') === null &&
  validatedReportDate('2026-02-30') === null &&
  validatedReportDate('2026-10-09/foo') === null &&
  validatedReportDate('2026-10-09') === '2026-10-09' &&
  validatedReportDate('2024-02-29') === '2024-02-29');

const lines = boundedLines(['one', 'two', 'three', 'four'], 'ADDED: ', 2, 80);
check('delta evidence caps count and marks omissions explicitly',
  lines.length === 3 && lines[0] === 'ADDED: one' &&
  lines[2].includes('2 additional evidence item(s)'));
check('untrusted fields cannot inject control characters or oversized evidence',
  boundedLines(['SECRET\nINSTRUCTION' + 'x'.repeat(400)], 'ADDED: ', 10, 80)[0]
    .length <= 87 &&
  !boundedLines(['SECRET\nINSTRUCTION'], 'ADDED: ', 10, 80)[0].includes('\n'));
const items = boundedItems([
  {t:'Circular A',h:'https://example.org/a'}, {t:'Circular B',h:'https://example.org/b'}
], 'NEW ITEM: ', 1, 80);
check('publication lists are bounded and label missing data',
  items.length === 2 && items[0].includes('Circular A') &&
  items[1].includes('1 additional publication item(s)'));
check('null / malformed arrays cannot crash source extractors',
  boundedLines(null, 'ADDED: ', 10, 250).length === 0 &&
  boundedItems(null, 'NEW ITEM: ', 10, 250).length === 0);

check('short excerpts preserve the watcher\'s true changed-segment total',
  evidenceCount(79, ['example 1', 'example 2']) === 79 &&
  missingExcerptNotice(79, ['example 1', 'example 2'], 'added segments')
    [0].includes('77 additional added segments'));
check('missing or malformed counts fall back to observed excerpts',
  evidenceCount('999999999', ['one']) === 1 &&
  evidenceCount(-5, ['one']) === 1 &&
  evidenceCount(1_000_001, ['one']) === 1 &&
  evidenceCount(undefined, []) === 0 &&
  missingExcerptNotice(2, ['one', 'two'], 'segments').length === 0);
check('provider 429 and credit exhaustion are not relabelled as local budget limits',
  deferredDraftCause('provider rate limit', 3, 8) === 'provider rate limit' &&
  deferredDraftCause('provider billing or authentication failure', 3, 8) ===
    'provider billing or authentication failure' &&
  deferredDraftCause('provider timeout or network failure', 3, 8) ===
    'provider timeout or network failure');
check('local budget limit is reported ONLY when actually reached',
  deferredDraftCause(null, 7, 8) === null &&
  deferredDraftCause(null, 8, 8) === 'API request budget exhausted' &&
  deferredDraftCause('provider rate limit', 8, 8) === 'provider rate limit');

const source = {name:'Safe\nExample',url:'https://regulator.example/document'};
const approved = [{ id: 'uae-reg', name: 'Authority',
  jurisdiction: 'UAE', url: 'https://regulator.example/document' }];
check('Regulatory Watch only fetches approved source IDs and exact URLs',
  approvedWatchSource({ id: 'uae-reg', url: 'https://regulator.example/document' }, approved) &&
  !approvedWatchSource({ id: 'unknown', url: 'https://regulator.example/document' }, approved) &&
  !approvedWatchSource({ id: 'uae-reg', url: 'https://127.0.0.1/private' }, approved) &&
  !approvedWatchSource({ id: 'uae-reg', url: 'http://regulator.example/document' }, approved));
// Reports and documents are UNTRUSTED input; even a matching ID/URL cannot
// smuggle a forged jurisdiction or a 2 MB metadata label into a paid prompt.
const forgedSource = {id:'uae-reg', url:'https://regulator.example/document',
  name:'FORGED\nMODEL PROMPT ' + 'X'.repeat(100000), jurisdiction:'Unreviewed'};
const canonical = approvedWatchSourceDetails(forgedSource, approved);
check('approved registry, not incoming report, owns model-facing metadata',
  canonical && canonical.id === 'uae-reg' && canonical.name === 'Authority' &&
  canonical.jurisdiction === 'UAE' && canonical.url === approved[0].url &&
  !canonical.name.includes('FORGED'));
check('unregistered source yields no trusted metadata',
  approvedWatchSourceDetails({ ...forgedSource, url: 'https://evil.example/' }, approved) === null &&
  approvedWatchSourceDetails({ ...forgedSource, id: '__other' }, approved) === null);
const cleaned = approvedWatchSourceDetails(forgedSource, [
  {...approved[0], name: 'Authority\nA' + 'Z'.repeat(400), jurisdiction: 'UAE\nTest'}
]);
check('approved metadata remains bounded and strips newline/control injection',
  cleaned && cleaned.name.length <= 120 && !cleaned.name.includes('\n') &&
  cleaned.jurisdiction === 'UAE Test');
// Build the hostile URI from parts: ESLint no-script-url forbids static
// script URLs even in inert test data, but the unsafe-scheme case matters.
const hostileLink = 'java' + 'script:alert(1)';
check('unapproved source URL and name cannot become rendered action links',
  !manualDraftSection({ name: 'MALICIOUS_SOURCE', url: hostileLink },
      'source not approved').includes('MALICIOUS_SOURCE') &&
  !manualDraftSection({ name: 'MALICIOUS_SOURCE', url: hostileLink },
      'source not approved').includes(hostileLink));

check('unregistered source is marked for review without a provider call',
  manualDraftSection(source, 'source not approved').includes('source not approved'));

check('manual fallback preserves source link, does not invent a severity',
  manualDraftSection(source,'API request budget exhausted').includes('regulator.example') &&
  !manualDraftSection(source,'API request budget exhausted').includes('SEVERITY:') &&
  !manualDraftSection(source,'API request budget exhausted').includes('\nExample'));
check('arbitrary provider message cannot be inserted into report',
  !manualDraftSection(source,'INJECTED_KEY_secret').includes('INJECTED_KEY_secret'));

check('provider 429 is rate limited and stops further billable calls',
  providerStopReason(429,'rate_limit_error') === 'provider rate limit');
check('provider 400 with credit exhaustion is billing, not malformed prompt',
  providerStopReason(400,'Your credit balance is too low') ===
    'provider billing or authentication failure');
check('invalid/revoked API key is distinguished from a transient provider failure',
  providerStopReason(401,'') === 'provider billing or authentication failure' &&
  providerStopReason(403,'') === 'provider billing or authentication failure' &&
  providerStopReason(503,'') === 'provider error');

const u = usageCounts({input_tokens: 340, output_tokens: 90,
  cache_read_input_tokens: 2000, cache_creation_input_tokens: 85});
check('provider usage telemetry counts all billing categories with no content',
  u.input === 340 && u.output === 90 && u.cacheRead === 2000 && u.cacheWrite === 85 &&
  Object.keys(u).length === 4);
check('malformed and negative provider usage never inflate totals',
  Object.values(usageCounts({input_tokens: -2, output_tokens: '500',
    cache_creation_input_tokens: Infinity})).every(n => n === 0));


/* Synthetic prices below are mathematical fixtures, NOT market prices. No
 * production price is bundled: operator evidence is required on every call. */
const prices = { schema: 1, models: [
  { provider: 'openai', model: 'fixture-openai', verified_on: '2026-10-10',
    source_url: 'https://platform.openai.com/docs/pricing',
    usd_per_million: { input: '2.00', cached_input: '0.50', output: '8.00' } },
  { provider: 'anthropic', model: 'fixture-anthropic', verified_on: '2026-10-10',
    source_url: 'https://docs.anthropic.com/en/docs/about-claude/pricing',
    usd_per_million: { input: '1.00', cached_read: '0.10', cached_write: '1.25', output: '5.00' } },
] };
const at = { nowMs: Date.parse('2026-10-12T12:00:00Z') };
check('explicit dated publisher evidence validates; no prices are hard-coded',
  validateApiPriceTable(prices, at).ok &&
  parseApiPriceTable(JSON.stringify(prices), at).ok);
const openaiQuote = quoteApiTokenCost(prices, {
  provider: 'openai', model: 'fixture-openai',
  usage: { input_tokens: 1000, cached_input_tokens: 200, output_tokens: 100 },
}, at);
check('exact openai token arithmetic excludes cached tokens from normal input',
  openaiQuote.status === 'priced' && openaiQuote.micro_usd === '2500' &&
  openaiQuote.usd === '0.002500' && openaiQuote.token_counts.input === 800);
const anthropicQuote = quoteApiTokenCost(prices, {
  provider: 'anthropic', model: 'fixture-anthropic',
  usage: { input_tokens: 500, cache_read_input_tokens: 200,
    cache_creation_input_tokens: 100, output_tokens: 100 },
}, at);
check('anthropic cached-read/write and output are individually billed once',
  anthropicQuote.status === 'priced' && anthropicQuote.micro_usd === '1145');
check('fractional micro-USD costs conservatively round UP',
  quoteApiTokenCost(prices, { provider: 'openai', model: 'fixture-openai',
    usage: { input_tokens: 1, output_tokens: 0 } }, at).micro_usd === '2');
check('unpriced and unknown model never silently imply zero cost',
  quoteApiTokenCost(null, { provider: 'openai', model: 'fixture-openai',
    usage: { input_tokens: 100, output_tokens: 20 } }, at).status === 'unpriced' &&
  quoteApiTokenCost(prices, { provider: 'openai', model: 'new-unapproved-model',
    usage: { input_tokens: 100, output_tokens: 20 } }, at).reason === 'model_has_no_verified_price');
check('reject double-counted or malformed cached token usage',
  quoteApiTokenCost(prices, { provider: 'openai', model: 'fixture-openai',
    usage: { input_tokens: 2, cached_input_tokens: 3, output_tokens: 1 } }, at).status === 'unpriced' &&
  quoteApiTokenCost(prices, { provider: 'openai', model: 'fixture-openai',
    usage: { input_tokens: '2', output_tokens: 1 } }, at).status === 'unpriced');
check('reject invented, stale future, duplicated and ambiguous price evidence',
  !validateApiPriceTable({ ...prices, models: [prices.models[0], prices.models[0]] }, at).ok &&
  !validateApiPriceTable({ ...prices, models: [{ ...prices.models[0], verified_on: '2026-10-30' }] }, at).ok &&
  !validateApiPriceTable({ ...prices, models: [{ ...prices.models[0],
    source_url: 'https://openai.com.attacker.test/pricing' }] }, at).ok &&
  !validateApiPriceTable({ ...prices, models: [{ ...prices.models[0],
    usd_per_million: { ...prices.models[0].usd_per_million, output: '-0.1' } }] }, at).ok);
check('invalid pricing JSON does not reveal raw input or become zero cost',
  !parseApiPriceTable('{secret', at).ok &&
  !parseApiPriceTable(JSON.stringify({ schema: 1, models: [] }), at).ok);


/* Synthetic rates only. USD preflight never assumes absent account pricing. */
const guardRates = { schema: 1, models: [
  { provider: 'openai', model: 'fixture-openai', verified_on: '2026-10-10',
    source_url: 'https://platform.openai.com/docs/pricing',
    usd_per_million: { input: '2.00', cached_input: '0.50', output: '8.00' } },
  { provider: 'anthropic', model: 'fixture-anthropic', verified_on: '2026-10-10',
    source_url: 'https://docs.anthropic.com/en/docs/about-claude/pricing',
    usd_per_million: { input: '1.00', cached_read: '0.10', cached_write: '1.25', output: '5.00' } },
] };
const guardNow = Date.parse('2026-10-12T12:00:00Z');
const guardSetup = (limitUsd = '0.020000', provider = 'openai', model = 'fixture-openai', rates = JSON.stringify(guardRates)) =>
  makeApiUsdBudget({ provider, model, limitUsd, priceTableJson: rates, nowMs: guardNow });
check('USD limits parse precisely; malformed, negative and scientific values fail closed',
  parseUsdMicro('0.020005') === 20005n &&
  parseUsdMicro('0') === 0n &&
  ['-1', 'NaN', 'Infinity', '1e6', 1, '', '0.0000001'].every(x => parseUsdMicro(x) === null));
const guard = guardSetup();
const reserved = guard.preflight({ inputBytes: 2000, maxOutputTokens: 800 });
check('preflight reserves priced upper input and maximum output before a call',
  guard.ready && reserved.ok && guard.snapshot().outstanding === 1 &&
  guard.snapshot().reserved_pending_usd !== '0.000000');
const denied = guard.preflight({ inputBytes: 200000, maxOutputTokens: 20000 });
check('single request larger than remaining USD cap is denied before provider call',
  !denied.ok && denied.reason.includes('exhausted') && guard.snapshot().outstanding === 1);
const reconciled = guard.settle(reserved.id, { input_tokens: 250, output_tokens: 60 });
check('actual billable usage settles reservation using verified model rates',
  reconciled.ok && reconciled.usage_status === 'priced' &&
  guard.snapshot().outstanding === 0 && guard.snapshot().estimated_committed_usd === '0.000980');
check('a reservation cannot be refunded or settled twice',
  !guard.settle(reserved.id, { input_tokens: 1, output_tokens: 1 }).ok);
const unknownGuard = guardSetup();
const uReservation = unknownGuard.preflight({ inputBytes: 3000, maxOutputTokens: 850 });
const uSpend = unknownGuard.settle(uReservation.id, null);
check('missing provider usage retains FULL reservation rather than treating request as free',
  uSpend.usage_status === 'unknown_reserved' &&
  uSpend.estimated_usd === uReservation.reserved_usd);
check('missing rate table or USD cap always blocks paid requests',
  !guardSetup(undefined, 'openai', 'fixture-openai', '').preflight({
    inputBytes: 100, maxOutputTokens: 10 }).ok &&
  !guardSetup('0.000000').preflight({ inputBytes: 100, maxOutputTokens: 10 }).ok);
const badQuote = guardSetup('0.050000', 'openai', 'unapproved-model');
check('a model without a verified pricing entry fails closed',
  !badQuote.preflight({ inputBytes: 100, maxOutputTokens: 100 }).ok);
const two = guardSetup('0.030000', 'anthropic', 'fixture-anthropic');
const aRes = two.preflight({ inputBytes: 4000, maxOutputTokens: 900 });
check('Anthropic reservations cover the most expensive eligible cache class',
  aRes.ok && two.settle(aRes.id, {
    input_tokens: 300, output_tokens: 80,
    cache_read_input_tokens: 150, cache_creation_input_tokens: 50,
  }).usage_status === 'priced');
check('invalid token sizes cannot reduce the cap reservation',
  !guardSetup().preflight({ inputBytes: '100', maxOutputTokens: 500 }).ok &&
  !guardSetup().preflight({ inputBytes: -1, maxOutputTokens: 500 }).ok);


const eventA = {
  schema: 1, observed_at: '2026-10-12T12:00:00.000Z',
  provider: 'openai', model: 'fixture-openai', workflow: 'screening-digest',
  requests: 1, status: 'priced', estimated_usd: '0.002500',
  input_tokens: 1000, output_tokens: 100,
};
const eventB = { ...eventA, status: 'unknown_reserved', estimated_usd: '0.030000' };
const eventC = { ...eventA, requests: 0, status: 'blocked', estimated_usd: null };
const lineRecords = [eventA, eventB, eventC].map(x => JSON.stringify(x)).join('\n') + '\n';
const parsedEvents = parseApiCostEvents(lineRecords);
const costSummary = summarizeApiCostEvents(parsedEvents.events);
check('metadata-only events parse into distinct quoted, reserved and blocked states',
  parsedEvents.ok && parsedEvents.events.length === 3 && costSummary.ok &&
  costSummary.requests === 2 && costSummary.blocked_events === 1);
check('dashboard keeps actual-usage estimates distinct from unknown-usage reservations',
  costSummary.priced_estimate_usd === '0.002500' &&
  costSummary.unknown_usage_reserved_usd === '0.030000' &&
  renderApiCostDashboard(costSummary).includes('Unknown usage reserved'));
check('empty data never masquerades as a verified zero vendor invoice',
  renderApiCostDashboard(summarizeApiCostEvents([])).includes('Missing telemetry is not evidence of zero spending'));
check('unexpected customer names, prompt content and secret-bearing fields are disallowed',
  !validateApiCostEvent({ ...eventA, customer_name: 'SYNTHETIC PRIVATE' }) &&
  !validateApiCostEvent({ ...eventA, prompt: 'SYNTHETIC PRIVATE' }));
check('invalid provider, model, date, monetary values and negative tokens fail closed',
  !validateApiCostEvent({ ...eventA, provider: 'third_party' }) &&
  !validateApiCostEvent({ ...eventA, model: 'fake | markdown' }) &&
  !validateApiCostEvent({ ...eventA, observed_at: 'yesterday' }) &&
  !validateApiCostEvent({ ...eventA, estimated_usd: '-1' }) &&
  !validateApiCostEvent({ ...eventA, input_tokens: -5 }));
check('a bad JSON line cannot be silently discarded from the cost dashboard',
  !parseApiCostEvents(JSON.stringify(eventA) + '\n{broken').ok &&
  !parseApiCostEvents(JSON.stringify({ ...eventA, cost_usd: '0' })).ok);


const quotaEvent = { schema: 1, observed_at: '2026-10-12T12:00:00.000Z',
  provider: 'anthropic', workflow: 'regulatory-watch', model: 'test-model',
  http_status: 429, cause: 'rate_or_quota' };
check('quota detection distinguishes throttling from provider billing/auth failures',
  classifyApiQuotaFailure(429) === 'rate_or_quota' &&
  classifyApiQuotaFailure(400, 'provider billing or authentication failure') === 'billing_or_auth' &&
  classifyApiQuotaFailure(503) === null);
check('metadata-only quota event passes and raw provider error bodies are impossible',
  validApiQuotaEvent(quotaEvent) &&
  !validApiQuotaEvent({ ...quotaEvent, error_body: 'PRIVATE CUSTOMER ACCOUNT' }) &&
  !validApiQuotaEvent({ ...quotaEvent, model: 'bad | injected' }));
const parsedQuota = parseApiQuotaEvents(JSON.stringify(quotaEvent) + '\n');
check('quota events retain only approved classifications and preserve source', parsedQuota.ok &&
  parsedQuota.events.length === 1 &&
  renderQuotaSummary(parsedQuota.events).includes('rate_or_quota'));
check('invalid quota telemetry cannot silently disappear',
  !parseApiQuotaEvents('{bad}').ok &&
  !parseApiQuotaEvents(JSON.stringify({ ...quotaEvent, token: 'SECRET' })).ok);
let apiCalls = [];
const mockFetch = async (url, opts) => {
  apiCalls.push({ url, method: opts.method || 'GET' });
  if (!opts.method) return { ok: true, headers: { get: () => null },
    json: async () => [{ title: 'API quota alert: anthropic / regulatory-watch / rate_or_quota' }] };
  return { ok: true };
};
const dedupQuota = await notifyApiQuotaIssues([quotaEvent], {
  repository: 'owner/repo', token: 'SYNTHETIC_TOKEN', fetchImpl: mockFetch,
});
check('quota issue notifications are deduplicated against existing open issues',
  dedupQuota.ok && dedupQuota.already_open === 1 &&
  apiCalls.length === 1 && apiCalls[0].method === 'GET');
const incompleteIndex = await notifyApiQuotaIssues([quotaEvent], {
  repository: 'owner/repo', token: 'SYNTHETIC_TOKEN',
  fetchImpl: async () => ({ ok: true, headers: { get: () => '<next>; rel="next"' },
    json: async () => [] }),
});
check('unverified paginated issue history cannot trigger duplicate issue creation',
  !incompleteIndex.ok && incompleteIndex.reason === 'github_issue_index_unavailable');
check('quota issue notifier fails safely without a GitHub token and never calls fetch',
  !(await notifyApiQuotaIssues([quotaEvent], {
    repository: 'owner/repo', fetchImpl: async () => { throw Error('should not call'); }
  })).ok);

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
