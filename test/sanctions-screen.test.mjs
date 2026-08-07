/* Unit tests for the Sanctions Screen pure logic (no network).
   Exercises the real /api/screen/batch response shape:
     { name, entityType, topScore (0-100), band, recommendation, hitCount, lists[] }
   Usage: node test/sanctions-screen.test.mjs */
import {
  normalizeName, parseSubject, parseSubjects, parsePrincipals, subjectLabel, normalizeHit, normalizeResult, normalizeScreenResponse,
  isMatch, diffState, hitDetail, matchSummary, buildScreenReport, buildScreenHtml, buildChangesArtifact,
  GOVERNANCE_NOTE, DEFAULT_THRESHOLD, resolveThreshold, resolveShadowThreshold, shadowBandRow, foldAliasSources,
  formatHumanDate, buildAmPepNotes, AM_KEYWORD_COUNT, belowFloor, omCardToSkip,
  whitelistKey, buildWhitelistMap, applyWhitelist, parseOfacApiResponse,
  getByPath, fetchPaginatedJson, PAGINATE_HARD_CAP, rotateByDay
} from '../scripts/sanctions-screen.mjs';
import { buildIndex, screenName, parseIdbCsv } from '../scripts/sanctions-match.mjs';
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

/* State record detail: `lists` stays the names-only array (signature/planner
   compatibility, pre-migration records) while gid/entityType/hits ADD the
   identity + evidence the case board was missing — entity cases titled
   CASE-XXXXXX with no customer link, and no matched designated name anywhere. */
check('diffState persists the subject gid/entityType and per-hit evidence detail',
  d1.nextState.subjects.a.gid === '1'
  && Array.isArray(d1.nextState.subjects.a.hits)
  && d1.nextState.subjects.a.hits[0].list === 'OFAC SDN'
  && d1.nextState.subjects.a.hits[0].score === 96
  && JSON.stringify(d1.nextState.subjects.a.lists) === '["OFAC SDN"]');
check('artifact hit detail (hitDetail) carries mechanism/confidence and drops junk rows',
  (() => {
    const d = hitDetail([{ list: 'OFAC SDN', hitName: 'ACME', score: 96, mechanism: 'fuzzy', confidence: 'STRONG' },
                         { carriedForward: true }, null]);
    return d.length === 1 && d[0].mechanism === 'fuzzy' && d[0].confidence === 'STRONG' && d[0].hitName === 'ACME';
  })());

/* Report-only ("every hit is a cleared false positive") must be recomputed
   AFTER carry-forward merges: a run whose sanctions hits are all whitelisted
   but that carries un-re-verified adverse-media evidence is NOT report-only —
   copying the flag closed the MLRO case on a live adverse signal. */
check('diffState: carried-forward adverse evidence defeats whitelistedOnly (case opens for a live signal)', (() => {
  const prior = diffState({ updated: null, subjects: {} },
    [normalizeResult({ name: 'W Co', topScore: 92, band: 'high', recommendation: 'match',
      lists: [{ list: 'OFAC SDN' }, { list: 'Adverse media (Google News)' }] }, { key: 'w', name: 'W Co' })],
    '2026-06-19', 0.85);
  const wlRun = normalizeResult({ name: 'W Co', topScore: 92, band: 'high', recommendation: 'match',
    lists: [{ list: 'OFAC SDN', whitelisted: true }] }, { key: 'w', name: 'W Co' });
  wlRun.whitelistedOnly = true;
  wlRun.enrichmentIncomplete = true;            // adverse-media lookup could not re-verify
  const next = diffState(prior.nextState, [wlRun], '2026-06-20', 0.85);
  const rec = next.nextState.subjects.w;
  return !!rec && rec.lists.includes('Adverse media (Google News)') && rec.whitelistedOnly !== true;
})());
check('diffState: a genuinely all-whitelisted run with nothing carried STAYS report-only', (() => {
  const wlRun = normalizeResult({ name: 'V Co', topScore: 92, band: 'high', recommendation: 'match',
    lists: [{ list: 'OFAC SDN', whitelisted: true }] }, { key: 'v', name: 'V Co' });
  wlRun.whitelistedOnly = true;
  const next = diffState({ updated: null, subjects: {} }, [wlRun], '2026-06-20', 0.85);
  return next.nextState.subjects.v.whitelistedOnly === true;
})());

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

/* Module-state honesty: a switched-off module must never render ACTIVE with
   NONE results — that reads as a clearance no lookup ever produced. */
const amOff = buildAmPepNotes({ today: '2026-06-24', tomorrow: '2026-06-25', subjects: 325, amActive: false, pepActive: false });
check('AM/PEP note renders OFF (not ACTIVE) for disabled modules',
  amOff.includes('Adverse media module:         OFF (SCREEN_ADVERSE_MEDIA=0') &&
  amOff.includes('PEP module:                   OFF (SCREEN_PEP=0') && !amOff.includes('ACTIVE'));
check('AM/PEP note says NOT EVALUATED (never NONE) for a disabled module\'s results',
  amOff.includes('New adverse media hits:       NOT EVALUATED (module off)') &&
  amOff.includes('New PEP identifications:      NOT EVALUATED (module off)') && !amOff.includes('hits:       NONE'));
check('AM/PEP CLEAR status is qualified when a module was off (no blanket clear)',
  amOff.includes('STATUS: ✅ CLEAR (evaluated modules only — adverse media + PEP OFF, not cleared)'));
check('AM/PEP CLEAR status stays unqualified when every module ran',
  amClear.includes('STATUS: ✅ CLEAR') && !amClear.includes('evaluated modules only'));

/* Human-action rows: on a hit day they are OPEN WORK, not "N/A". */
check('AM/PEP HIT note marks MLRO action rows pending (never N/A)',
  amHit.includes('C. ACTIONS (MLRO — human decisions, not automated)') &&
  amHit.includes('EDD triggered:                pending MLRO review') && !amHit.includes('N/A'));
check('AM/PEP CLEAR note marks action rows not-required (no findings)',
  amClear.includes('EDD triggered:                not required (no new findings this run)'));
check('AM/PEP HIT note tracks false-positive review as pending disposition (no placeholder)',
  amHit.includes('False-positive review:        pending MLRO disposition') && !amHit.includes('[to be reviewed by MLRO]'));

/* CHANGED tag: a standing match that escalated this run must not read
   "previously reported". */
const amChanged = buildAmPepNotes({ today: '2026-06-24', tomorrow: '2026-06-25', subjects: 325,
  amHits: amResults.filter(r => r.lists.some(h => h.list.includes('Adverse media'))),
  pepHits: amResults.filter(r => r.lists.some(h => h.list.includes('PEP'))),
  newMatchKeys: ['a'], changedMatchKeys: ['b'] });
check('AM/PEP note tags an escalated standing match CHANGED, not previously-reported',
  /Beta FZE.*\| CHANGED \(escalated\/updated this run\)/.test(amChanged) && !/Beta FZE.*STANDING/.test(amChanged));
check('AM/PEP note counts changed matches separately when diff info allows',
  amChanged.includes('PEP identifications:          1 (0 new, 1 changed, 0 standing)'));

/* Coverage honesty on the alert/report surfaces. */
const covMeta = { screened: 42, loadedLists: ['OFAC SDN', 'UN Consolidated'], failures: ['EU FSF: HTTP 503'] };
const covReport = buildScreenReport(d1.alerts, [], '2026-06-19', covMeta);
check('report states the lists ACTUALLY loaded, not the configured scope as fact',
  covReport.includes('against 2 loaded list(s): OFAC SDN · UN Consolidated') && covReport.includes('Configured scope:'));
check('report names lists that did NOT load as unscreened',
  covReport.includes('Not loaded this run (their designations were NOT screened): EU FSF: HTTP 503'));
const covHtml = buildScreenHtml(d1.alerts, { today: '2026-06-19', loadedLists: ['OFAC SDN'], failures: ['UN: timeout'] });
check('html alert separates loaded-this-run from configured scope',
  covHtml.includes('Screened against (loaded this run):') && covHtml.includes('OFAC SDN')
  && covHtml.includes('Configured scope:') && covHtml.includes('Not loaded this run'));

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

