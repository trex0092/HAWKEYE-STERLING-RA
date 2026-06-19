/* Unit tests for the Sanctions Screen pure logic (no network).
   Usage: node test/sanctions-screen.test.mjs */
import {
  normalizeName, parseSubject, parseSubjects, normalizeHit, normalizeScreenResponse,
  isMaterial, hitKey, diffState, buildScreenReport, buildScreenHtml, buildChangesArtifact,
  GOVERNANCE_NOTE, DEFAULT_THRESHOLD
} from '../scripts/sanctions-screen.mjs';

let passed = 0, failed = 0;
function check(name, cond) {
  if (cond) { passed++; console.log('  ok  ' + name); }
  else { failed++; console.log('FAIL  ' + name); }
}

/* ── name folding ── */
check('normalizeName folds case, punctuation and diacritics',
  normalizeName('YÜKSEL KIYMETLİ MADENLER TİCARET A.Ş.') === normalizeName('yuksel kiymetli madenler ticaret a s'));
check('normalizeName collapses (FZE)/L.L.C punctuation',
  normalizeName('ZOE Precious Metals and Jewelery (FZE)') === 'zoe precious metals and jewelery fze');

/* ── subject parsing ── */
const task = {
  gid: '111', name: 'WPM INT LLC', completed: false,
  notes: 'Company Name : WPM INT LLC\nJurisdiction : United Arab Emirates\nTrade Licence : DMCC-12345\n'
};
const s = parseSubject(task);
check('parseSubject pulls name', s.name === 'WPM INT LLC');
check('parseSubject parses jurisdiction from notes', s.jurisdiction === 'United Arab Emirates');
check('parseSubject parses licence/id from notes', s.idNumber === 'DMCC-12345');
check('parseSubject sets organisation + gid', s.entityType === 'organisation' && s.gid === '111');

const subs = parseSubjects([
  task,
  { gid: '2', name: 'Done Co', completed: true },           /* off-boarded → skipped */
  { gid: '3', name: 'WPM Int  LLC', completed: false },      /* dup of WPM INT LLC → skipped */
  { gid: '4', name: 'Xafari DMCC', completed: false },
  { gid: '5', name: '', completed: false }                   /* empty → skipped */
]);
check('parseSubjects skips completed, dedups by key, drops empties', subs.length === 2
  && subs.map(x => x.name).sort().join('|') === 'WPM INT LLC|Xafari DMCC');

/* ── hit + response normalisation across shapes ── */
check('normalizeHit maps varied field names', (() => {
  const h = normalizeHit({ matchedName: 'ACME', sanctionsList: 'OFAC SDN', confidence: 0.91, entityId: 'OFAC-1', topic: 'sanction' });
  return h.hitName === 'ACME' && h.list === 'OFAC SDN' && h.score === 0.91 && h.hitId === 'OFAC-1' && h.category === 'sanction';
})());

const subjects = [{ key: normalizeName('WPM INT LLC'), name: 'WPM INT LLC', jurisdiction: 'AE', gid: '111' }];
const respResults = normalizeScreenResponse({ results: [{ name: 'WPM Int LLC', hits: [{ hitName: 'WPM', list: 'UAE EOCN', matchScore: 0.97, id: 'AE-9' }] }] }, subjects);
check('normalizeScreenResponse {results} re-keys to subject (jurisdiction survives)',
  respResults.results.length === 1 && respResults.results[0].jurisdiction === 'AE' && respResults.results[0].hits[0].list === 'UAE EOCN');
check('normalizeScreenResponse handles bare array', normalizeScreenResponse([{ name: 'X', hits: [] }]).results.length === 1);
check('normalizeScreenResponse handles {data}', normalizeScreenResponse({ data: [{ name: 'Y', matches: [{ name: 'Z' }] }] }).results[0].hits.length === 1);
check('normalizeScreenResponse handles single object', normalizeScreenResponse({ subject: 'Solo', hits: [{ name: 'h' }] }).results.length === 1);
check('normalizeScreenResponse propagates degraded', normalizeScreenResponse({ degraded: true, results: [] }).degraded === true);

/* ── materiality ── */
check('isMaterial respects threshold', isMaterial({ score: 0.9 }, 0.85) && !isMaterial({ score: 0.5 }, 0.85));
check('isMaterial keeps unscored hits (conservative)', isMaterial({ hitName: 'x' }, 0.85) === true);
check('DEFAULT_THRESHOLD is 0.85', DEFAULT_THRESHOLD === 0.85);

