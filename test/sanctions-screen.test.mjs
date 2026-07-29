/* Unit tests for the Sanctions Screen pure logic (no network).
   Exercises the real /api/screen/batch response shape:
     { name, entityType, topScore (0-100), band, recommendation, hitCount, lists[] }
   Usage: node test/sanctions-screen.test.mjs */
import {
  normalizeName, parseSubject, parseSubjects, parsePrincipals, subjectLabel, normalizeHit, normalizeResult, normalizeScreenResponse,
  isMatch, diffState, matchSummary, buildScreenReport, buildScreenHtml, buildChangesArtifact,
  GOVERNANCE_NOTE, DEFAULT_THRESHOLD, resolveThreshold, resolveShadowThreshold, shadowBandRow, foldAliasSources,
  formatHumanDate, buildAmPepNotes, AM_KEYWORD_COUNT, belowFloor
} from '../scripts/sanctions-screen.mjs';
import { buildIndex, screenName } from '../scripts/sanctions-match.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

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

/* Two DISTINCT active customers sharing a legal name: the duplicate entity row
   is deduped, but the second customer's principals must STILL be screened (they
   were previously dropped by the early `continue`). */
const dupA = { gid: 'A', name: 'Acme LLC', completed: false,
  notes: 'SECTION 4 — IDENTIFICATIONS\n    Individual 1 — Director\n    Name: Alpha Person\n    Nationality: India' };
const dupB = { gid: 'B', name: 'Acme LLC', completed: false,
  notes: 'SECTION 4 — IDENTIFICATIONS\n    Individual 1 — Director\n    Name: Bravo Person\n    Nationality: UAE' };
const dupSubs = parseSubjects([dupA, dupB]);
check('duplicate-named customers: entity deduped but BOTH customers’ principals are screened',
  dupSubs.filter(x => x.entityType === 'organisation').length === 1 &&
  dupSubs.some(x => x.name === 'Alpha Person') && dupSubs.some(x => x.name === 'Bravo Person'));

/* Empty-normalization customers (symbols-only / unscreenable records) used to
   COLLIDE on the shared key '': the second was deduped away before screening
   and never even reached MANUAL REVIEW. Each now gets a distinct raw-string
   key; only a true duplicate of the SAME raw name dedupes. */
const symbolSubs = parseSubjects([
  { gid: 'S1', name: '☠☠', completed: false, notes: '' },
  { gid: 'S2', name: '♛♛♛', completed: false, notes: '' },
  { gid: 'S3', name: '☠☠', completed: false, notes: '' },   // true duplicate name → deduped
]);
check('two distinct symbol-only customers BOTH survive parsing with distinct stable keys',
  symbolSubs.length === 2 && new Set(symbolSubs.map(x => x.key)).size === 2
  && symbolSubs.every(x => x.key && x.key.startsWith('raw:')));
const symbolIdx = buildIndex([{ id: 'o', name: 'OFAC SDN', names: ['SOME ENTITY LLC'] }]);
check('both symbol-only customers produce MANUAL REVIEW rows (neither silently dropped)',
  symbolSubs.every(x => {
    const r = normalizeResult(screenName(x.name, symbolIdx, 85), x);
    return r.key === x.key && r.recommendation === 'review' && r.lists[0].list === 'MANUAL REVIEW';
  }));

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

/* A standing PEP/adverse-media (enrichment-only) match must NOT be cleared on a
   run whose enrichment lookup errored/was budget-skipped — it wasn't re-verified. */
const pepListed = normalizeResult({ name: 'P Co', topScore: 80, band: 'high', recommendation: 'review', lists: [{ list: 'PEP (Wikidata)', matchScore: 80 }] }, { key: 'p', name: 'P Co' });
const p1 = diffState({ updated: null, subjects: {} }, [pepListed], '2026-06-19', 0.85);
const pIncomplete = normalizeResult({ name: 'P Co', topScore: 0, band: 'low', recommendation: 'clear', lists: [] }, { key: 'p', name: 'P Co' });
pIncomplete.enrichmentIncomplete = true;
const p2 = diffState(p1.nextState, [pIncomplete], '2026-06-20', 0.85);
check('enrichment-only match is carried forward (not cleared) when the lookup could not be re-verified',
  p2.cleared.length === 0 && !!p2.nextState.subjects.p && p2.nextState.subjects.p.firstSeen === '2026-06-19');