/* ── hardening audit 2026-08-05: match-branch module-off + narrowed-coverage
   carry-forward (findings 2/7 + 1/3/6), and the OFAC latin-1 decode (finding 4) ── */
// Finding 2/7: a STILL-MATCHING subject (OFAC hit present) whose PEP MODULE was
// off this run must not have its standing PEP evidence silently erased — the
// clear-branch already guarded this, the match-branch did not.
const mmPrior = diffState({ updated: null, subjects: {} }, [mixedPrior], '2026-07-25', 0.85, ['OFAC SDN'], ALL_SIGNALS);
const stillMatchPepOff = normalizeResult({ name: 'M Co', topScore: 96, band: 'high', recommendation: 'sanctions-match',
  lists: [{ list: 'OFAC SDN', matchScore: 96 }] }, { key: 'm', name: 'M Co' });
const mmOff = diffState(mmPrior.nextState, [stillMatchPepOff], '2026-07-26', 0.85, ['OFAC SDN'],
  ['Adverse media (Google News)', 'Interpol Red Notice']);   // PEP module not evaluated
check('match-branch: a still-matching subject keeps its PEP evidence when the PEP module was off (finding 2/7)',
  mmOff.alerts.length === 0 && mmOff.nextState.subjects.m.lists.sort().join() === 'OFAC SDN,PEP (Wikidata)');
// Finding 2/7 band: an enrichment-driven prior band must not silently downgrade
// when the module that drove it was off this run.
const amBandPrior = diffState({ updated: null, subjects: {} },
  [normalizeResult({ name: 'B Co', topScore: 90, band: 'high', recommendation: 'sanctions-match',
    lists: [{ list: 'OFAC SDN', matchScore: 90 }, { list: 'Adverse media (Google News)', matchScore: 85 }] }, { key: 'b', name: 'B Co' })],
  '2026-07-25', 0.85, ['OFAC SDN'], ALL_SIGNALS);
const amBandOff = diffState(amBandPrior.nextState,
  [normalizeResult({ name: 'B Co', topScore: 90, band: 'medium', recommendation: 'sanctions-match',
    lists: [{ list: 'OFAC SDN', matchScore: 90 }] }, { key: 'b', name: 'B Co' })],
  '2026-07-26', 0.85, ['OFAC SDN'], ['PEP (Wikidata)']);   // adverse-media module off
check('match-branch: a prior band driven up by an off-module signal is preserved, not downgraded',
  amBandOff.nextState.subjects.b.band === 'high');

// Findings 1/3/6: a standing adverse-media match must NOT clear on a NARROWED
// (budget-rotated / disclosed-partial) sweep — the originating edition may not
// have been queried; r.unverified names the signal that was not re-checked.
const amStanding = () => ({ updated: null, subjects: { a: {
  name: 'A Co', band: 'medium', topScore: 75, recommendation: 'review',
  lists: ['Adverse media (Google News)'], signature: 'x', firstSeen: '2026-07-01', lastSeen: '2026-07-25' } } });
const amClearNarrowed = Object.assign(
  normalizeResult({ name: 'A Co', topScore: 0, band: 'low', recommendation: 'clear', lists: [] }, { key: 'a', name: 'A Co' }),
  { unverified: ['Adverse media (Google News)'] });
const an1 = diffState(amStanding(), [amClearNarrowed], '2026-07-26', 0.85, ['OFAC SDN'], ALL_SIGNALS);
check('clear-branch: a standing adverse-media match is HELD on a narrowed/budget-rotated sweep (findings 1/3/6)',
  an1.cleared.length === 0 && !!an1.nextState.subjects.a);
// CONTROL: a FULL sweep that re-verified the story is gone must still clear it —
// the guard preserves recall, it must not freeze adverse-media matches forever.
const an2 = diffState(amStanding(),
  [normalizeResult({ name: 'A Co', topScore: 0, band: 'low', recommendation: 'clear', lists: [] }, { key: 'a', name: 'A Co' })],
  '2026-07-26', 0.85, ['OFAC SDN'], ALL_SIGNALS);
check('clear-branch: a standing adverse-media match DOES clear once a full sweep re-verifies it gone',
  an2.cleared.length === 1 && !an2.nextState.subjects.a);
// Match-branch narrowed carry-forward: still-matching OFAC, adverse narrowed.
const amMixStanding = diffState({ updated: null, subjects: {} },
  [normalizeResult({ name: 'C Co', topScore: 96, band: 'high', recommendation: 'sanctions-match',
    lists: [{ list: 'OFAC SDN', matchScore: 96 }, { list: 'Adverse media (Google News)', matchScore: 85 }] }, { key: 'c', name: 'C Co' })],
  '2026-07-25', 0.85, ['OFAC SDN'], ALL_SIGNALS);
const amMixNarrowed = Object.assign(
  normalizeResult({ name: 'C Co', topScore: 96, band: 'high', recommendation: 'sanctions-match',
    lists: [{ list: 'OFAC SDN', matchScore: 96 }] }, { key: 'c', name: 'C Co' }),
  { unverified: ['Adverse media (Google News)'] });
const amMix = diffState(amMixStanding.nextState, [amMixNarrowed], '2026-07-26', 0.85, ['OFAC SDN'], ALL_SIGNALS);
check('match-branch: a narrowed adverse-media sweep keeps the standing adverse hit, no spurious alert',
  amMix.alerts.length === 0 && amMix.nextState.subjects.c.lists.includes('Adverse media (Google News)'));

// Finding 4: OFAC SDN/alt must be decoded latin-1 (screen.py does; the JS
// r.text() UTF-8 path mangled every ñ/accented designation into a split token).
const _ofacSrc = JSON.parse(readFileSync(join(ROOT, 'data/sanctions-sources.json'), 'utf8'));
check('OFAC SDN + alt.csv declare charset latin1 so fetchListBody decodes them like screen.py (finding 4)',
  _ofacSrc.sources.find(s => s.id === 'ofac-sdn').charset === 'latin1'
  && _ofacSrc.sources.find(s => s.id === 'ofac-sdn-alt').charset === 'latin1');
const _pena = Buffer.from('PEÑA', 'latin1');
check('latin1 decode preserves the ñ token (→ pena); the old UTF-8 decode split it (finding 4)',
  normalizeName(new TextDecoder('latin1').decode(_pena)) === normalizeName('PENA')
  && normalizeName(new TextDecoder('utf-8').decode(_pena)) !== normalizeName('PENA'));

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

/* ── same-day Ongoing-Monitoring dedup is DIRECTION-AWARE ──
   Both card names carry the words "Adverse Media", so the old flat
   date + keyword match treated CLEAR and HIT as interchangeable: whichever
   landed first suppressed the other. A run earlier in the day that found
   nothing — or found nothing because its feed was degraded — therefore
   suppressed a later run's HIT card, leaving Ongoing Monitoring showing CLEAR
   for a day on which hits were found. Reachable via workflow_dispatch or a
   re-run, i.e. exactly what you do after noticing a degraded run. */
const _omDate = '29 Jul 2026';
const _omClear = 'Adverse Media & PEP — CLEAR — ' + _omDate;
const _omHit = '\u26a0 Adverse Media / PEP HIT — ' + _omDate + ' — 3 subject(s)';

check('a HIT card is POSTED even though today already has a CLEAR card',
  omCardToSkip([_omClear], _omDate, true) === null);
check('a CLEAR card does not repeat over today\'s CLEAR card',
  omCardToSkip([_omClear], _omDate, false) === _omClear);
check('nothing supersedes a HIT card — a later HIT run does not duplicate it',
  omCardToSkip([_omHit], _omDate, true) === _omHit);
check('a CLEAR card never overwrites the day after a HIT was reported',
  omCardToSkip([_omHit], _omDate, false) === _omHit);
check('with both cards present, a further HIT run is redundant',
  omCardToSkip([_omClear, _omHit], _omDate, true) === _omHit);