/* ── diff / state machine ── */
const r1 = [{ key: 'a', name: 'A Co', jurisdiction: 'AE', hits: [{ hitName: 'A', list: 'OFAC SDN', score: 0.95, hitId: '1' }] }];
const d1 = diffState({ updated: null, subjects: {} }, r1, '2026-06-19', 0.85);
check('diffState flags a brand-new match', d1.alerts.length === 1 && d1.alerts[0].newHits.length === 1);
check('diffState writes the match into next state with firstSeen', !!d1.nextState.subjects.a.hits[hitKey({ list: 'OFAC SDN', hitId: '1' })]
  && d1.nextState.subjects.a.hits[hitKey({ list: 'OFAC SDN', hitId: '1' })].firstSeen === '2026-06-19');

/* same match next day → NOT re-alerted, firstSeen preserved */
const d2 = diffState(d1.nextState, r1, '2026-06-20', 0.85);
check('diffState does NOT re-alert a standing match', d2.alerts.length === 0);
check('diffState preserves original firstSeen on a standing match',
  d2.nextState.subjects.a.hits[hitKey({ list: 'OFAC SDN', hitId: '1' })].firstSeen === '2026-06-19');

/* match disappears → cleared (informational), subject removed from state */
const d3 = diffState(d2.nextState, [{ key: 'a', name: 'A Co', hits: [] }], '2026-06-21', 0.85);
check('diffState records a cleared match and removes the subject', d3.alerts.length === 0 && d3.cleared.length === 1 && !d3.nextState.subjects.a);

/* a second, different list hit on an already-matched subject IS a new alert */
const r2 = [{ key: 'a', name: 'A Co', hits: [{ hitName: 'A', list: 'OFAC SDN', score: 0.95, hitId: '1' }, { hitName: 'A', list: 'EU FSF', score: 0.9, hitId: '2' }] }];
const d4 = diffState(d1.nextState, r2, '2026-06-20', 0.85);
check('diffState alerts only the NEW list hit on a known subject', d4.alerts.length === 1 && d4.alerts[0].newHits.length === 1 && d4.alerts[0].newHits[0].list === 'EU FSF');

/* errored subject keeps its prior state, never wiped, never alerted */
const d5 = diffState(d1.nextState, [{ key: 'a', name: 'A Co', hits: [], errored: true }], '2026-06-20', 0.85);
check('diffState carries prior state forward for an errored subject', d5.alerts.length === 0 && d5.cleared.length === 0 && !!d5.nextState.subjects.a);

/* sub-threshold hit is not material → no alert */
const d6 = diffState({ updated: null, subjects: {} }, [{ key: 'b', name: 'B Co', hits: [{ hitName: 'b', list: 'X', score: 0.4, hitId: '9' }] }], '2026-06-19', 0.85);
check('diffState ignores a sub-threshold hit', d6.alerts.length === 0 && !d6.nextState.subjects.b);

/* ── rendering ── */
const report = buildScreenReport(d1.alerts, [], '2026-06-19', { screened: 42, degraded: true, errored: 1 });
check('report names the customer, the list and the governance note',
  report.includes('A Co') && report.includes('OFAC SDN') && report.includes('MLRO') && report.includes('four-eyes'));
check('report surfaces a degraded engine and unscreened subjects',
  report.includes('degraded') && report.includes('could not be screened'));
check('report with no alerts says no new matches', buildScreenReport([], [], '2026-06-19', { screened: 5 }).includes('No **new** sanctions/watchlist matches'));

const html = buildScreenHtml(d1.alerts, { runLink: 'https://example/run', today: '2026-06-19', degraded: true });
check('html alert is a single rooted body with the customer + four-eyes note',
  html.startsWith('<body>') && html.endsWith('</body>') && html.includes('A Co') && html.includes(GOVERNANCE_NOTE.slice(0, 20)) && html.includes('degraded'));

const artifact = buildChangesArtifact(d1.alerts, '2026-06-19');
check('changes artifact carries the {date,mode,changes[]} shape with the list',
  artifact.mode === 'screen' && artifact.changes.length === 1 && artifact.changes[0].name.includes('OFAC SDN') && artifact.changes[0].status === 'new');

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
