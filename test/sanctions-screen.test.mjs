/* Unit tests for the Sanctions Screen pure logic (no network).
   Exercises the real /api/screen/batch response shape:
     { name, entityType, topScore (0-100), band, recommendation, hitCount, lists[] }
   Usage: node test/sanctions-screen.test.mjs */
import {
  normalizeName, parseSubject, parseSubjects, parsePrincipals, subjectLabel, normalizeHit, normalizeResult, normalizeScreenResponse,
  isMatch, diffState, matchSummary, buildScreenReport, buildScreenHtml, buildChangesArtifact,
  GOVERNANCE_NOTE, DEFAULT_THRESHOLD,
  formatHumanDate, buildAmPepNotes, buildRunLogNotes, buildTransactionTemplateNotes, AM_KEYWORD_COUNT
} from '../scripts/sanctions-screen.mjs';

let passed = 0, failed = 0;
function check(name, cond) {
  if (cond) { passed++; console.log('  ok  ' + name); }
  else { failed++; console.log('FAIL  ' + name); }
}

/* ── name folding ── */
check('normalizeName folds case, punctuation and diacritics',
  normalizeName('YÜKSEL KIYMETLİ MADENLER TİCARET A.Ş.') === normalizeName('yuksel kiymetli madenler ticaret a s'));

/* ── subject parsing ── */
const task = { gid: '111', name: 'WPM INT LLC', completed: false, notes: 'Jurisdiction : United Arab Emirates\nTrade Licence : DMCC-12345\n' };
const s = parseSubject(task);
check('parseSubject pulls name + jurisdiction + licence + gid',
  s.name === 'WPM INT LLC' && s.jurisdiction === 'United Arab Emirates' && s.idNumber === 'DMCC-12345' && s.gid === '111' && s.entityType === 'organisation');
const subs = parseSubjects([task, { name: 'Done Co', completed: true }, { name: 'WPM Int  LLC', completed: false }, { name: 'Xafari DMCC', completed: false }]);
check('parseSubjects skips completed + dedups by key', subs.length === 2 && subs.map(x => x.name).sort().join('|') === 'WPM INT LLC|Xafari DMCC');

/* ── principal / UBO extraction (so individuals are screened, not just the company) ── */
const cddNotes = [
  'SECTION 1 — CUSTOMER INFORMATION',
  '    Company: AMBER INTERNATIONAL FZCO',
  '    Country: United Arab Emirates',
  'SECTION 4 — IDENTIFICATIONS',
  '    Individual 1 — Shareholder & Director',
  '    Name: Rahul Natvarlal Acharya',
  '    Nationality: India',
  '    Shares %: 50%',
  '    Individual 2 — Shareholder & Director',
  '    Name: Raj Hasmukhbhai Majithia',
  '    Nationality: New Zealand',
  'SECTION 5 — PROLIFERATION FINANCING (PF) ASSESSMENT',
  '    UN PF Sanctions Match: Low — Name: should-not-be-captured (outside section 4)',
].join('\n');
const cddTask = { gid: '777', name: 'Amber International FZCO', completed: false, notes: cddNotes };
const principals = parsePrincipals(cddTask);
check('parsePrincipals extracts every Section-4 individual (name + role + nationality)',
  principals.length === 2 &&
  principals[0].name === 'Rahul Natvarlal Acharya' && /Shareholder/.test(principals[0].role) && principals[0].nationality === 'India' &&
  principals[1].name === 'Raj Hasmukhbhai Majithia' && principals[1].nationality === 'New Zealand');
check('parsePrincipals does NOT capture names outside the identifications section',
  !principals.some(p => /should-not-be-captured/.test(p.name)));
check('parsePrincipals is empty for a record with no identifications section',
  parsePrincipals({ name: 'Co', notes: 'SECTION 1 — CUSTOMER INFORMATION\n    Company: CO' }).length === 0);

const withPpl = parseSubjects([cddTask]);
check('parseSubjects emits the entity PLUS each principal as its own subject',
  withPpl.length === 3 &&
  withPpl[0].entityType === 'organisation' && withPpl[0].name === 'Amber International FZCO' &&
  withPpl.filter(x => x.entityType === 'individual').length === 2);