check('an empty project posts the first card of the day (CLEAR)',
  omCardToSkip([], _omDate, false) === null);
check('an empty project posts the first card of the day (HIT)',
  omCardToSkip([], _omDate, true) === null);
// The boundary guard the original dedup already had must survive: "9 Jul 2026"
// is a substring of "19 Jul 2026".
check('another day\'s card never dedupes today',
  omCardToSkip(['Adverse Media & PEP — CLEAR — 9 Jul 2026'], _omDate, true) === null);
check('a same-prefix date does not collide (9 Jul vs 19 Jul)',
  omCardToSkip(['Adverse Media & PEP — CLEAR — 19 Jul 2026'], '9 Jul 2026', false) === null);
// Unrelated Ongoing-Monitoring cards on the same date must not dedupe either.
check('an unrelated same-day OM card does not suppress the AM/PEP card',
  omCardToSkip(['Quarterly review — ' + _omDate], _omDate, true) === null);

/* ── Cleared-FP registry (whitelist) — demote, never suppress ── */
const _wlCurated = [{ subject_key: 'acme llc', hit_name: 'ACME L.L.C.', list: 'US OFAC — SDN list (CSV)',
  cleared_by: 'MLRO', cleared_at: '2026-08-01', case_gid: '123', reason: 'different entity, disambiguated' }];
const _wlCases = { 'bravo|ubo|999': { taskGid: 't1', disposition: { kind: 'false-positive', at: '2026-08-02', caseGid: 't1',
  hits: [{ hitName: 'BRAVO TRADING', list: 'UK OFSI — Consolidated list of targets (CSV)' }] } } };
const _wl = buildWhitelistMap(_wlCurated, _wlCases);
check('whitelist map holds curated + disposition pairs', _wl.size === 2);
check('whitelist key normalises the designated name (punctuation churn survives)',
  whitelistKey('acme llc', 'ACME L.L.C.', 'US OFAC — SDN list (CSV)')
  === whitelistKey('acme llc', 'ACME LLC', 'US OFAC — SDN list (CSV)'));
const _wlHits = [
  { list: 'US OFAC — SDN list (CSV)', hitName: 'ACME L.L.C.', score: 90 },
  { list: 'UN Security Council — Consolidated list (XML)', hitName: 'OTHER NAME', score: 70 }];
check('applyWhitelist annotates ONLY the cleared pair — the other hit is untouched',
  applyWhitelist('acme llc', _wlHits, _wl) === 1
  && _wlHits[0].whitelisted === true && _wlHits[0].clearedVia === 'registry file'
  && !_wlHits[1].whitelisted);
check('a disposition-sourced pair cites its case as evidence',
  _wl.get(whitelistKey('bravo|ubo|999', 'BRAVO TRADING', 'UK OFSI — Consolidated list of targets (CSV)')).clearedVia === 'case t1');
check('normalizeHit carries the whitelist annotation through the rebuild',
  (() => { const h = normalizeHit({ list: 'L', hitName: 'N', score: 80, whitelisted: true, clearedVia: 'case t1' });
    return h.whitelisted === true && h.clearedVia === 'case t1'; })());
check('hitDetail persists the whitelist annotation into the state record',
  (() => { const d = hitDetail([{ list: 'L', hitName: 'N', score: 80, whitelisted: true, clearedAt: '2026-08-01' }]);
    return d[0].whitelisted === true && d[0].clearedAt === '2026-08-01'; })());

/* ── OFAC-API second-opinion parser (shape-tolerant, unavailable ≠ clear) ── */
check('OFAC-API: matches present → corroborated with count + top score',
  (() => { const p = parseOfacApiResponse({ results: [{ name: 'X', matches: [{ score: 92 }, { score: 71 }] }] });
    return p.status === 'corroborated' && p.matchCount === 2 && p.topScore === 92; })());
check('OFAC-API: empty matches → no-match (never silently corroborated)',
  parseOfacApiResponse({ results: [{ name: 'X', matches: [] }] }).status === 'no-match');
check('OFAC-API: error payload → unavailable with the reason',
  (() => { const p = parseOfacApiResponse({ errorMessage: 'invalid api key' });
    return p.status === 'unavailable' && p.error.includes('invalid api key'); })());
check('OFAC-API: unrecognised shape → unavailable, never a guess',
  parseOfacApiResponse({ totally: 'different' }).status === 'unavailable');
check('OFAC-API: non-object → unavailable', parseOfacApiResponse(null).status === 'unavailable');

/* ── Ad-hoc batch screening (scripts/batch-screen.mjs — pure parts) ── */
const { parseNamesInput, buildBatchReport } = await import('./../scripts/batch-screen.mjs');
check('batch: header-aware CSV takes the name column',
  JSON.stringify(parseNamesInput('country,name\nAE,"ACME LLC"\nSG,Bravo')) === '["ACME LLC","Bravo"]');
check('batch: plain one-per-line list works, blanks dropped',
  JSON.stringify(parseNamesInput('ACME LLC\n\nBravo Trading\n')) === '["ACME LLC","Bravo Trading"]');
check('batch: empty input yields no names', parseNamesInput('').length === 0);
const _batchRep = buildBatchReport(
  [{ name: 'A|B', band: 'high', topScore: 90, recommendation: 'sanctions-match',
     lists: [{ list: 'US OFAC — SDN list (CSV)', hitName: 'A', score: 90 }] },
   { name: 'Clean Co', band: 'low', topScore: 0, recommendation: 'clear', lists: [] }],
  { date: '2026-08-05', threshold: 85, listsLoaded: 10,
    failures: ['UN Security Council — fetch failed'], governanceNote: 'GOV-NOTE' });
check('batch report: counts, pipe-escaping, clear rows, governance note',
  _batchRep.includes('1 of 2 name(s)') && _batchRep.includes('A\\|B')
  && _batchRep.includes('no list match') && _batchRep.includes('GOV-NOTE'));
check('batch report: a pre-escaped backslash-pipe cannot re-arm the pipe (CodeQL)',
  buildBatchReport([{ name: 'X\\|Y', band: 'low', topScore: 0, recommendation: 'clear', lists: [] }],
    { date: '2026-08-05', threshold: 85, listsLoaded: 10, failures: [], governanceNote: '' })
    .includes('X\\\\\\|Y'));
check('batch report: failed lists are disclosed as reduced coverage',
  _batchRep.includes('Reduced coverage') && _batchRep.includes('UN Security Council — fetch failed'));

/* ── yente benchmark (experimental, shadow-only — pure functions) ── */
const yb = await import('./../scripts/yente-bench.mjs');
const _e1 = yb.ftmEntity('ACME Trading LLC', 'r001');
check('yente: ftmEntity id is stable, prefixed, and seed-derived',
  /^hb-[0-9a-f]{16}$/.test(_e1.id) && _e1.id === yb.ftmEntity('ACME Trading LLC', 'r001').id
  && _e1.id !== yb.ftmEntity('ACME Trading LLC', 'r002').id);
check('yente: ftmEntity carries name + sanction topic on LegalEntity',
  _e1.schema === 'LegalEntity' && _e1.properties.name[0] === 'ACME Trading LLC'
  && _e1.properties.topics[0] === 'sanction');
check('yente: manifest declares the custom dataset and its container path',
  yb.buildManifest('/data/hawkeye-bench.ftm.json').includes(`name: ${yb.DATASET}`)
  && yb.buildManifest('/data/hawkeye-bench.ftm.json').includes('path: /data/hawkeye-bench.ftm.json')
  && yb.buildManifest('/data/x').includes('self-generated'));
check('yente: matchQuery wraps the subject as a LegalEntity name query',
  JSON.stringify(yb.matchQuery('Bob')) === '{"schema":"LegalEntity","properties":{"name":["Bob"]}}');
const _ybPairs = [
  { subject: 'A', mechanism: 'exact' }, { subject: 'B', mechanism: 'alias' },
  { subject: 'C', mechanism: 'alias' }];