/* …but once enrichment completes and genuinely clears, it IS cleared. */
const pClear = normalizeResult({ name: 'P Co', topScore: 0, band: 'low', recommendation: 'clear', lists: [] }, { key: 'p', name: 'P Co' });
const p3 = diffState(p1.nextState, [pClear], '2026-06-21', 0.85);
check('enrichment-only match clears normally once the lookup succeeds and returns no hit',
  p3.cleared.length === 1 && !p3.nextState.subjects.p);
/* A prior SANCTIONS hit still clears on genuine de-listing even if enrichment was incomplete. */
const sIncomplete = normalizeResult({ name: 'A Co', topScore: 0, band: 'low', recommendation: 'clear', lists: [] }, { key: 'a', name: 'A Co' });
sIncomplete.enrichmentIncomplete = true;
const d6 = diffState(d1.nextState, [sIncomplete], '2026-06-22', 0.85);
check('a prior sanctions hit (re-checked locally) still clears on de-listing despite incomplete enrichment',
  d6.cleared.length === 1 && !d6.nextState.subjects.a);

/* Degrade-loudly: a standing SANCTIONS match must NOT be auto-cleared when the
   list that produced it failed to load this run (coverage artefact, not a
   de-listing). */
const twoList = normalizeResult({ name: 'B Co', topScore: 95, band: 'high', recommendation: 'match',
  lists: [{ list: 'UK OFSI' }, { list: 'EU FSF' }] }, { key: 'b', name: 'B Co' });
const b1 = diffState({ updated: null, subjects: {} }, [twoList], '2026-06-19', 0.85, ['OFAC SDN', 'UK OFSI', 'EU FSF']);
const bClean = normalizeResult({ name: 'B Co', topScore: 0, band: 'low', recommendation: 'clear', lists: [] }, { key: 'b', name: 'B Co' });
// This run only OFAC loaded (UK OFSI + EU FSF failed) → subject no longer matches, but we did not re-verify it.
const bDegraded = diffState(b1.nextState, [bClean], '2026-06-20', 0.85, ['OFAC SDN']);
check('a standing sanctions match is carried forward when its originating list failed to load',
  bDegraded.cleared.length === 0 && !!bDegraded.nextState.subjects.b);
// Control: when every originating list DID load and the subject is clean, it clears normally.
const bFull = diffState(b1.nextState, [bClean], '2026-06-21', 0.85, ['OFAC SDN', 'UK OFSI', 'EU FSF']);
check('a standing sanctions match clears on de-listing when all its lists were screened',
  bFull.cleared.length === 1 && !bFull.nextState.subjects.b);

/* Every carry-forward must read as STILL ACTIVE (lastSeen = today): the case
   planner (screening-cases.mjs planCaseActions) auto-clears + completes the
   Asana case of any registry subject whose lastSeen is stale — with a false
   "not flagged" audit comment — and a cleared case never re-opens. */
check('carry-forward on a failed originating list marks the subject still-active (lastSeen bumped)',
  bDegraded.nextState.subjects.b.lastSeen === '2026-06-20');
check('carry-forward on incomplete enrichment marks the subject still-active (lastSeen bumped)',
  p2.nextState.subjects.p.lastSeen === '2026-06-20');
check('carry-forward on an errored subject marks it still-active with firstSeen intact',
  d5.nextState.subjects.a.lastSeen === '2026-06-20' && d5.nextState.subjects.a.firstSeen === '2026-06-19');

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
  newMatchKeys: ['a'],
  regUrl: 'https://app.asana.com/0/1/2' });
check('AM/PEP HIT note flags review, counts hits and lists each subject',
  amHit.includes('STATUS: ⚠ REVIEW REQUIRED') && amHit.includes('Adverse media hits:           1 (1 new, 0 standing)') &&
  amHit.includes('PEP identifications:          1 (0 new, 1 standing)') && amHit.includes('Acme DMCC') && amHit.includes('Beta FZE'));
check('AM/PEP HIT note tags each hit NEW or STANDING at subject level',
  /Acme DMCC.*\| NEW/.test(amHit) && /Beta FZE.*\| STANDING \(previously reported\)/.test(amHit));