check('each individual subject carries the parent customer gid + role for the alert',
  withPpl.filter(x => x.entityType === 'individual').every(x => x.gid === '777' && x.parent === 'Amber International FZCO' && x.role && x.jurisdiction));
check('subjectLabel marks an individual with role + parent, entity stays plain',
  subjectLabel(withPpl.find(x => x.entityType === 'individual')).includes('[individual]') &&
  subjectLabel(withPpl[0]) === 'Amber International FZCO');

/* a principal whose name collides with a legal entity (or a same-named principal
   of another customer) must NOT be dropped — every recorded person is screened */
const collide = parseSubjects([
  { gid: 'A', name: 'Ali Hassan', completed: false, notes: '' },                       // entity named like a person
  { gid: 'B', name: 'Beta Trading FZE', completed: false,
    notes: 'SECTION 4 — IDENTIFICATIONS\n    Individual 1 — Director\n    Name: Ali Hassan\n' },  // UBO with the SAME name
  { gid: 'C', name: 'Gamma DMCC', completed: false,
    notes: 'SECTION 4 — IDENTIFICATIONS\n    Individual 1 — Director\n    Name: Ali Hassan\n' },  // another UBO, same name, different customer
]);
const aliSubjects = collide.filter(x => normalizeName(x.name) === normalizeName('Ali Hassan'));
check('name collision never drops a subject: entity + both UBOs all screened (3), keyed distinctly',
  aliSubjects.length === 3 && new Set(collide.map(x => x.key)).size === collide.length &&
  aliSubjects.filter(x => x.entityType === 'individual').length === 2);
check('the same person repeated under the SAME customer is deduped',
  parseSubjects([{ gid: 'D', name: 'Delta', completed: false,
    notes: 'SECTION 4 — IDENTIFICATIONS\n    Individual 1 — Director\n    Name: Sam Lee\n    Individual 2 — Shareholder\n    Name: Sam Lee\n' }])
    .filter(x => x.entityType === 'individual').length === 1);

/* ── hit/list entry normalisation (string OR object) ── */
check('normalizeHit handles a plain string list name', normalizeHit('OFAC SDN').list === 'OFAC SDN');
check('normalizeHit maps an object entry', (() => { const h = normalizeHit({ list: 'EU FSF', matchScore: 96, hitName: 'ACME' }); return h.list === 'EU FSF' && h.score === 96 && h.hitName === 'ACME'; })());

/* ── result normalisation (real engine shape) ── */
const kim = { name: 'Kim Jong Un', entityType: 'individual', topScore: 100, band: 'critical', hitCount: 0, recommendation: 'match', lists: [] };
const subjects = [{ key: normalizeName('Kim Jong Un'), name: 'Kim Jong Un', jurisdiction: 'KP', gid: '9' }];
const nr = normalizeResult(kim, subjects[0]);
check('normalizeResult maps band/score/recommendation and keeps subject jurisdiction',
  nr.band === 'critical' && nr.topScore === 100 && nr.recommendation === 'match' && nr.jurisdiction === 'KP' && nr.gid === '9');
const resp = normalizeScreenResponse({ results: [kim], count: 1 }, subjects);
check('normalizeScreenResponse reads {results:[…]} and re-keys to the subject', resp.results.length === 1 && resp.results[0].jurisdiction === 'KP');
check('normalizeScreenResponse propagates degraded', normalizeScreenResponse({ degraded: true, results: [] }).degraded === true);

/* ── materiality: trust the engine's recommendation, fall back to band/score/lists ── */
check('isMatch true on a "match" recommendation', isMatch(normalizeResult(kim)) === true);
check('isMatch false on a "clear" recommendation with no hits',
  isMatch(normalizeResult({ name: 'Trafigura PTE LTD', topScore: 12, band: 'low', recommendation: 'clear', lists: [] })) === false);