const _ybNegs = [{ subject: 'N1' }, { subject: 'N2' }];
const _ybRes = new Map([['A', 0.9], ['B', 0.65], ['C', 0.4], ['N1', 0.75], ['N2', 0.1]]);
const _ybEval = yb.evaluate(_ybPairs, _ybNegs, _ybRes, 0.6);
check('yente: evaluate scores recall and false positives at the threshold',
  _ybEval.recall.hits === 2 && _ybEval.recall.total === 3
  && _ybEval.false_positives.fps === 1 && _ybEval.false_positives.total === 2);
check('yente: evaluate breaks recall down by mechanism',
  _ybEval.recall.by_mechanism.exact.hits === 1 && _ybEval.recall.by_mechanism.alias.hits === 1
  && _ybEval.recall.by_mechanism.alias.total === 2);
check('yente: a subject yente never scored counts as a miss, not a crash',
  yb.evaluate([{ subject: 'ghost', mechanism: 'exact' }], [], new Map(), 0.5).recall.hits === 0);
const _ybMd = yb.report([yb.evaluate(_ybPairs, _ybNegs, _ybRes, 0.5), _ybEval,
  yb.evaluate(_ybPairs, _ybNegs, _ybRes, 0.7)]);
check('yente: report renders the threshold table and per-mechanism recall',
  _ybMd.includes('| 0.5 |') && _ybMd.includes('| 0.7 |') && _ybMd.includes('alias: 1/2')
  && _ybMd.includes('no external data downloaded'));
check('yente: report frames adoption as governed by the recall-monotone invariant',
  _ybMd.includes('recall-monotone') && _ybMd.includes('baseline.json'));

/* ── worldwide expansion: CSL parser, ODS parser, FBI Wanted signal ── */
const wm = await import('./../scripts/sanctions-match.mjs');
const _csl = wm.parseCslCsv(
  'source,entity_number,type,programs,name,title,addresses,alt_names\n'
  + 'Entity List (EL) - Bureau of Industry and Security,,Entity,,ACME PRECISION CO LTD,,Somewhere,"ACME PRECISION; APC TRADING"\n'
  + 'Denied Persons List (DPL) - Bureau of Industry and Security,,Individual,,John Q Denied,,,\n');
check('CSL: primary names + ;-separated alt_names all screen',
  _csl.includes('ACME PRECISION CO LTD') && _csl.includes('APC TRADING')
  && _csl.includes('John Q Denied') && _csl.length === 4);
check('CSL: a body with no name column parses 0 names (degrades, never guesses)',
  wm.parseCslCsv('foo,bar\n1,2\n').length === 0);
const _odsXml = '<office:document-content>'
  + '<table:table-row><table:table-cell><text:p>Naam</text:p></table:table-cell><table:table-cell><text:p>Voornaam</text:p></table:table-cell></table:table-row>'
  + '<table:table-row><table:table-cell><text:p>Jansen</text:p></table:table-cell><table:table-cell><text:p>Pieter</text:p></table:table-cell></table:table-row>'
  + '<table:table-row><table:table-cell table:number-columns-repeated="2"/></table:table-row>'
  + '<table:table-row><table:table-cell><text:p>Stichting X</text:p></table:table-cell><table:table-cell/></table:table-row>'
  + '</office:document-content>';
check('ODS: Dutch name columns located by header, names joined across them',
  JSON.stringify(wm.parseOdsContent(_odsXml)) === '["Jansen Pieter","Stichting X"]');
/* XLSX inline strings carry rich text as multiple <t> runs that CONCATENATE —
   reading only the first run truncated a designated name mid-string. */
check('XLSX: an inlineStr cell joins every rich-text run (no mid-name truncation)',
  JSON.stringify(wm.parseSheetRows('<row r="1"><c r="A1" t="inlineStr"><is><r><t>ISLAMIC REVOLUTIONARY</t></r><r><t> GUARD CORPS</t></r></is></c></row>', []))
  === '[["ISLAMIC REVOLUTIONARY GUARD CORPS"]]');
check('ODS: a self-closed empty cell keeps its column (the greedy attr group ate the next cell)', (() => {
  const xml = '<table:table-row><table:table-cell><text:p>Nr</text:p></table:table-cell>'
    + '<table:table-cell><text:p>Naam</text:p></table:table-cell></table:table-row>'
    + '<table:table-row><table:table-cell/><table:table-cell><text:p>Jansen Piet</text:p></table:table-cell></table:table-row>';
  return JSON.stringify(wm.parseOdsContent(xml)) === '["Jansen Piet"]';
})());
/* Merged cells: <table:covered-table-cell> holds the grid positions under a
   merge. Skipping them shifted later cells LEFT, so merged rows read their name
   from the wrong column and vanished while the row count stayed above the floor. */
check('ODS: covered (merged) cells hold their grid position — the name column does not shift', (() => {
  const xml = '<table:table-row><table:table-cell><text:p>Nr</text:p></table:table-cell>'
    + '<table:table-cell><text:p>Naam</text:p></table:table-cell></table:table-row>'
    + '<table:table-row><table:table-covered-cell/><table:table-cell><text:p>De Vries Jan</text:p></table:table-cell></table:table-row>'
    + '<table:table-row><table:covered-table-cell/><table:table-cell><text:p>Bakker Ali</text:p></table:table-cell></table:table-row>';
  const names = wm.parseOdsContent(xml);
  return names.includes('Bakker Ali');
})());
check('ODS: content with no header row yields 0 names', wm.parseOdsContent('<table:table-row><table:table-cell><text:p>x</text:p></table:table-cell></table:table-row>').length === 0);
check('ODS: tag stripping removes inline spans and unterminated tags (CodeQL)',
  JSON.stringify(wm.parseOdsContent('<table:table-row><table:table-cell><text:p>Name</text:p></table:table-cell></table:table-row>'
    + '<table:table-row><table:table-cell><text:p>Acme <text:span>Ltd</text:span> <script</text:p></table:table-cell></table:table-row>'))
  === '["Acme Ltd"]');
check('ODS: no "<" survives the fixpoint strip — "<scr<x>ipt>" cannot rebuild a tag (CodeQL)',
  wm.parseOdsContent('<table:table-row><table:table-cell><text:p>Name</text:p></table:table-cell></table:table-row>'
    + '<table:table-row><table:table-cell><text:p>Acme<scr<x>ipt>Ltd</text:p></table:table-cell></table:table-row>')
    .every(n => !n.includes('<')));
check('ODS: entity unescaping is single-pass — a literal &amp;lt; never becomes < (CodeQL)',
  JSON.stringify(wm.parseOdsContent('<table:table-row><table:table-cell><text:p>Name</text:p></table:table-cell></table:table-row>'
    + '<table:table-row><table:table-cell><text:p>Smith &amp;amp; Jones &amp;amp;lt;Ltd&amp;amp;gt;</text:p></table:table-cell></table:table-row>'
      .replace(/&amp;amp;/g, '&amp;')))
  === '["Smith & Jones &lt;Ltd&gt;"]');
const fbi = await import('./../scripts/fbi-check.mjs');
check('FBI: search URL encodes the subject against the public endpoint',
  fbi.fbiSearchUrl('Ali Al-Test') === 'https://api.fbi.gov/wanted/v1/list?pageSize=20&title=Ali%20Al-Test');
const _fbiHit = fbi.scoreFbi('John Dillinger', { items: [
  { title: 'JOHN HERBERT DILLINGER', poster_classification: 'default', url: 'https://www.fbi.gov/x' },
  { title: 'John Dillinger', poster_classification: 'missing' }] });
check('FBI: a wanted poster matching all subject tokens is a high-band hit',
  _fbiHit.hit && _fbiHit.band === 'high' && _fbiHit.score === 85 && _fbiHit.match.title === 'JOHN HERBERT DILLINGER');
check('FBI: missing-person posters never count as adverse (excluded, tallied)',
  _fbiHit.excluded === 1
  && fbi.scoreFbi('Jane Doe', { items: [{ title: 'JANE DOE', poster_classification: 'missing' }] }).hit === false);
