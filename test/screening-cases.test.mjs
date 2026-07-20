/* Offline unit tests for the screening case lifecycle's pure logic
   (scripts/screening-cases.mjs). No network, no filesystem.
   Usage: node test/screening-cases.test.mjs */
import { planCaseActions, caseTitle, caseHtml, addDays, ageInDays, CASE_SLA_DAYS, CASE_SECTIONS, buildResultsDigestHtml, resultsDigestTitle } from '../scripts/screening-cases.mjs';

let passed = 0, failed = 0;
function check(name, cond) {
  if (cond) { passed++; console.log('  ok  ' + name); }
  else { failed++; console.error('  FAIL ' + name); }
}

const TODAY = '2026-07-08';
/* Fixture subjects use fictional names (John Doe / Jane Roe); the GIDs are
   inert numeric identifiers kept stable for the CASE-number assertions. */
const subj = (over = {}) => ({
  name: 'John Doe', jurisdiction: 'Dominica', band: 'high', topScore: 87,
  recommendation: 'sanctions-match', lists: ['UK OFSI'], firstSeen: '2026-06-27', lastSeen: TODAY, ...over
});

/* ── helpers ── */
check('addDays computes the SLA due date', addDays('2026-06-27', 5) === '2026-07-02' && addDays('junk', 5) === null);
check('ageInDays counts whole days, defensive on garbage', ageInDays('2026-06-27', TODAY) === 11 && ageInDays(null, TODAY) === 0);
check('caseTitle is stable and carries the customer GID tail',
  caseTitle('john doe|ubo|1214107985842154', subj()) === '🧾 CASE-842154 — John Doe — sanctions-match');
check('the four lifecycle sections are defined', Object.keys(CASE_SECTIONS).length === 4 && CASE_SLA_DAYS === 5);

/* ── planner ── */
const KEY = 'john doe|ubo|1214107985842154';

check('new flag with no case → create, due = firstSeen + SLA', (() => {
  const a = planCaseActions({ [KEY]: subj() }, {}, TODAY);
  return a.length === 1 && a[0].type === 'create' && a[0].dueOn === '2026-07-02';
})());

check('standing flag with an open case inside the SLA → no action', (() => {
  const fresh = subj({ firstSeen: '2026-07-05' });
  const a = planCaseActions({ [KEY]: fresh }, { [KEY]: { taskGid: 't1', createdAt: '2026-07-05', agingAlerted: false, cleared: false } }, TODAY);
  return a.length === 0;
})());

check('case open past the SLA → exactly one aging action, never repeated', (() => {
  const cs = { [KEY]: { taskGid: 't1', createdAt: '2026-06-27', agingAlerted: false, cleared: false } };
  const first = planCaseActions({ [KEY]: subj() }, cs, TODAY);
  const again = planCaseActions({ [KEY]: subj() }, { [KEY]: { ...cs[KEY], agingAlerted: true } }, TODAY);
  return first.length === 1 && first[0].type === 'age' && first[0].ageDays === 11 && again.length === 0;
})());

check('subject no longer flagged today → auto-clear', (() => {
  const gone = subj({ lastSeen: '2026-07-05' });
  const a = planCaseActions({ [KEY]: gone }, { [KEY]: { taskGid: 't1', createdAt: '2026-06-27', agingAlerted: true, cleared: false } }, TODAY);
  return a.length === 1 && a[0].type === 'clear' && a[0].caseGid === 't1';
})());

check('subject vanished from the registry entirely → auto-clear its case', (() => {
  const a = planCaseActions({}, { [KEY]: { taskGid: 't1', createdAt: '2026-06-27', cleared: false } }, TODAY);
  return a.length === 1 && a[0].type === 'clear';
})());

check('a cleared case never re-acts', (() => {
  const a = planCaseActions({}, { [KEY]: { taskGid: 't1', cleared: true, clearedAt: '2026-07-01' } }, TODAY);
  return a.length === 0;
})());

