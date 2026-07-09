/* Unit tests for the Sanctions Watch pure logic (no network).
   Usage: node test/sanctions-watch.test.mjs */
import { readFileSync } from 'node:fs';
import { countEntries, buildReport, trackErrorStreaks } from '../scripts/sanctions-watch.mjs';
import { loadSources, fingerprint, computeChanges, contentChanges } from '../scripts/reg-watch.mjs';

let passed = 0, failed = 0;
function check(name, cond) {
  if (cond) { passed++; console.log('  ok  ' + name); }
  else { failed++; console.log('FAIL  ' + name); }
}

/* Registry */
const sources = loadSources(readFileSync(new URL('../data/sanctions-sources.json', import.meta.url), 'utf8'));
check('registry loads the major lists', sources.length >= 4
  && sources.some(s => s.id === 'ofac-sdn') && sources.some(s => s.id === 'un-consolidated')
  && sources.some(s => s.id === 'uk-ofsi'));
check('every list has an http(s) url', sources.every(s => /^https?:\/\//.test(s.url)));

/* countEntries */
check('countEntries counts CSV data rows (minus header)',
  countEntries('h1,h2\na,b\nc,d\n', 'csv') === 2);
check('countEntries ignores blank trailing CSV lines',
  countEntries('head\nrow1\n\n', 'csv') === 1);
check('countEntries uses a record marker when given',
  countEntries('<DATAID>1</DATAID><DATAID>2</DATAID><DATAID>3</DATAID>', 'xml', '<DATAID>') === 3);
check('countEntries returns null for markerless xml', countEntries('<x/>', 'xml') === null);
check('countEntries counts every row of a headerless CSV (OFAC sdn.csv)',
  countEntries('row1,a\nrow2,b\nrow3,c\n', 'csv', undefined, true) === 3);
check('countEntries returns null for empty body', countEntries('', 'csv') === null);

/* change detection via the shared engine */
const src = [
  { id: 'ofac-sdn', name: 'OFAC SDN', jurisdiction: 'Global', url: 'https://a', type: 'csv' },
  { id: 'un', name: 'UN', jurisdiction: 'Global', url: 'https://b', type: 'xml', marker: '<DATAID>' },
  { id: 'eu', name: 'EU', jurisdiction: 'Global', url: 'https://c', type: 'csv' }
];
const prev = { sources: {
  un: { hash: fingerprint('<DATAID>1</DATAID>'), bytes: 10, count: 1, changedAt: '2026-06-01' },
  eu: { hash: fingerprint('stable eu body'), bytes: 13, count: 3, changedAt: '2026-05-01' }
}};
const fetched = {
  'ofac-sdn': { ok: true, status: 200, body: 'h\nIRAN\nDPRK\n' },                 // new
  un:         { ok: true, status: 200, body: '<DATAID>1</DATAID><DATAID>2</DATAID>' }, // changed (1->2)
  eu:         { ok: false, status: 503, error: 'HTTP 503' }                       // error (keeps prev)
};
const { changes, state } = computeChanges(src, prev, fetched, '2026-06-16');
const by = Object.fromEntries(changes.map(c => [c.id, c]));
check('a brand-new list is flagged new', by['ofac-sdn'].status === 'new');
check('a moved list is flagged changed', by.un.status === 'changed');
check('a fetch error is not a content change and keeps the prior hash',
  by.eu.status === 'error' && state.sources.eu.hash === prev.sources.eu.hash);
check('contentChanges = new + changed only', contentChanges(changes).map(c => c.id).sort().join() === 'ofac-sdn,un');

/* report with count deltas */
const counts = { 'ofac-sdn': { prev: null, now: 2 }, un: { prev: 1, now: 2 }, eu: { prev: 3, now: null } };
const rep = buildReport(changes, '2026-06-16', 'check', counts);
check('report names changed lists with an entry delta and the files to edit',
  rep.includes('OFAC SDN') && rep.includes('UN') && rep.includes('+1') && rep.includes('assets/super-data.js'));
check('report folds fetch errors into a no-action note', rep.includes('could not be fetched') && rep.includes('EU'));
check('seed report reads as a baseline',
  buildReport(changes, '2026-06-16', 'seed', counts).includes('baseline'));
check('report is quiet when nothing moved',
  buildReport([{ id: 'x', name: 'X', status: 'unchanged' }], '2026-06-16', 'check', {}).includes('No designation-list changes detected'));

/* ── persistent-failure streaks (trackErrorStreaks) ── */
{
  const srcs = [{ id: 'un', name: 'UN Consolidated', url: 'https://un.example/list' },
                { id: 'eu', name: 'EU FSF', url: 'https://eu.example/list' }];
  const st = { un: { errStreak: 2 }, eu: { errStreak: 2 } };
  const r = trackErrorStreaks(srcs,
    { un: { ok: false, status: 404 }, eu: { ok: true, status: 200, body: 'x' } }, st, 3);
  check('a source failing its Nth consecutive run crosses the threshold with an unreachable entry',
    r.anyError && r.persistentErrors.length === 1 && r.persistentErrors[0].id === 'un'
    && st.un.errStreak === 3);
  /* The entry must read as UNREACHABLE downstream — status/detail drive
     watch-notify + the Asana card row; without them a dead list renders as
     "content changed". */
  const e = r.persistentErrors[0];
  check('persistent-failure entry carries status/detail/errorStreak for the notifier',
    e.status === 'unreachable' && e.errorStreak === 3 && /unreachable 3 consecutive runs/.test(e.detail));
  check('a successful fetch resets the streak to zero', st.eu.errStreak === 0);
  const r2 = trackErrorStreaks(srcs, { un: { ok: false }, eu: { ok: true, body: 'x' } }, { un: {}, eu: {} }, 3);
  check('a first failure counts but does not alert below the threshold',
    r2.anyError && r2.persistentErrors.length === 0);
}

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