check('AM/PEP HIT note links the Regulations alert when provided',
  amHit.includes('https://app.asana.com/0/1/2') && amHit.includes('see alert card in Regulations project'));
const amHitNoReg = buildAmPepNotes({ today: '2026-06-24', tomorrow: '2026-06-25', subjects: 325,
  amHits: amResults.slice(0, 1), pepHits: [] });
check('AM/PEP HIT note without a posted alert card claims neither the card nor a link',
  amHitNoReg.includes('STATUS: ⚠ REVIEW REQUIRED') && !amHitNoReg.includes('Regulations'));
check('AM/PEP HIT note without diff info counts hits without claiming they are new',
  !amHitNoReg.includes('New adverse media hits') && amHitNoReg.includes('Adverse media hits:           1') && !amHitNoReg.includes('| NEW'));

/* ── threshold clamp (regression: SCREEN_MATCH_THRESHOLD=85 — screen.py's
   0-100 convention — became an effective cutoff of 8500 and silently cleared
   every fuzzy match; out-of-range values must fall back loudly) ── */
check('resolveThreshold accepts a valid MORE-SENSITIVE fraction', resolveThreshold(0.5) === 0.5 && resolveThreshold('0.8') === 0.8 && resolveThreshold(String(DEFAULT_THRESHOLD)) === DEFAULT_THRESHOLD);
check('resolveThreshold defaults when unset/blank', resolveThreshold(undefined) === DEFAULT_THRESHOLD && resolveThreshold('') === DEFAULT_THRESHOLD);
check('resolveThreshold rejects the 0-100 scale (85 → default, never 8500)', resolveThreshold('85') === DEFAULT_THRESHOLD);
check('resolveThreshold rejects zero, negatives and garbage', resolveThreshold('0') === DEFAULT_THRESHOLD && resolveThreshold('-1') === DEFAULT_THRESHOLD && resolveThreshold('abc') === DEFAULT_THRESHOLD);
/* ONE-WAY rule (champion/challenger): raising above the champion default needs
   the explicit override flag — a bare raise is rejected loudly to the default. */
{
  const orig = process.env.SCREEN_MATCH_THRESHOLD_ALLOW_RAISE;
  delete process.env.SCREEN_MATCH_THRESHOLD_ALLOW_RAISE;
  check('resolveThreshold rejects a bare raise above the champion default (one-way rule)',
    resolveThreshold('0.9') === DEFAULT_THRESHOLD && resolveThreshold('0.95') === DEFAULT_THRESHOLD);
  process.env.SCREEN_MATCH_THRESHOLD_ALLOW_RAISE = '1';
  check('resolveThreshold accepts a raise only with SCREEN_MATCH_THRESHOLD_ALLOW_RAISE=1',
    resolveThreshold('0.9') === 0.9);
  if (orig === undefined) delete process.env.SCREEN_MATCH_THRESHOLD_ALLOW_RAISE;
  else process.env.SCREEN_MATCH_THRESHOLD_ALLOW_RAISE = orig;
}
/* Shadow challenger resolver + band row: log-only evidence, never an alert. */
check('resolveShadowThreshold off when unset; validates the (0, threshold) range',
  resolveShadowThreshold(undefined, 0.85) === null
  && resolveShadowThreshold('0.80', 0.85) === 0.80
  && resolveShadowThreshold('0.85', 0.85) === null
  && resolveShadowThreshold('0.9', 0.85) === null
  && resolveShadowThreshold('80', 0.85) === null
  && resolveShadowThreshold('abc', 0.85) === null);
check('shadowBandRow captures a clear result inside the band and nothing else',
  shadowBandRow({ name: 'X', recommendation: 'clear', topScore: 82 }, 0.80, 0.85) !== null
  && shadowBandRow({ name: 'X', recommendation: 'clear', topScore: 79 }, 0.80, 0.85) === null
  && shadowBandRow({ name: 'X', recommendation: 'clear', topScore: 86 }, 0.80, 0.85) === null
  && shadowBandRow({ name: 'X', recommendation: 'sanctions-match', topScore: 82 }, 0.80, 0.85) === null
  && shadowBandRow({ name: 'X', recommendation: 'clear', topScore: 82 }, null, 0.85) === null);

/* ── OFAC alias fold (regression: sdn.csv carries only primary names; the aka
   file alt.csv was never fetched, so every SDN alias was unscreened) ── */