check('FBI: alias matches count; unrelated namesakes do not',
  fbi.scoreFbi('Rico Vasquez', { items: [{ title: 'ENRIQUE GARCIA', aliases: ['Rico Vasquez'], poster_classification: 'default' }] }).hit === true
  && fbi.scoreFbi('Rico Vasquez', { items: [{ title: 'RICO ALVAREZ', poster_classification: 'default' }] }).hit === false);
check('FBI: an unrecognized poster class is excluded until reviewed, never promoted',
  fbi.scoreFbi('A B Test', { items: [{ title: 'A B TEST', poster_classification: 'brand-new-class' }] }).hit === false);
check('FBI: victim/accomplice rows never screen as wanted subjects',
  fbi.scoreFbi('Vic Timson', { items: [{ title: 'VIC TIMSON', poster_classification: 'default', person_classification: 'Victim' }] }).hit === false);
check('FBI: a captured poster is history, not a live hit',
  fbi.scoreFbi('Cap Turedman', { items: [{ title: 'CAP TUREDMAN', poster_classification: 'default', status: 'captured' }] }).hit === false);
check('CSL: SDN-source rows are dropped (already screened via the OFAC feeds)',
  wm.parseCslCsv('source,name,alt_names\n"Specially Designated Nationals (SDN) - Treasury Department",DUPE PERSON,\n"Entity List (EL) - Bureau of Industry and Security",REAL ENTITY,\n')
    .join('|') === 'REAL ENTITY');

/* ── worldwide PEP list (Wikidata harvest — pure functions) ── */
const pep = await import('./../scripts/pep-worldwide.mjs');
check('PEP harvest: positions query is a bare DISTINCT P279* walk — no label service, no OPTIONALs (the 2026-08-06 9MB truncation at the WDQS 60s kill)',
  pep.positionsQuery('Q48352').includes('wdt:P279* wd:Q48352')
  && pep.positionsQuery('Q48352').includes('SELECT DISTINCT ?pos')
  && !pep.positionsQuery('Q48352').includes('wikibase:label')
  && !/OPTIONAL/i.test(pep.positionsQuery('Q48352')));
const _hq = pep.holdersQuery(['Q11696', 'Q14212'], '2024-08-05T00:00:00Z');
check('PEP harvest: holders query batches positions via VALUES at BestRank with the recency filter',
  _hq.includes('VALUES ?pos { wd:Q11696 wd:Q14212 }') && _hq.includes('wikibase:BestRank')
  && _hq.includes('pq:P582') && _hq.includes('"2024-08-05T00:00:00Z"^^xsd:dateTime')
  && !/OFFSET/i.test(_hq));
check('PEP harvest: SPARQL bindings parse to plain rows with QIDs reduced',
  JSON.stringify(pep.parseSparqlBindings({ results: { bindings: [
    { person: { type: 'uri', value: 'http://www.wikidata.org/entity/Q7747' }, end: { type: 'literal', value: '2024-05-07' } }] } }))
  === '[{"person":"Q7747","end":"2024-05-07"}]');
check('PEP harvest: an unrecognised SPARQL shape parses to [] (zero-guards take over)',
  pep.parseSparqlBindings({ oops: true }).length === 0);
const _ent = pep.namesFromEntity({
  labels: { en: { value: 'Test Person' }, ar: { value: 'شخص اختبار' }, ru: { value: 'Тест Персон' } },
  aliases: { en: [{ value: 'T. Person' }], ar: [{ value: 'اختبار' }] } });
check('PEP harvest: every-language labels and aliases fold into the alias set, original scripts kept',
  _ent.name === 'Test Person' && _ent.aliases.includes('شخص اختبار')
  && _ent.aliases.includes('Тест Персон') && _ent.aliases.includes('T. Person')
  && !_ent.aliases.includes('Test Person'));
const _ds = pep.buildPepDataset({
  harvestedAt: '2026-08-05T00:00:00Z',
  holderRows: [
    { person: 'Q1x', pos: 'P1', end: '', classKey: 'legislator' },
    { person: 'Q1x', pos: 'P2', end: '', classKey: 'head-of-state' },
    { person: 'Q2x', pos: 'P1', end: '2025-01-01', classKey: 'legislator' },
    { person: 'Q3x', pos: 'P9', end: '', classKey: 'minister' }],
  positions: new Map([['P1', { label: 'MP of Testland', country: 'Testland' }], ['P2', { label: 'President of Testland', country: 'Testland' }]]),
  names: new Map([['Q1x', { name: 'Alpha Leader', aliases: ['A. Leader'] }], ['Q2x', { name: 'Beta Member', aliases: [] }]]),
});
check('PEP harvest: dedupe keeps the most senior class; unlabeled persons drop; counts per class',
  _ds.count === 2 && _ds.classes['head-of-state'] === 1 && _ds.classes.legislator === 1
  && _ds.entries.find(e => e.qid === 'Q1x').position === 'President of Testland'
  && _ds.entries.find(e => e.qid === 'Q2x').current === false
  && !_ds.entries.find(e => e.qid === 'Q3x'));
check('PEP harvest: floor gate refuses a hollow harvest and a >40% shrink, passes a healthy one',
  pep.datasetFloorOk({ count: 10 }, null, { floor: 5000 }).ok === false
  && pep.datasetFloorOk({ count: 6000 }, { count: 12000 }, { floor: 5000, shrinkPct: 0.6 }).ok === false
  && pep.datasetFloorOk({ count: 11000 }, { count: 12000 }, { floor: 5000, shrinkPct: 0.6 }).ok === true);
const _plist = pep.pepListFromDataset(_ds);
check('PEP list: dataset flattens to a matcher list + per-name office context map',
  _plist.list.name === pep.PEP_LIST_NAME && _plist.list.names.includes('Alpha Leader')
  && _plist.list.names.includes('A. Leader')
  && _plist.meta.get('A. Leader').position === 'President of Testland'
  && _plist.count === 2);
check('PEP list: the list name rides the non-whitelistable PEP prefix',
  pep.PEP_LIST_NAME.startsWith('PEP ('));
check('PEP harvest: batch-failure gate tolerates a few flaky WDQS batches, refuses an outage',
  pep.batchFailureOk(5, 100).ok === true
  && pep.batchFailureOk(15, 100).ok === false
  && pep.batchFailureOk(0, 0).ok === true
  && pep.batchFailureOk(10, 100).ok === true);
check('PEP harvest: holder batch size stays well under the WDQS 60s kill (≤ 100)',
  pep.HOLDER_BATCH <= 100);
check('PEP classes: the core FATF categories stay REQUIRED, expansions are optional', (() => {
  const byKey = new Map(pep.PEP_ROOT_CLASSES.map(c => [c.key, c]));
  const core = ['head-of-state', 'head-of-government', 'minister', 'legislator', 'governor'];
  const coreRequired = core.every(k => byKey.has(k) && !byKey.get(k).optional);
  // Senior-official expansion present and OPTIONAL (a wrong/empty QID degrades
  // loudly to zero-holders, never fails the harvest).
  const expansions = ['ombudsman', 'prosecutor-general', 'auditor-general'];
  const optionalAdds = expansions.every(k => byKey.has(k) && byKey.get(k).optional === true);
  // ombudsman carries the cross-verified QID.
  return coreRequired && optionalAdds && byKey.get('ombudsman').qid === 'Q169180'
    && pep.PEP_ROOT_CLASSES.every(c => /^Q\d+$/.test(c.qid));
})());

/* ── PEP harvest resumability (time-budget checkpoint — the monolithic 1-3h
   run kept dying to abnormal runner terminations with zero salvage) ── */
check('PEP checkpoint: path derives from the outfile, beside it',
  pep.checkpointPath('data/pep-worldwide.json') === 'data/pep-worldwide-checkpoint.json');