check('a re-flagged subject after clearance stays with the closed case (manual reopen by design)', (() => {
  /* cleared case + subject flagged again today → planner treats it as active
     with an existing (cleared) case: current design keeps the old case closed
     and creates nothing — verify no clear/age fires on a cleared case. */
  const a = planCaseActions({ [KEY]: subj() }, { [KEY]: { taskGid: 't1', cleared: true } }, TODAY);
  return a.length === 0; /* documented: manual reopen if the same standing match returns */
})());

check('mixed registry plans each subject independently', (() => {
  const k2 = 'jane roe|ubo|1214107921925846';
  const a = planCaseActions(
    { [KEY]: subj(), [k2]: subj({ name: 'Jane Roe', recommendation: 'review', lastSeen: '2026-07-01' }) },
    { [k2]: { taskGid: 't2', createdAt: '2026-06-27', cleared: false } },
    TODAY);
  const types = a.map(x => x.type).sort().join();
  return types === 'clear,create';
})());

/* ── card body ── */
const html = caseHtml(KEY, subj(), 'https://example/run');
check('case body: single <body> root, escalation banner for sanctions-match, SLA and lifecycle present',
  /^<body>[\s\S]*<\/body>$/.test(html) && html.includes('POTENTIAL SANCTIONS MATCH')
  && html.includes('review within ' + CASE_SLA_DAYS + ' days') && html.includes('auto-moved to Cleared'));
check('case body links the customer record by GID', html.includes('data-asana-gid="1214107985842154"'));
check('case body: a plain review flag gets the softer banner',
  caseHtml(KEY, subj({ recommendation: 'review' })).includes('Screening flag — review required'));

/* ── daily results digest (the Asana results surface) ── */
const RESULTS = {
  date: TODAY, screened: 778, entities: 334, individuals: 444,
  newMatches: 1, matchCount: 9, clearedCount: 2, degraded: true,
  lists: [{ name: 'UK OFSI', count: 19761 }, { name: 'France DGT', count: 18644 }],
  failures: ['UN consolidated could not be loaded (fetch failed) — coverage degraded'],
  enrichment: { amErrors: 100, pepErrors: 0, skipped: 644 },
  alerts: [{ key: KEY, name: 'John Doe', jurisdiction: 'Dominica', band: 'high', topScore: 87, recommendation: 'sanctions-match', lists: ['UK OFSI'] }],
  cleared: ['Old Match Ltd', 'Another One']
};
const digest = buildResultsDigestHtml(RESULTS, a => (a.key === KEY ? 'case-gid-1' : null));
check('digest: single <body> root with headline counts',
  /^<body>[\s\S]*<\/body>$/.test(digest) && digest.includes('778 subjects screened') && digest.includes('9 standing match(es)'));
check('digest: match row links its lifecycle case and carries score/band/lists',
  digest.includes('data-asana-gid="case-gid-1"') && digest.includes('score 87') && digest.includes('UK OFSI'));
check('digest: coverage totals + failed list + degraded warning are loud',
  digest.includes('38405 designated names') && digest.includes('⚠️ UN consolidated could not be loaded')
  && digest.includes('DEGRADED'));
check('digest: enrichment shortfall and cleared count are reported, MLRO/four-eyes note present',
  digest.includes('644 subject(s) skipped enrichment') && digest.includes('2 previously recorded match(es)')
  && digest.includes('four-eyes'));
check('digest: a clean day is affirmative, never silent', (() => {
  const clean = buildResultsDigestHtml({ ...RESULTS, alerts: [], newMatches: 0, clearedCount: 0, degraded: false, failures: [], enrichment: {} });
  return clean.includes('every subject screened clean') && !clean.includes('DEGRADED');
})());
check('digest title states the outcome and volume',
  resultsDigestTitle(RESULTS) === '🛡️ Sanctions Screen — ' + TODAY + ' — 1 new match(es) · 778 screened'
  && resultsDigestTitle({ ...RESULTS, newMatches: 0 }).includes('no new matches'));

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