check('foldAliasSources merges alias names into the primary list under ITS name', (() => {
  const lists = [{ id: 'ofac-sdn', name: 'OFAC SDN', names: ['A CO'] }, { id: 'ofac-sdn-alt', name: 'OFAC aka', names: ['B CO', 'A CO'] }];
  const r = foldAliasSources(lists, [{ id: 'ofac-sdn-alt', name: 'OFAC aka', mergeInto: 'ofac-sdn' }]);
  return lists.length === 1 && lists[0].name === 'OFAC SDN' && lists[0].names.join('|') === 'A CO|B CO'
    && r.folded.length === 1 && r.notes.length === 0 && !lists[0].partial;
})());
check('foldAliasSources marks the primary PARTIAL when the alias file failed (alias coverage missing, noted)', (() => {
  const lists = [{ id: 'ofac-sdn', name: 'OFAC SDN', names: ['A CO'] }];
  const r = foldAliasSources(lists, [{ id: 'ofac-sdn-alt', name: 'OFAC aka', mergeInto: 'ofac-sdn' }]);
  return lists[0].partial === true && r.notes.length === 1 && /alias coverage degraded/.test(r.notes[0]);
})());
check('foldAliasSources never screens aliases ALONE when the primary list failed', (() => {
  const lists = [{ id: 'ofac-sdn-alt', name: 'OFAC aka', names: ['B CO'] }];
  const r = foldAliasSources(lists, [{ id: 'ofac-sdn-alt', name: 'OFAC aka', mergeInto: 'ofac-sdn' }]);
  return lists.length === 0 && r.notes.length === 1 && /NOT screened alone/.test(r.notes[0]);
})());
check('the shipped sources config wires alt.csv into the primary SDN list', (() => {
  const cfg = JSON.parse(readFileSync(join(ROOT, 'data/sanctions-sources.json'), 'utf8'));
  const alt = (cfg.sources || []).find(s => s.id === 'ofac-sdn-alt');
  return !!alt && alt.parser === 'ofacalt' && alt.mergeInto === 'ofac-sdn' && /alt\.csv/.test(alt.url);
})());

/* ── MANUAL REVIEW flow through the diff (screen.py parity: an unscreenable
   subject is a reviewable finding, never a clear — and never a permanently
   stuck one: the marker clears once the subject screens cleanly) ── */
const mrRow = normalizeResult({ name: 'Yu Li', topScore: 0, band: 'medium', recommendation: 'review',
  lists: [{ list: 'MANUAL REVIEW', score: 0 }] }, { key: 'y', name: 'Yu Li' });
check('a MANUAL REVIEW row is material (isMatch) — surfaced, not cleared', isMatch(mrRow) === true);
const mr1 = diffState({ updated: null, subjects: {} }, [mrRow], '2026-07-25', 0.85, ['OFAC SDN']);
check('MANUAL REVIEW alerts once and is recorded standing', mr1.alerts.length === 1 && mr1.nextState.subjects.y.lists.join() === 'MANUAL REVIEW');
check('a standing MANUAL REVIEW is not re-alerted daily', diffState(mr1.nextState, [mrRow], '2026-07-26', 0.85, ['OFAC SDN']).alerts.length === 0);
const mrClean = normalizeResult({ name: 'Yu Li', topScore: 10, band: 'low', recommendation: 'clear', lists: [] }, { key: 'y', name: 'Yu Li' });
const mr2 = diffState(mr1.nextState, [mrClean], '2026-07-27', 0.85, ['OFAC SDN']);
check('MANUAL REVIEW clears once the subject screens cleanly (a local marker is no "unloaded list")',
  mr2.cleared.length === 1 && !mr2.nextState.subjects.y);

/* ── enrichment evidence carried through a lookup failure (regression: a
   sanctions+PEP standing match whose PEP lookup errored lost the PEP evidence
   from state AND fired a spurious "changed match" alert) ── */
const mixedPrior = normalizeResult({ name: 'M Co', topScore: 96, band: 'high', recommendation: 'sanctions-match',
  lists: [{ list: 'OFAC SDN', matchScore: 96 }, { list: 'PEP (Wikidata)', matchScore: 80 }] }, { key: 'm', name: 'M Co' });