check('isMatch overrides a "clear" recommendation when there IS a list hit',
  isMatch(normalizeResult({ name: 'X', recommendation: 'clear', band: 'low', lists: ['OFAC SDN'] })) === true);
check('isMatch true on a high band with no recommendation',
  isMatch(normalizeResult({ name: 'Y', band: 'high', lists: [] })) === true);
check('isMatch true when score clears the threshold (0-100 vs 0.85)',
  isMatch(normalizeResult({ name: 'Z', topScore: 90, lists: [] })) === true);
check('isMatch false on a clean low-score subject',
  isMatch(normalizeResult({ name: 'Q', topScore: 30, band: 'low', recommendation: '', lists: [] })) === false);
check('DEFAULT_THRESHOLD is 0.85', DEFAULT_THRESHOLD === 0.85);

/* ── diff / state machine ── */
const listed = normalizeResult({ name: 'A Co', topScore: 96, band: 'high', hitCount: 1, recommendation: 'match', lists: [{ list: 'OFAC SDN', matchScore: 96 }] }, { key: 'a', name: 'A Co', jurisdiction: 'AE', gid: '1' });
const d1 = diffState({ updated: null, subjects: {} }, [listed], '2026-06-19', 0.85);
check('diffState flags a brand-new match', d1.alerts.length === 1 && d1.alerts[0].isNew === true && d1.alerts[0].name === 'A Co');
check('diffState records the match with firstSeen + signature', d1.nextState.subjects.a && d1.nextState.subjects.a.firstSeen === '2026-06-19' && !!d1.nextState.subjects.a.signature);

const d2 = diffState(d1.nextState, [listed], '2026-06-20', 0.85);
check('diffState does NOT re-alert a standing (same-signature) match', d2.alerts.length === 0);
check('diffState preserves original firstSeen on a standing match', d2.nextState.subjects.a.firstSeen === '2026-06-19');

const escalated = normalizeResult({ name: 'A Co', topScore: 98, band: 'critical', recommendation: 'match', lists: [{ list: 'OFAC SDN' }, { list: 'EU FSF' }] }, { key: 'a', name: 'A Co' });
const d3 = diffState(d1.nextState, [escalated], '2026-06-20', 0.85);
check('diffState RE-alerts when the match changes (new list / escalated band)', d3.alerts.length === 1);

const cleanA = normalizeResult({ name: 'A Co', topScore: 10, band: 'low', recommendation: 'clear', lists: [] }, { key: 'a', name: 'A Co' });
const d4 = diffState(d1.nextState, [cleanA], '2026-06-21', 0.85);
check('diffState clears a subject that is no longer a match', d4.alerts.length === 0 && d4.cleared.length === 1 && !d4.nextState.subjects.a);

const d5 = diffState(d1.nextState, [{ key: 'a', name: 'A Co', errored: true }], '2026-06-20', 0.85);
check('diffState carries prior state forward for an errored subject (never false-clear)', d5.alerts.length === 0 && d5.cleared.length === 0 && !!d5.nextState.subjects.a);

/* ── rendering ── */
check('matchSummary names band, score and lists', matchSummary(d1.alerts[0]).includes('HIGH') && matchSummary(d1.alerts[0]).includes('OFAC SDN'));
const report = buildScreenReport(d1.alerts, [], '2026-06-19', { screened: 42, degraded: true, errored: 1 });
check('report names the customer, the match and the governance note',
  report.includes('A Co') && report.includes('OFAC SDN') && report.includes('MLRO') && report.includes('four-eyes'));
check('report surfaces a degraded engine and unscreened subjects',
  report.includes('degraded') && report.includes('could not be screened'));
check('report with no alerts says no new matches', buildScreenReport([], [], '2026-06-19', { screened: 5 }).includes('No **new** sanctions/watchlist matches'));

const html = buildScreenHtml(d1.alerts, { runLink: 'https://example/run', today: '2026-06-19', degraded: true });
check('html alert is one rooted body with the customer + four-eyes note',
  html.startsWith('<body>') && html.endsWith('</body>') && html.includes('A Co') && html.includes(GOVERNANCE_NOTE.slice(0, 20)) && html.includes('degraded'));

