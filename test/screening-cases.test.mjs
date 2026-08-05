/* Offline unit tests for the screening case lifecycle's pure logic
   (scripts/screening-cases.mjs). No network, no filesystem.
   Usage: node test/screening-cases.test.mjs */
import { planCaseActions, newCaseStateEntry, caseTitle, caseHtml, addDays, ageInDays, CASE_SLA_DAYS, CASE_SECTIONS, buildResultsDigestHtml, resultsDigestTitle, parseDisposition, whitelistablePairs } from '../scripts/screening-cases.mjs';

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
/* Entity keys have no gid segment — the state record's own gid must supply the
   case id (every company case used to be titled CASE-XXXXXX). */
check('caseTitle falls back to the subject gid for a legal-entity key',
  caseTitle('amber international fzco', subj({ name: 'Amber International FZCO', gid: '1214107911223344' }))
    === '🧾 CASE-223344 — Amber International FZCO — sanctions-match');
check('caseTitle without any gid still renders (pre-migration record)',
  caseTitle('amber international fzco', subj({ name: 'Amber International FZCO' }))
    === '🧾 CASE-XXXXXX — Amber International FZCO — sanctions-match');
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

check('a re-flagged subject after clearance gets a FRESH case referencing the prior one', (() => {
  /* DESIGN CHANGE (owner-authorized): this used to pin "stays with the closed
     case (manual reopen by design)". In the shipped case-engine config alerts
     are suppressed, so the case board is the ONLY delivery surface — the old
     behavior left a re-listed customer with just a digest line pointing at a
     COMPLETED case (no open case, no SLA, no assignee). Now the planner
     creates a fresh case, due today+SLA, carrying priorCase {taskGid,
     clearedAt} so the new card references the history. */
  const a = planCaseActions({ [KEY]: subj() }, { [KEY]: { taskGid: 't1', cleared: true, clearedAt: '2026-07-01' } }, TODAY);
  return a.length === 1 && a[0].type === 'create' && a[0].dueOn === addDays(TODAY, CASE_SLA_DAYS)
    && a[0].priorCase && a[0].priorCase.taskGid === 't1' && a[0].priorCase.clearedAt === '2026-07-01';
})());

check('re-flag create REPLACES the cleared state entry — SLA/aging restart, digest resolves the NEW case', (() => {
  /* Simulate the executor: the plan's create lands as a fresh open entry via
     newCaseStateEntry, so caseGidFor (casesState[key].taskGid) now yields the
     NEW case gid — the audit found the digest linking the old completed one. */
  const cases = { [KEY]: { taskGid: 't1', cleared: true, clearedAt: '2026-07-01', agingAlerted: true } };
  const a = planCaseActions({ [KEY]: subj() }, cases, TODAY)[0];
  cases[a.key] = newCaseStateEntry('t2', TODAY, a.priorCase);
  const caseGidFor = k => (cases[k] || {}).taskGid || null;
  return caseGidFor(KEY) === 't2' && cases[KEY].cleared === false && cases[KEY].agingAlerted === false
    && cases[KEY].createdAt === TODAY && cases[KEY].reopenedFrom === 't1' && cases[KEY].reopenedAt === TODAY;
})());

check('second clearance then THIRD re-flag runs the same reopen path against the second case', (() => {
  const cases = { [KEY]: { taskGid: 't1', cleared: true, clearedAt: '2026-06-30' } };
  /* re-flag #1 → fresh case t2 replaces t1's cleared entry */
  const a1 = planCaseActions({ [KEY]: subj() }, cases, TODAY)[0];
  cases[a1.key] = newCaseStateEntry('t2', TODAY, a1.priorCase);
  /* subject drops off again → auto-clear t2 (simulated as the executor does) */
  const a2 = planCaseActions({ [KEY]: subj({ lastSeen: TODAY }) }, cases, '2026-07-10');
  if (!(a2.length === 1 && a2[0].type === 'clear' && a2[0].caseGid === 't2')) return false;
  cases[KEY] = { ...cases[KEY], cleared: true, clearedAt: '2026-07-10' };
  /* re-flag #2 → a third fresh case referencing t2, not t1 */
  const a3 = planCaseActions({ [KEY]: subj({ lastSeen: '2026-07-15' }) }, cases, '2026-07-15');
  return a3.length === 1 && a3[0].type === 'create'
    && a3[0].priorCase.taskGid === 't2' && a3[0].priorCase.clearedAt === '2026-07-10';
})());