const _cpOk = { v: 1, sinceIso: '2026-08-01T00:00:00Z', harvestedAt: new Date(Date.now() - 3600000).toISOString(), phase: 'holders', resumeCount: 2 };
check('PEP checkpoint: a fresh checkpoint resumes; an unrecognized shape starts fresh (never fatal)',
  pep.checkpointUsable(_cpOk).ok === true
  && pep.checkpointUsable(null).ok === false && pep.checkpointUsable(null).fatal === false
  && pep.checkpointUsable({ v: 99 }).ok === false && pep.checkpointUsable({ v: 99 }).fatal === false);
check('PEP checkpoint: a stale checkpoint (previous weekly cycle) is discarded, not resumed', (() => {
  const u = pep.checkpointUsable({ ..._cpOk, harvestedAt: new Date(Date.now() - 8 * 86400000).toISOString() });
  return u.ok === false && u.fatal === false;
})());
check('PEP checkpoint: resume-count past the cap is FATAL — a non-converging harvest fails loudly, never loops', (() => {
  const u = pep.checkpointUsable({ ..._cpOk, resumeCount: pep.PEP_MAX_RESUMES });
  return u.ok === false && u.fatal === true;
})());
/* The checkpoint is GZIPPED: the first live harvest banked 60MB of holder rows
   (~809k) before the labels phase even began, and GitHub REFUSES a push with a
   file over 100MB — an uncompressed checkpoint would kill the chain exactly when
   it held the most work. Reads must still accept a plain-JSON checkpoint written
   before the change, or hours of banked WDQS work are discarded as "unrecognized". */
{
  const { writeFileSync: _wf, readFileSync: _rf, unlinkSync: _ul } = await import('node:fs');
  const { gzipSync } = await import('node:zlib');
  const tmp = (await import('node:os')).tmpdir() + '/pep-cp-test.json';
  const obj = { v: 1, phase: 'holders', holderRows: [{ person: 'Q1', pos: 'Q2', end: '', classKey: 'minister' }] };
  pep.writeCheckpoint(tmp, obj);
  const raw = _rf(tmp);
  check('PEP checkpoint is written GZIPPED (a >100MB plain file cannot be pushed at all)',
    raw[0] === 0x1f && raw[1] === 0x8b && raw.length < JSON.stringify(obj).length + 64);
  check('PEP checkpoint round-trips through gzip', pep.readCheckpoint(tmp).holderRows[0].person === 'Q1');
  _wf(tmp, JSON.stringify(obj), 'utf8');           // legacy plain-JSON checkpoint
  check('PEP checkpoint still READS a pre-gzip checkpoint (banked work is never discarded on a format change)',
    pep.readCheckpoint(tmp).phase === 'holders');
  _wf(tmp, gzipSync(Buffer.from(JSON.stringify(obj))));
  check('PEP checkpoint reads a gzip buffer written externally', pep.readCheckpoint(tmp).v === 1);
  try { _ul(tmp); } catch { /* best-effort cleanup */ }
}

/* The ARTIFACT hits the same 100MB wall as the checkpoint: measured on the first
   live harvest (20,550 persons banked, 259 bytes of multilingual names each) the
   finished dataset projects to ~135MB for the 422,231 people found holding
   office. Compressing it is what keeps every alias — the alternative is cutting
   aliases, which would lower recall. */
{
  const { writeFileSync: _wf, readFileSync: _rf, unlinkSync: _ul } = await import('node:fs');
  const tmp = (await import('node:os')).tmpdir() + '/pep-artifact-test.json';
  const ds = { v: 1, count: 1, harvested: '2026-08-06T00:00:00Z', classes: { minister: 1 },
    entries: [{ qid: 'Q1', name: 'A Name', aliases: ['Алиас', '別名'], position: 'Minister', country: 'AE', current: true }] };
  pep.writeJsonGz(tmp, ds);
  const raw = _rf(tmp);
  check('PEP artifact is written GZIPPED (a ~135MB plain artifact cannot be pushed at all)',
    raw[0] === 0x1f && raw[1] === 0x8b);
  check('PEP artifact round-trips through gzip with non-Latin aliases intact',
    pep.readJsonMaybeGz(tmp).entries[0].aliases.join('|') === 'Алиас|別名');
  _wf(tmp, JSON.stringify(ds), 'utf8');            // artifact written before this change
  check('PEP artifact reader still accepts a plain-JSON artifact (a harvest already on the state branch keeps screening)',
    pep.readJsonMaybeGz(tmp).count === 1);
  check('PEP artifact reader feeds pepListFromDataset unchanged (the screen consumes either format)',
    pep.pepListFromDataset(pep.readJsonMaybeGz(tmp)).list.names.length >= 3);
  try { _ul(tmp); } catch { /* best-effort cleanup */ }
}

/* Label fetching is CONCURRENT or the harvest never finishes: 422,231 persons
   at 50 per request is 8,445 round-trips, and a measured chain link banked 411
   of them in its 40-min budget — ~13 more links against a 12-resume cap. The
   window must be a whole multiple of the chunk so a pause mid-phase resumes on a
   chunk boundary and re-fetches at most one window. */
check('PEP labels: the fetch window is LABEL_CONCURRENCY whole chunks (resume lands on a chunk boundary)',
  pep.LABEL_CONCURRENCY >= 2 && pep.LABEL_WINDOW === pep.LABEL_CHUNK * pep.LABEL_CONCURRENCY);
check('PEP labels: wbgetentities requests still carry maxlag (the Wikimedia politeness contract that throttles US when the cluster is loaded)',
  pep.labelsUrl(['Q1', 'Q2']).includes('maxlag=') && pep.labelsUrl(['Q1', 'Q2']).includes('props=labels%7Caliases'));
check('PEP checkpoint: per-class batch failures ride the checkpoint (the zero-holders guard gates on ITS OWN class, not the global counter)', (() => {
  const st = pep.restoreCheckpoint({ v: 1, sinceIso: '2026-08-01T00:00:00Z', harvestedAt: '2026-08-02T00:00:00Z',
    resumeCount: 0, phase: 'holders', positions: [], posByClass: [], holderRows: [],
    classHolders: { minister: 5 }, classBatchFailed: { minister: '2' }, batchTotal: 9, batchFailed: 2,
    next: { classIdx: 1, posIdx: 0 } });
  return st.classBatchFailed.minister === 2 && st.batchFailed === 2;
})());
check('PEP checkpoint: a positions-phase pause restores as phase positions — resume re-enumerates, never sweeps a partial class list', (() => {
  const st = pep.restoreCheckpoint({ v: 1, sinceIso: '2026-08-01T00:00:00Z', harvestedAt: '2026-08-02T00:00:00Z', resumeCount: 0, phase: 'positions', positions: [], posByClass: [], holderRows: [], classHolders: {}, batchTotal: 0, batchFailed: 0, next: { classIdx: 0, posIdx: 0 } });
  return st.phase === 'positions' && st.posByClass.size === 0;
})());
/* The budget used to be asserted under 60 min to duck runs dying at ~63 min.
   That was never runner fragility: the egress block was denying GitHub's
   hosted-compute watchdog and the runner was being RECLAIMED on a fixed timer.
   With *.githubapp.com allowed the ceiling is gone, so the invariant that
   matters is the one that was always the real point — the budget must leave the
   pause enough runway to write its checkpoint before the JOB TIMEOUT kills the
   run, or a pause that fires is still lost work. Asserted against the workflow's
   own timeout so the two can never drift apart silently. */
check('PEP checkpoint: the time budget leaves the pause runway before the job timeout; resumes are bounded', (() => {
  const wf = readFileSync(join(ROOT, '.github/workflows/pep-worldwide.yml'), 'utf8');
  const timeout = Number((wf.match(/^\s*timeout-minutes:\s*(\d+)/m) || [])[1]);
  return Number.isFinite(timeout)
    && pep.PEP_TIME_BUDGET_MIN + 30 <= timeout       // ≥30 min of runway for the pause
    && pep.PEP_MAX_RESUMES >= 4 && pep.RESUME_EXIT_CODE === 75;
})());
/* A cancelled Actions job SIGTERMs the harvest step. Until the signal handler
   existed that threw away everything the link had gathered — two cancelled links
   lost 83 and 34 minutes of WDQS work. Both halves have to hold: the script must
   trap the signal and bank a checkpoint, AND the workflow's persist step must
   still run when the job is cancelled, or the banked checkpoint never gets
   committed. Guarded on success||cancelled, never always(): a hollow-harvest
   refusal must not push. */