const mx1 = diffState({ updated: null, subjects: {} }, [mixedPrior], '2026-07-25', 0.85, ['OFAC SDN']);
const sanctionsOnly = normalizeResult({ name: 'M Co', topScore: 96, band: 'high', recommendation: 'sanctions-match',
  lists: [{ list: 'OFAC SDN', matchScore: 96 }] }, { key: 'm', name: 'M Co' });
sanctionsOnly.enrichmentIncomplete = true;
const mx2 = diffState(mx1.nextState, [sanctionsOnly], '2026-07-26', 0.85, ['OFAC SDN']);
check('an errored enrichment lookup neither drops the PEP evidence nor fires a spurious changed-alert',
  mx2.alerts.length === 0 && mx2.nextState.subjects.m.lists.sort().join() === 'OFAC SDN,PEP (Wikidata)');
const sanctionsOnlyOk = normalizeResult({ name: 'M Co', topScore: 96, band: 'high', recommendation: 'sanctions-match',
  lists: [{ list: 'OFAC SDN', matchScore: 96 }] }, { key: 'm', name: 'M Co' });
const mx3 = diffState(mx1.nextState, [sanctionsOnlyOk], '2026-07-26', 0.85, ['OFAC SDN']);
check('once enrichment completes and the PEP hit is gone, the record updates (one changed-alert)',
  mx3.alerts.length === 1 && mx3.nextState.subjects.m.lists.join() === 'OFAC SDN');

/* ── "not re-checked" must never read as "checked and clear" ──────────────────
   Three routes to the same false negative, all of which ended in the record
   being DELETED and its MLRO case auto-completed with the comment "not flagged
   by the … screening run" — a false statement in a ten-year audit trail, and a
   completed case never re-opens. */
const ALL_SIGNALS = ['Adverse media (Google News)', 'PEP (Wikidata)', 'Interpol Red Notice'];
const mixedStanding = () => ({ updated: null, subjects: { m: {
  name: 'M Co', band: 'high', topScore: 96, recommendation: 'sanctions-match',
  lists: ['OFAC SDN', 'PEP (Wikidata)'], signature: 's', firstSeen: '2026-07-01', lastSeen: '2026-07-25' } } });
const clearRow = (extra = {}) => Object.assign(normalizeResult(
  { name: 'M Co', topScore: 0, band: 'low', recommendation: 'clear', lists: [] },
  { key: 'm', name: 'M Co' }), extra);

// 1. MIXED prior whose SANCTIONS half genuinely clears while enrichment was
//    budget-skipped. The old guard required prior.lists.EVERY(enrichment), so a
//    mixed prior fell through it and the unverified PEP evidence was deleted.
const un1 = diffState(mixedStanding(), [clearRow({ enrichmentIncomplete: true })],
  '2026-07-26', 0.85, ['OFAC SDN'], ALL_SIGNALS);
check('a MIXED standing match is not wiped when enrichment could not be re-verified',
  un1.cleared.length === 0 && !!un1.nextState.subjects.m
  && un1.nextState.subjects.m.lists.includes('PEP (Wikidata)'));

// 2. The enrichment MODULE was switched off (SCREEN_PEP=0 — the knob most
//    likely to be reached for DURING a Wikidata outage). No lookup runs, so no
//    per-subject flag is set and the row is indistinguishable from a verified
//    clear: every PEP-derived match in the book cleared at once.
const un2 = diffState(mixedStanding(), [clearRow({ enrichmentIncomplete: false })],
  '2026-07-26', 0.85, ['OFAC SDN'], ['Adverse media (Google News)']);   // PEP not evaluated
check('a standing match is not cleared by a signal whose MODULE did not run',
  un2.cleared.length === 0 && !!un2.nextState.subjects.m);

// 3. The subject left the fetched population entirely (task completed, renamed,
//    deleted, or a project GID narrowed). diffState only iterates `results`, so
//    the subject kept a stale lastSeen that the case planner reads as
//    "no longer flagged" and auto-completes on.
const un3 = diffState(mixedStanding(), [], '2026-07-26', 0.85, ['OFAC SDN'], ALL_SIGNALS);
check('a subject that left the population is HELD, not cleared',
  un3.cleared.length === 0 && !!un3.nextState.subjects.m);
check('its case is kept open (lastSeen bumped) and the reason recorded',
  un3.nextState.subjects.m.lastSeen === '2026-07-26'
  && un3.nextState.subjects.m.notScreenedOn === '2026-07-26');
