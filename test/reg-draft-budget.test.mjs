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
check('unapproved source URL and name cannot become rendered action links',
  !manualDraftSection({ name: 'MALICIOUS_SOURCE', url:'javascript:alert(1)' },
      'source not approved').includes('MALICIOUS_SOURCE') &&
  !manualDraftSection({ name: 'MALICIOUS_SOURCE', url:'javascript:alert(1)' },
      'source not approved').includes('javascript:'));

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

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