const artifact = buildChangesArtifact(d1.alerts, '2026-06-19');
check('changes artifact carries {date,mode,changes[]} with the matched list',
  artifact.mode === 'screen' && artifact.changes.length === 1 && artifact.changes[0].status === 'new' && artifact.changes[0].lists.includes('OFAC SDN'));

/* ── Ongoing Monitoring — audit-trail note builders ── */
check('formatHumanDate renders ISO as "DD Mon YYYY"', formatHumanDate('2026-06-24') === '24 Jun 2026');
check('formatHumanDate is tolerant of junk', formatHumanDate('') === '' && formatHumanDate('2026-12-01') === '1 Dec 2026');

const amClear = buildAmPepNotes({ today: '2026-06-24', tomorrow: '2026-06-25', run: 'https://example/run', subjects: 325 });
check('AM/PEP CLEAR note shows the clear status and NONE results',
  amClear.includes('STATUS: ✅ CLEAR') && amClear.includes('New adverse media hits:       NONE') && amClear.includes('Subjects checked:             325'));
check('AM/PEP CLEAR note names the keyword count and next run',
  amClear.includes(AM_KEYWORD_COUNT + ' keywords') && amClear.includes('Next run: 2026-06-25'));

const amResults = [
  { key: 'a', name: 'Acme DMCC', lists: [{ list: 'Adverse media (Google News)', hitName: 'Acme probed for fraud [fraud]', score: 80 }] },
  { key: 'b', name: 'Beta FZE', lists: [{ list: 'PEP (Wikidata)', hitName: 'Jane Beta — minister', score: 90 }] }
];
const amHit = buildAmPepNotes({ today: '2026-06-24', tomorrow: '2026-06-25', subjects: 325,
  amHits: amResults.filter(r => r.lists.some(h => h.list.includes('Adverse media'))),
  pepHits: amResults.filter(r => r.lists.some(h => h.list.includes('PEP'))),
  regUrl: 'https://app.asana.com/0/1/2' });
check('AM/PEP HIT note flags review, counts hits and lists each subject',
  amHit.includes('STATUS: ⚠ REVIEW REQUIRED') && amHit.includes('New adverse media hits:       1') &&
  amHit.includes('New PEP identifications:      1') && amHit.includes('Acme DMCC') && amHit.includes('Beta FZE'));
check('AM/PEP HIT note links the Regulations alert when provided',
  amHit.includes('https://app.asana.com/0/1/2'));

const log = buildRunLogNotes({ today: '2026-06-24', run: 'https://example/run', subjects: 325,
  coverage: { fetched: 5, total: 6 }, degraded: true, errored: 0, cfg: { adverseMedia: true, pep: false },
  amErrors: 2, pepErrors: 0, alerts: 0, matchCount: 3, asanaPosted: false, amPep: { posted: true, url: 'https://t/1' } });
check('run log note reports subjects, coverage and exit status',
  log.includes('Subjects screened:            325') && log.includes('Sanctions lists loaded:       5/6') &&
  log.includes('Coverage degraded:            YES') && log.includes('Exit status:                  ✅ CLEAN'));
check('run log note reflects module on/off, errors and the AM/PEP link',
  log.includes('Adverse media module:         ON — 2 errors') && log.includes('PEP module:                   OFF — 0 errors') &&
  log.includes('AM/PEP task posted:           YES — https://t/1'));
const logMatch = buildRunLogNotes({ today: '2026-06-24', subjects: 10, coverage: {}, alerts: 2, matchCount: 2, cfg: {} });
check('run log note marks ⚠ MATCHES when there are alerts', logMatch.includes('Exit status:                  ⚠ MATCHES'));

const tmpl = buildTransactionTemplateNotes();
check('TM template carries the legal basis, all sections and the copy banner',
  tmpl.includes('MoET Circular 08/AML/2021') && tmpl.includes('A. ALERT IDENTIFICATION') &&
  tmpl.includes('F. DISPOSITION') && tmpl.includes('[TEMPLATE — copy for each alert]'));

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