check('the population change is surfaced to the caller, not silently absorbed',
  un3.notScreened.length === 1 && un3.notScreened[0].key === 'm'
  && un3.notScreened[0].lastScreened === '2026-07-25');

// CONTROL — the guards must not freeze state forever: a genuine de-listing,
// fully re-screened with every signal evaluated, must STILL clear.
const un4 = diffState(mixedStanding(), [clearRow({ enrichmentIncomplete: false })],
  '2026-07-26', 0.85, ['OFAC SDN'], ALL_SIGNALS);
check('a genuine de-listing still clears when everything WAS re-verified',
  un4.cleared.length === 1 && !un4.nextState.subjects.m);
// Back-compat: callers that pass no evaluatedSignals (external engine path,
// older tests) keep the previous behaviour — the guard is inactive, not fatal.
const un5 = diffState(mixedStanding(), [clearRow({ enrichmentIncomplete: false })],
  '2026-07-26', 0.85, ['OFAC SDN']);
check('omitting evaluatedSignals leaves behaviour unchanged (guard inactive)',
  un5.cleared.length === 1);

/* ── wiring pins: red unscreened bail + retry/liveness contract ── */
const screenSrc = readFileSync(join(ROOT, 'scripts/sanctions-screen.mjs'), 'utf8');
const screenYml = readFileSync(join(ROOT, '.github/workflows/sanctions-screen.yml'), 'utf8');
const retryYml = readFileSync(join(ROOT, '.github/workflows/control-retry.yml'), 'utf8');
const bailBlock = screenSrc.match(/function bailUnscreened[\s\S]*?\n\}/);
check('bailUnscreened turns the run RED via process.exitCode (green bail suppressed control-retry + freshness)',
  !!bailBlock && /process\.exitCode = 1/.test(bailBlock[0]) && !/process\.exit\(/.test(bailBlock[0]));
check('the issue step is always()-guarded so it still fires after the red bail',
  /if: always\(\) && \(steps\.screen\.outputs\.screen_error == 'true'/.test(screenYml));
check('control-retry heals on missing SUCCESS (a red bail is now re-dispatched)',
  /conclusion.*success/.test(retryYml) && /sanctions-screen\.yml/.test(retryYml));

/* ── contract pin: the Asana credential is checked where Asana is CALLED, not
   at import. screen.py used to read ASANA_TOKEN with an unguarded
   os.environ[...] at module load, so every consumer that only wanted the
   matcher had to inject a placeholder credential (this workflow, the fuzz and
   benchmark CI steps, and the daily-screen runner all did). It now accepts
   either env name, resolves to '' when neither is set, and refuses the call
   inside asana_request() — so a matcher-only consumer holds NO credential, and
   an unauthenticated Asana call is still impossible. Both halves are pinned:
   drop the guard and an unauthenticated read would parse as zero customers and
   file as an all-clear. ── */
const screenPy = readFileSync(join(ROOT, 'screen.py'), 'utf8');
check('screen.py accepts either ASANA_ACCESS_TOKEN or ASANA_TOKEN and does not KeyError at import',
  /ASANA_TOKEN\s*=\s*os\.environ\.get\("ASANA_TOKEN"\)\s*or\s*os\.environ\.get\("ASANA_ACCESS_TOKEN"\)\s*or\s*""/.test(screenPy)
  /* the subscript READ is what raised KeyError; the write-back that normalises
     the resolved value onto one name is deliberate and must stay allowed */
  && !/=\s*os\.environ\["ASANA_TOKEN"\]/.test(screenPy));
const asanaReq = screenPy.match(/def asana_request\([\s\S]*?\n    kw\.setdefault\("headers"/);
check('asana_request refuses to call Asana without a credential (the check the import used to do)',
  !!asanaReq && /if not ASANA_TOKEN:/.test(asanaReq[0]) && /raise SystemExit/.test(asanaReq[0]));
const eocnYml = readFileSync(join(ROOT, '.github/workflows/eocn-reconcile.yml'), 'utf8');
const reconcileStep = eocnYml.match(/- name: Reconcile the local list[\s\S]*?(?=\n {6}- name: )/);
check('the matcher-only eocn-reconcile step now holds no Asana credential at all',
  !!reconcileStep && !/ASANA_TOKEN:/.test(reconcileStep[0]));

/* ── Per-source coverage floors (minNames) ────────────────────────────────────
   A list parsing far below its known size is the 0-names false-negative class
   (truncated download / parser drift), not a mass de-listing. The engine marks
   it partial + degraded; these pin the classifier and that the registries
   actually carry floors — a floor that exists but is configured nowhere is the
   multi-homing bug class again. */
check('belowFloor: under the floor classifies as truncated',
  belowFloor({ minNames: 9000 }, Array.from({ length: 50 }, (_, i) => 'N' + i)));
check('belowFloor: at/above the floor passes',
  !belowFloor({ minNames: 3 }, ['A', 'B', 'C']));
check('belowFloor: a source with no floor never classifies (alias files, curated extras)',
  !belowFloor({}, []) && !belowFloor(null, null));
const srcReg = JSON.parse(readFileSync(join(ROOT, 'data/sanctions-sources.json'), 'utf8')).sources;
const extraReg = JSON.parse(readFileSync(join(ROOT, 'data/sanctions-extra.json'), 'utf8')).sources;
for (const s of srcReg.filter(s => !s.mergeInto)) {
  check(`sources registry: ${s.id} carries a coverage floor`, Number(s.minNames) > 0);
}
for (const s of extraReg.filter(s => s.enabled !== false && !s.optional)) {
  check(`extra registry: enabled non-optional ${s.id} carries a coverage floor`, Number(s.minNames) > 0);
}
check('the optional internal watchlist carries NO floor (empty is a valid state)',
  !extraReg.find(s => s.id === 'internal-watchlist').minNames);

/* ── A truncated ALIAS file must not read as full coverage ────────────────────
   Alias sources were exempted from floors on the theory that the fold's
   `partial` machinery covered them. It does not: that machinery only fires when
   the alias file is TOTALLY ABSENT. A truncated-but-nonzero alt.csv (partial
   body, or an OFAC column shift) folded into the primary as if complete — and
   because alias hits are recorded under the PRIMARY list's name, an
   alias-derived standing match then cleared as though re-verified, with its
   MLRO case auto-completed. Two halves, both needed. */
const aliasSrc = srcReg.find(s => s.id === 'ofac-sdn-alt');
check('the alias file carries its own coverage floor', Number(aliasSrc.minNames) > 0);
check('a truncated alias parse is below that floor',
  belowFloor(aliasSrc, Array.from({ length: 800 }, (_, i) => 'A' + i)));
check('a healthy alias parse is not',
  !belowFloor(aliasSrc, Array.from({ length: 17000 }, (_, i) => 'A' + i)));
// The fold splices the alias row out, so a `partial` flag on it must be
// PROPAGATED onto the primary or it vanishes silently.
const _fl = [{ id: 'ofac-sdn', name: 'US OFAC — SDN list (CSV)', names: ['REAL PRIMARY'] },
             { id: 'ofac-sdn-alt', name: 'US OFAC — SDN a.k.a. list (alt.csv)', names: ['ONE ALIAS'], partial: true }];
const _fold = foldAliasSources(_fl, srcReg);
check('reduced alias coverage marks the PRIMARY partial (it survives the fold)',
  _fl[0].partial === true);
check('and says so, so the report is not silently narrower',
  _fold.notes.some(n => /INCOMPLETE a\.k\.a\./.test(n)));
// A fully-loaded alias must NOT mark the primary partial, or every run degrades.
const _fl2 = [{ id: 'ofac-sdn', name: 'US OFAC — SDN list (CSV)', names: ['REAL PRIMARY'] },
              { id: 'ofac-sdn-alt', name: 'US OFAC — SDN a.k.a. list (alt.csv)', names: ['ALIAS ONE'] }];
foldAliasSources(_fl2, srcReg);
check('a COMPLETE alias fold leaves the primary fully re-verified',
  !_fl2[0].partial && _fl2[0].names.includes('ALIAS ONE'));
// End-to-end: partial primary must be excluded from screenedLists, which is what
// makes diffState carry standing matches instead of clearing them.
const _screened = [_fl[0]].filter(L => !L.partial).map(L => L.name);
check('a partial primary is excluded from screenedLists (matches carried, not cleared)',
  _screened.length === 0);

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