check('PEP interrupt: the harvest traps SIGTERM/SIGINT and banks a checkpoint before exiting', (() => {
  const src = readFileSync(join(ROOT, 'scripts/pep-worldwide.mjs'), 'utf8');
  return /process\.on\('SIGTERM'/.test(src) && /process\.on\('SIGINT'/.test(src)
    && /bankProgress\s*=\s*\(\)\s*=>\s*writeCp\('labels'/.test(src)
    && /bankProgress\s*=\s*\(\)\s*=>\s*writeCp\('holders'/.test(src);
})());
check('PEP interrupt: the persist step still commits when the job is CANCELLED (else the banked checkpoint is lost)', (() => {
  const wf = readFileSync(join(ROOT, '.github/workflows/pep-worldwide.yml'), 'utf8');
  const persist = wf.slice(wf.indexOf('Persist the artifact + checkpoint'));
  const gate = (persist.match(/^\s*if:\s*(.+)$/m) || [])[1] || '';
  return /cancelled\(\)/.test(gate) && !/always\(\)/.test(gate);
})());
check('PEP checkpoint: restore revalidates every URL-bound value — a poisoned checkpoint cannot steer queries', (() => {
  const st = pep.restoreCheckpoint({
    v: 1, sinceIso: '2026-08-01T00:00:00Z', harvestedAt: '2026-08-02T00:00:00Z',
    resumeCount: 1, phase: 'holders',
    positions: [['Q5', { label: 'x', country: '', classKey: 'minister' }], ['evil} SERVICE <http://x>', { label: 'x' }]],
    posByClass: [['minister', ['Q5', 'Q00042', 'evil} UNION {', null]]],
    holderRows: [{ person: 'Q7', pos: 'Q5', end: '', classKey: 'minister' }, { person: 'Q7 UNION ?x ?y', pos: 'Q5' }],
    classHolders: { minister: '3' }, batchTotal: '4', batchFailed: '0',
    next: { classIdx: '1', posIdx: '60' }, labelQids: ['Q7', 'Q|8'], names: [['Q7', { name: 'A', aliases: [] }]],
  });
  return st.posByClass.get('minister').join(',') === 'Q5,Q42'   // QIDs re-derive numerically, injections drop
    && st.holderRows.length === 1 && st.labelQids.join(',') === 'Q7'
    && !st.positions.has('evil} SERVICE <http://x>')
    && st.sinceIso === '2026-08-01T00:00:00Z' && st.resumeCount === 2
    && st.next.classIdx === 1 && st.batchTotal === 4 && st.names.get('Q7').name === 'A';
})());

/* ── paginated JSON list reader (ADB debarment register: 10 rows/page, its own
   next-link points at an unreachable internal host, so we page by size/offset) ── */
check('getByPath walks a dotted path and tolerates a missing branch',
  getByPath({ meta: { totalItems: 1533 } }, 'meta.totalItems') === 1533
  && getByPath({ data: [1, 2] }, 'data').length === 2
  && getByPath({}, 'a.b.c') === undefined);
{
  const realFetch = globalThis.fetch;
  // Server caps the page at 10 rows regardless of the requested size (the ADB
  // shape): the reader must still collect the full list by stepping offset by
  // the ACTUAL rows returned, not the size hint.
  const TOTAL = 23;
  globalThis.fetch = async (u) => {
    const off = Number(new URL(u).searchParams.get('offset'));
    const rows = [];
    for (let i = off; i < Math.min(off + 10, TOTAL); i++) rows.push({ id: String(i), attributes: { name: 'FIRM ' + i } });
    return { ok: true, text: async () => JSON.stringify({ meta: { totalItems: TOTAL }, data: rows }) };
  };
  const pg = { sizeParam: 'size', offsetParam: 'offset', size: 250, totalPath: 'meta.totalItems', dataPath: 'data', maxPages: 30 };
  const body = await fetchPaginatedJson('https://apim.example/x?a=1', {}, pg, undefined, 'adb-test');
  const merged = JSON.parse(body);
  check('fetchPaginatedJson collects EVERY page (offset steps by real page length, not the size hint)',
    merged.data.length === TOTAL && merged.data[0].attributes.name === 'FIRM 0' && merged.data[22].attributes.name === 'FIRM 22');
  // maxPages cap: a server that never reports exhaustion (NO total) is bounded.
  let calls = 0;
  globalThis.fetch = async (u) => {
    calls++;
    const off = Number(new URL(u).searchParams.get('offset'));
    return { ok: true, text: async () => JSON.stringify({ data: [{ attributes: { name: 'X' + off } }] }) };
  };
  const capped = JSON.parse(await fetchPaginatedJson('https://apim.example/y', {}, { maxPages: 5, dataPath: 'data', totalPath: 'meta.totalItems' }, undefined, 'cap-test'));
  check('fetchPaginatedJson bounds a feed that reports no total (never an infinite crawl)', capped.data.length === 5 && calls === 5);
  // No truncation by configuration: a server-reported total AUTO-EXTENDS the
  // crawl past maxPages — a register that grows never silently thins.
  const GROWN = 60;
  let calls2 = 0;
  globalThis.fetch = async (u) => {
    calls2++;
    const off = Number(new URL(u).searchParams.get('offset'));
    const rows = [];
    for (let i = off; i < Math.min(off + 10, GROWN); i++) rows.push({ attributes: { name: 'G' + i } });
    return { ok: true, text: async () => JSON.stringify({ meta: { totalItems: GROWN }, data: rows }) };
  };
  const grown = JSON.parse(await fetchPaginatedJson('https://apim.example/z', {}, { maxPages: 3, dataPath: 'data', totalPath: 'meta.totalItems', size: 10 }, undefined, 'grow-test'));
  check('fetchPaginatedJson auto-extends past maxPages to the server-reported total (unlimited coverage)',
    grown.data.length === GROWN && calls2 === 6);
  // ...but a hostile/buggy total is still bounded by the absolute hard cap.
  let calls3 = 0;
  globalThis.fetch = async (u) => {
    calls3++;
    return { ok: true, text: async () => JSON.stringify({ meta: { totalItems: 1e9 }, data: [{ attributes: { name: 'H' + calls3 } }] }) };
  };
  let hostileThrew = '';
  try { await fetchPaginatedJson('https://apim.example/h', {}, { maxPages: 5, dataPath: 'data', totalPath: 'meta.totalItems' }, undefined, 'hostile-test'); }
  catch (e) { hostileThrew = String(e && e.message || e); }
  check('fetchPaginatedJson hard-caps a hostile reported total and THROWS (never a silent partial)',
    calls3 === PAGINATE_HARD_CAP && /page cap/.test(hostileThrew) && /partial list refused/.test(hostileThrew));

  /* A mid-crawl empty page short of the server's own total is a gateway blip:
     retried, not believed. The ADB register served 500+ of 1,533 rows this way
     and passed as a clean load because the partial still cleared minNames. */
  let blipServed = false;
  globalThis.fetch = async (u) => {
    const off = Number(new URL(u).searchParams.get('offset'));
    if (off === 20 && !blipServed) { blipServed = true; return { ok: true, text: async () => JSON.stringify({ meta: { totalItems: 30 }, data: [] }) }; }
    const rows = [];
    for (let i = off; i < Math.min(off + 10, 30); i++) rows.push({ attributes: { name: 'B' + i } });
    return { ok: true, text: async () => JSON.stringify({ meta: { totalItems: 30 }, data: rows }) };
  };
  const blip = JSON.parse(await fetchPaginatedJson('https://apim.example/b', {}, { maxPages: 30, dataPath: 'data', totalPath: 'meta.totalItems', size: 10 }, undefined, 'blip-test'));
  check('fetchPaginatedJson retries a mid-crawl empty page instead of truncating the register',
    blip.data.length === 30 && blipServed === true);

  /* ...and when the blip never clears, the crawl REFUSES rather than returning
     a partial that the count floor might wave through. */
  globalThis.fetch = async (u) => {
    const off = Number(new URL(u).searchParams.get('offset'));
    if (off >= 20) return { ok: true, text: async () => JSON.stringify({ meta: { totalItems: 300 }, data: [] }) };
    const rows = [];
    for (let i = off; i < off + 10; i++) rows.push({ attributes: { name: 'P' + i } });
    return { ok: true, text: async () => JSON.stringify({ meta: { totalItems: 300 }, data: rows }) };
  };
  let partialThrew = '';
  try { await fetchPaginatedJson('https://apim.example/p', {}, { maxPages: 30, dataPath: 'data', totalPath: 'meta.totalItems', size: 10 }, undefined, 'partial-test'); }
  catch (e) { partialThrew = String(e && e.message || e); }
  check('fetchPaginatedJson THROWS on a persistent short crawl — degrades loudly, never a clean-looking partial',
    /stopped at 20 of 300 rows/.test(partialThrew) && /empty page/.test(partialThrew));
  globalThis.fetch = realFetch;
}
/* The ADB source is ENABLED and read via the size/offset paginator; it carries a
   coverage floor so a partial (size hint ignored, cap hit short of the register)
   reports DEGRADED rather than a silent short list. */
const _adb = extraReg.find(s => s.id === 'adb-debarment');
check('adb-debarment is enabled with a size/offset pagination config + coverage floor',
  !!_adb && _adb.enabled === true && _adb.paginate && _adb.paginate.dataPath === 'data'
  && _adb.paginate.totalPath === 'meta.totalItems' && Number(_adb.paginate.maxPages) > 0
  && Number(_adb.minNames) >= 500);

/* ── IDB sanctioned firms/individuals CSV (probe-proven 2026-08-06: CKAN file
   endpoint serves the entity table with Title + Other Name columns) ── */
check('IDB CSV: Title + Other Name index, header skipped, BOM and quoted commas survive', (() => {
  const csv = '﻿Title,Entity,Nationality,Country,From,To,Prohibited Practice,Source,Tipo de sancion del BID,IDB Sanction Source,Other Name\n'
    + 'Juan Domingo Tablares Aliaga,Individual,Bolivia," Bolivia",2009-07-10T00:00,Ongoing," Fraud, Extortion",IDB,Debarment,SCOM,\n'
    + 'Consultora Tecnodinámica S.R.L.,Firm,Paraguay," Paraguay",2009-02-09T00:00,Ongoing," Fraud",IDB,Debarment,SCOM,Tecnodinámica SRL\n';
  const names = parseIdbCsv(csv);
  return names.includes('Juan Domingo Tablares Aliaga')
    && names.includes('Consultora Tecnodinámica S.R.L.') && names.includes('Tecnodinámica SRL')
    && !names.some(n => /^Title$/i.test(n)) && names.length === 3;
})());
check('IDB CSV: a body without the Title column parses to [] (coverage floor takes over)',
  parseIdbCsv('name,alias\nX,Y\n').length === 0 && parseIdbCsv('').length === 0);
const _idb = extraReg.find(s => s.id === 'idb-debarment');
check('idb-debarment is enabled on the probe-proven file endpoint with the idbcsv parser + floor',
  !!_idb && _idb.enabled === true && _idb.parser === 'idbcsv'
  && /data\.iadb\.org\/file\/download\//.test(_idb.url) && Number(_idb.minNames) >= 200);

/* ── source probe (diagnostic instrument — pure functions) ── */
const sp = await import('./../scripts/source-probe.mjs');
const _spReg = [
  { id: 'a', url: 'https://x.example/a', enabled: false },
  { id: 'b', url: 'https://x.example/b', enabled: true },
  { id: 'c', enabled: false },                       // no URL — never probeable
  { id: 'd', url: 'ftp://x.example/d', enabled: false }]; // non-http — never probeable
check('probe: all-disabled selects only disabled sources with http(s) URLs',
  JSON.stringify(sp.probeTargets(_spReg, 'all-disabled').map(s => s.id)) === '["a"]');
check('probe: by-id selects exactly that source, URL required',
  sp.probeTargets(_spReg, 'b').length === 1 && sp.probeTargets(_spReg, 'c').length === 0
  && sp.probeTargets(_spReg, 'nope').length === 0);
check('probe: the real registry loads and the live disabled set is probeable',
  sp.loadRegistry().length >= 40
  && sp.probeTargets(sp.loadRegistry(), 'all-disabled').every(s => /^https?:/.test(s.url)));
check('probe: body sample hex-escapes control bytes so WAF garbage cannot mangle the report',
  sp.sampleBody(Buffer.from('ok' + String.fromCharCode(1) + 'x')) === 'ok\\x01x');
check('probe: JSON reconnaissance yields the key paths a field mapping needs',
  JSON.stringify(sp.jsonKeyPaths('{"value":[{"NomeDaPessoa":"X","Cpf":"1"}]}'))
  === '["value[].NomeDaPessoa = X","value[].Cpf = 1"]'
  && sp.jsonKeyPaths('not json') === null);
const _spMd = sp.renderReport([{ id: 'a', name: 'A', url: 'https://x.example/a', outcome: 'fetched', status: 200, contentType: 'application/json', bytes: 12, jsonPaths: ['k = v'], links: ['https://x.example/list.xml'] }]);
check('probe: report renders outcome, key paths, discovered links, and the diagnostic-only footer',
  _spMd.includes('## a — A') && _spMd.includes('http 200') && _spMd.includes('k = v')
  && _spMd.includes('Data-file links discovered') && _spMd.includes('https://x.example/list.xml')
  && _spMd.includes('Diagnostic only'));
check('probe: link discovery pulls data-file hrefs off an HTML landing page, absolutized', (() => {
  const html = '<a href="/Content/TFSList.xml">XML</a> <a href="download.ashx?fileType=xlsx">XLSX</a> '
    + '<a href="/about">About us</a> <img src="/logo.png">';
  const links = sp.extractDataLinks(html, 'https://tfs.example.gov/Pages/TFSListDownload');
  return links.includes('https://tfs.example.gov/Content/TFSList.xml')
    && links.includes('https://tfs.example.gov/Pages/download.ashx?fileType=xlsx')
    && !links.some(l => l.includes('/about') || l.includes('logo.png'));
})());
check('probe: link discovery surfaces CKAN resource URLs from raw JSON (escaped slashes too)', (() => {
  const jsonBody = '{"result":{"results":[{"resources":[{"format":"CSV","url":"https:\\/\\/mydata.example.org\\/dataset\\/x\\/resource\\/abc\\/download\\/sanctioned.csv"}]}]}}';
  const links = sp.extractDataLinks(jsonBody, 'https://mydata.example.org/api/3/action/package_search');
  return links.includes('https://mydata.example.org/dataset/x/resource/abc/download/sanctioned.csv');
})());
check('probe: link discovery is bounded (never an unbounded report)',
  sp.extractDataLinks(Array.from({ length: 200 }, (_, i) => '<a href="/f' + i + '.csv">x</a>').join(''), 'https://x.example/', { max: 40 }).length === 40);

/* ── enrichment fairness: daily rotation of the processing order — a budget-
   tripped run must never starve the SAME tail subjects forever ── */
check('rotateByDay: rotates by the day offset, preserves every element, and varies day to day', (() => {
  const arr = ['a', 'b', 'c', 'd', 'e'];
  const d0 = rotateByDay(arr, 0), d2 = rotateByDay(arr, 2), d7 = rotateByDay(arr, 7);
  return d0.join('') === 'abcde'                       // day 0 = identity
    && d2.join('') === 'cdeab'                          // shifted start
    && d7.join('') === d2.join('')                      // modular (7 % 5 = 2)
    && [...d2].sort().join('') === 'abcde'              // nothing lost or duplicated
    && rotateByDay([], 3).length === 0
    && rotateByDay(arr, -1).join('') === 'eabcd';       // negative-safe
})());

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