check('a still-OPEN case is never duplicated by the reopen path', (() => {
  const fresh = subj({ firstSeen: '2026-07-05' });
  const a = planCaseActions({ [KEY]: fresh }, { [KEY]: { taskGid: 't1', createdAt: '2026-07-05', agingAlerted: false, cleared: false } }, TODAY);
  return a.length === 0;
})());

check('a subject clear on both runs (inactive + cleared case) stays no-action', (() => {
  const gone = subj({ lastSeen: '2026-07-05' });
  const a = planCaseActions({ [KEY]: gone }, { [KEY]: { taskGid: 't1', cleared: true, clearedAt: '2026-07-06' } }, TODAY);
  return a.length === 0;
})());

check('newCaseStateEntry without a prior case is a plain open entry (no reopen fields)', (() => {
  const e = newCaseStateEntry('t9', TODAY, undefined);
  return e.taskGid === 't9' && e.cleared === false && e.agingAlerted === false
    && !('reopenedFrom' in e) && !('reopenedAt' in e);
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
const reflagHtml = caseHtml(KEY, subj(), 'https://example/run', { taskGid: 't1', clearedAt: '2026-07-01' });
check('re-flag case body references the prior case gid and its cleared date',
  reflagHtml.includes('RE-FLAGGED AFTER CLEARANCE') && reflagHtml.includes('data-asana-gid="t1"')
  && reflagHtml.includes('cleared 2026-07-01') && /^<body>[\s\S]*<\/body>$/.test(reflagHtml));
check('a first-time case body carries no re-flag banner',
  !caseHtml(KEY, subj(), 'https://example/run').includes('RE-FLAGGED'));
/* Evidence rows: the card names WHO matched (designated name · score ·
   confidence · mechanism) when the state carries hit detail; a legal-entity
   record links its customer record through its own gid. */
const entHtml = caseHtml('amber international fzco',
  subj({ name: 'Amber International FZCO', gid: '77112233',
    hits: [{ list: 'UK OFSI', hitName: 'AMBER INTL FZCO', score: 91, mechanism: 'fuzzy', confidence: 'MODERATE' },
           { list: 'EU FSF', carriedForward: true }] }), 'https://example/run');
check('entity case body links the customer record via the persisted subject gid',
  entHtml.includes('data-asana-gid="77112233"'));
check('case body renders per-hit evidence: designated name, score, confidence, mechanism',
  entHtml.includes('UK OFSI') && entHtml.includes('AMBER INTL FZCO') && entHtml.includes('score 91')
  && entHtml.includes('MODERATE') && entHtml.includes('via fuzzy'));
check('a carried-forward hit is labelled not-re-verified, never presented as fresh evidence',
  entHtml.includes('carried forward (list not re-verified this run)'));
check('a pre-migration record (no hits array) still renders the list names',
  caseHtml(KEY, subj(), 'https://example/run').includes('UK OFSI'));

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
check('digest: match row prefers hit evidence (designated name + score + confidence) when the artifact carries it', (() => {
  const withHits = buildResultsDigestHtml({ ...RESULTS,
    alerts: [{ ...RESULTS.alerts[0],
      hits: [{ list: 'UK OFSI', hitName: 'DOE, John', score: 87, mechanism: 'fuzzy', confidence: 'MODERATE' }] }] },
    a => (a.key === KEY ? 'case-gid-1' : null));
  return withHits.includes('DOE, John') && withHits.includes('87 · MODERATE') && withHits.includes('UK OFSI');
})());
check('digest: coverage totals + failed list + degraded warning are loud',
  digest.includes('38405 designated names') && digest.includes('⚠️ UN consolidated could not be loaded')
  && digest.includes('DEGRADED'));
check('digest: enrichment shortfall and cleared count are reported, MLRO/four-eyes note present',
  digest.includes('644 subject(s) skipped enrichment') && digest.includes('2 previously recorded match(es)')
  && digest.includes('four-eyes'));
check('digest: narrowed adverse-media coverage is disclosed, never silent', (() => {
  const partial = buildResultsDigestHtml({ ...RESULTS,
    enrichment: { amErrors: 0, amPartial: 12, pepErrors: 0, skipped: 0, amLocalesPerSubject: 8 } });
  return partial.includes('12 subject(s) had NARROWED adverse-media coverage')
    && partial.includes('Adverse-media sweep: 8 news edition(s) per subject');
})());
check('digest: a clean day is affirmative, never silent', (() => {
  const clean = buildResultsDigestHtml({ ...RESULTS, alerts: [], newMatches: 0, clearedCount: 0, degraded: false, failures: [], enrichment: {} });
  return clean.includes('every subject screened clean') && !clean.includes('DEGRADED');
})());
check('digest title states the outcome and volume',
  resultsDigestTitle(RESULTS) === '🛡️ Sanctions Screen — ' + TODAY + ' — 1 new match(es) · 778 screened'
  && resultsDigestTitle({ ...RESULTS, newMatches: 0 }).includes('no new matches'));

/* ── Disposition read-back (analyst feedback loop) ── */
check('parseDisposition: untouched template parses as null (no false trigger)',
  parseDisposition('[ ] false positive — …\n[ ] escalate / freeze (TFS) — …\n[ ] under investigation — …') === null);
check('parseDisposition: ticked false positive',
  parseDisposition('bla\n[x] false positive — clear this case…') === 'false-positive');
check('parseDisposition: ticked escalate (case-insensitive, spaced tick)',
  parseDisposition('[ X ] Escalate / freeze (TFS)') === 'escalate');
check('parseDisposition: conflicted card resolves fail-safe — escalate beats false positive',
  parseDisposition('[x] false positive\n[x] escalate') === 'escalate');
check('parseDisposition: ticked under investigation',
  parseDisposition('[x] under investigation') === 'investigating');
check('whitelistablePairs excludes enrichment/local/internal lists',
  (() => { const p = whitelistablePairs([
    { hitName: 'A', list: 'US OFAC — SDN list (CSV)' },
    { hitName: 'B', list: 'Adverse media (Google News)' },
    { hitName: 'C', list: 'PEP (Wikidata)' },
    { hitName: 'D', list: 'MANUAL REVIEW' },
    { hitName: 'E', list: 'Internal — Firm Watchlist' },
    { hitName: '', list: 'UN Security Council — Consolidated list (XML)' }]);
    return p.length === 1 && p[0].hitName === 'A'; })());

/* ── Planner: whitelist + escalation guards ── */
const _s = (extra) => ({ name: 'S', lastSeen: TODAY, firstSeen: TODAY, recommendation: 'review', band: 'medium', ...extra });
check('planner: whitelistedOnly subject opens NO case',
  planCaseActions({ k1: _s({ whitelistedOnly: true }) }, {}, TODAY).length === 0);
check('planner: whitelistedOnly does not re-open a cleared case',
  planCaseActions({ k1: _s({ whitelistedOnly: true }) }, { k1: { taskGid: 't', cleared: true, clearedAt: '2026-07-01' } }, TODAY).length === 0);
check('planner: whitelistedOnly closes an OPEN case with the registry reason',
  (() => { const a = planCaseActions({ k1: _s({ whitelistedOnly: true }) }, { k1: { taskGid: 't', cleared: false } }, TODAY);
    return a.length === 1 && a[0].type === 'clear' && a[0].reason === 'whitelist'; })());
check('planner: an escalated case is never auto-cleared — not by absence…',
  planCaseActions({}, { k1: { taskGid: 't', cleared: false, escalated: true } }, TODAY).length === 0);
check('planner: …and not by the whitelist either',
  planCaseActions({ k1: _s({ whitelistedOnly: true }) }, { k1: { taskGid: 't', cleared: false, escalated: true } }, TODAY).length === 0);
check('planner: a same-day disposition never re-opens the case it just closed',
  planCaseActions({ k1: _s({}) }, { k1: { taskGid: 't', cleared: true, clearedAt: TODAY,
    disposition: { kind: 'false-positive', at: TODAY } } }, TODAY).length === 0);
check('planner: a PAST disposition does not block a genuine re-flag (fresh case)',
  (() => { const a = planCaseActions({ k1: _s({}) }, { k1: { taskGid: 't', cleared: true, clearedAt: '2026-07-01',
    disposition: { kind: 'false-positive', at: '2026-07-01' } } }, TODAY);
    return a.length === 1 && a[0].type === 'create' && a[0].priorCase && a[0].priorCase.taskGid === 't'; })());

/* ── Card renders the loop's surfaces ── */
check('case card carries the machine-read disposition block',
  (() => { const html = caseHtml('k1', _s({}), null, null);
    return html.includes('[ ] false positive') && html.includes('[ ] escalate / freeze (TFS)')
      && html.includes('[ ] under investigation') && parseDisposition(html) === null; })());
check('case card renders a corroborated second opinion',
  caseHtml('k1', _s({ secondOpinion: { provider: 'OFAC-API', status: 'corroborated', matchCount: 2, topScore: 92, checkedAt: TODAY } }), null, null)
    .includes('Second opinion (OFAC-API):'));
check('case card renders an unavailable second opinion as a LOST signal, not a clear',
  caseHtml('k1', _s({ secondOpinion: { provider: 'OFAC-API', status: 'unavailable', error: 'http 500', checkedAt: TODAY } }), null, null)
    .includes('a lost signal, not a clear'));
check('case card annotates a whitelisted hit with its clearance',
  caseHtml('k1', _s({ hits: [{ list: 'US OFAC — SDN list (CSV)', hitName: 'X', score: 90, whitelisted: true, clearedVia: 'case t1' }] }), null, null)
    .includes('CLEARED FP'));

/* ── Asana html_notes XML contract ──────────────────────────────────────────
   Asana parses html_notes as STRICT XML against a supported-tag subset; the
   original disposition block's <p>…<br>…</p> 400'd EVERY live case create
   (xml_parsing_error, observed twice 2026-08-05). This guard freezes the
   contract: every tag balanced or self-closed, and every tag on Asana's
   supported list — an unsupported tag fails here, not on the runner. */
const ASANA_TAGS = new Set(['body', 'h1', 'h2', 'ol', 'ul', 'li', 'strong', 'em',
  'u', 's', 'code', 'pre', 'blockquote', 'a', 'hr', 'table', 'tr', 'td']);
function asanaXmlOk(html) {
  const stack = [];
  const re = /<(\/?)([a-zA-Z0-9]+)((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)>/g;
  let m, last = 0;
  while ((m = re.exec(html))) {
    if (html.slice(last, m.index).includes('<')) return 'stray < outside a tag';
    last = re.lastIndex;
    const [, close, tag, , self] = m;
    if (!ASANA_TAGS.has(tag.toLowerCase())) return 'unsupported tag <' + tag + '>';
    if (self) continue;
    if (close) {
      if (stack.pop() !== tag.toLowerCase()) return 'mismatched </' + tag + '>';
    } else if (tag.toLowerCase() === 'hr') { /* void allowed unclosed nowhere — require self-close */
      return '<hr> must self-close';
    } else stack.push(tag.toLowerCase());
  }
  if (html.slice(last).includes('<')) return 'stray < after last tag';
  return stack.length ? 'unclosed <' + stack[stack.length - 1] + '>' : '';
}
const _fullCard = caseHtml('acme llc|ubo|123', _s({
  hits: [
    { list: 'US OFAC — SDN list (CSV)', hitName: 'A & B “Ltd”', score: 90, mechanism: 'fuzzy', confidence: 'strong', carriedForward: true },
    { list: 'PEP (Worldwide — Wikidata)', hitName: 'X — Minister, Testland', score: 88, whitelisted: true, clearedAt: '2026-08-01', clearedVia: 'case t9' }],
  secondOpinion: { provider: 'OFAC-API', status: 'corroborated', matchCount: 2, topScore: 97, checkedAt: '2026-08-05' },
}), 'https://example/run?a=1&b=2', { taskGid: 't1', clearedAt: '2026-07-01' });
check('case card is strict-XML clean for Asana (balanced, supported tags only): ' + (asanaXmlOk(_fullCard) || 'ok'),
  asanaXmlOk(_fullCard) === '');
check('case card carries no <br> and no <p> (the tags Asana 400s on)',
  !/<br\b/i.test(_fullCard) && !/<p\b/i.test(_fullCard));
check('disposition block survives as three verbatim machine-readable lines',
  _fullCard.includes('[ ] false positive — clear this case')
  && _fullCard.includes('[ ] escalate / freeze (TFS) — keep the case open')
  && _fullCard.includes('[ ] under investigation — keep working'));
const _digestXml = asanaXmlOk(buildResultsDigestHtml(
  { date: '2026-08-05', screened: 2, newMatches: [{ name: 'A & B', band: 'high', topScore: 90, recommendation: 'sanctions-match', lists: ['US OFAC — SDN list (CSV)'] }], stillMatched: [], cleared: [], degraded: true, notes: ['EU list could not be loaded — coverage degraded'] },
  () => 'case-gid-1'));
check('digest html is strict-XML clean too: ' + (_digestXml || 'ok'), _digestXml === '');

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
