/* Unit tests for the Sanctions Watch pure logic (no network).
   Usage: node test/sanctions-watch.test.mjs */
import { readFileSync } from 'node:fs';
import { countEntries, buildReport, trackErrorStreaks, extractPublishedDate, tfsNewEntries,
  resolveRescreens, capTfsEntries, SCREEN_WORKFLOWS, TFS_LOG_CAP } from '../scripts/sanctions-watch.mjs';
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

/* ── TFS timeline log: publication → ingestion → re-screen ── */
{
  check('screening workflows for re-screen resolution are declared',
    SCREEN_WORKFLOWS.includes('weekly-adverse-media.yml') && SCREEN_WORKFLOWS.includes('sanctions-screen.yml'));

  // publication date: only the UN consolidated XML carries a machine-readable one
  check('extractPublishedDate reads UN dateGenerated',
    extractPublishedDate('<CONSOLIDATED_LIST dateGenerated="2026-06-16T09:00:00.000Z">') === '2026-06-16');
  check('extractPublishedDate is null for CSV bodies', extractPublishedDate('name,alias\nrow1,a') === null);
  check('extractPublishedDate is null for empty input', extractPublishedDate('') === null);

  const moved = [
    { id: 'un', name: 'UN Consolidated', status: 'changed' },
    { id: 'ofac-sdn', name: 'US OFAC SDN', status: 'new' },
  ];
  const counts = { un: { prev: 1001, now: 1002 } };
  const fetched = {
    un: { ok: true, body: '<CONSOLIDATED_LIST dateGenerated="2026-06-16T00:00:00Z"></CONSOLIDATED_LIST>' },
    'ofac-sdn': { ok: true, body: 'row1,a\nrow2,b\n' },
  };
  const entries = tfsNewEntries(moved, counts, fetched, '2026-06-16T05:07:00Z');
  check('a changed list is pending-rescreen; a first snapshot is a terminal baseline',
    entries.length === 2 && entries[0].status === 'pending-rescreen'
    && entries[1].status === 'baseline' && entries[1].change === 'first snapshot'
    && entries[1].rescreen === null);
  check('entry records detection time + count delta',
    entries[0].detectedAt === '2026-06-16T05:07:00Z' && entries[0].prevCount === 1001 && entries[0].newCount === 1002);
  check('UN entry carries its machine-readable publication date', entries[0].publicationDate === '2026-06-16');
  check('a feed without a publish date records null (MLRO completes from the notice)',
    entries[1].publicationDate === null && entries[1].prevCount === null);

  // re-screen resolution: earliest SUCCESS started at/after detection wins
  const runs = {
    'sanctions-screen.yml': [
      { id: 101, startedAt: '2026-06-16T05:00:00Z' },   // before detection: ignored
      { id: 102, startedAt: '2026-06-16T05:37:00Z' },   // first success after: the re-screen
    ],
    'weekly-adverse-media.yml': [
      { id: 201, startedAt: '2026-06-17T00:07:00Z' },   // later: not chosen
    ],
  };
  const resolved = resolveRescreens(entries, runs);
  check('only the pending entry resolves; the baseline is never touched',
    resolved === 1 && entries[1].status === 'baseline' && entries[1].rescreen === null);
  check('the earliest post-detection success is chosen with its latency',
    entries[0].status === 'complete' && entries[0].rescreen.runId === 102
    && entries[0].rescreen.workflow === 'sanctions-screen.yml' && entries[0].latencyHours === 0.5);
  const unresolved = [{ detectedAt: '2026-06-18T05:07:00Z', status: 'pending-rescreen' }];
  check('an entry with no post-detection success stays pending',
    resolveRescreens(unresolved, runs) === 0 && unresolved[0].status === 'pending-rescreen');
  check('an already-complete entry is not re-resolved', resolveRescreens(entries, runs) === 0);

  // coverage gating: while any workflow's fetched history does not reach back
  // to the detection time, the true earliest re-screen could be unfetched, so
  // the entry stays pending instead of recording an overstated latency.
  const pend2 = [{ detectedAt: '2026-06-16T05:07:00Z', status: 'pending-rescreen' }];
  const covShort = {
    'sanctions-screen.yml':     { complete: false, oldestMs: Date.parse('2026-06-17T00:00:00Z') },
    'weekly-adverse-media.yml': { complete: true,  oldestMs: Date.parse('2026-06-17T00:07:00Z') },
  };
  check('incomplete run history blocks resolution (entry stays pending)',
    resolveRescreens(pend2, runs, covShort) === 0 && pend2[0].status === 'pending-rescreen');
  const covOk = {
    'sanctions-screen.yml':     { complete: false, oldestMs: Date.parse('2026-06-16T05:00:00Z') },
    'weekly-adverse-media.yml': { complete: true,  oldestMs: Date.parse('2026-06-17T00:07:00Z') },
  };
  check('history reaching the detection time allows resolution',
    resolveRescreens(pend2, runs, covOk) === 1 && pend2[0].status === 'complete'
    && pend2[0].rescreen.runId === 102);

  // audit-trail cap: newest entries win
  const many = Array.from({ length: TFS_LOG_CAP + 5 }, (_, i) => ({ n: i }));
  const capped = capTfsEntries(many);
  check('the log caps at the newest ' + TFS_LOG_CAP + ' entries',
    capped.length === TFS_LOG_CAP && capped[0].n === 5 && capped[capped.length - 1].n === TFS_LOG_CAP + 4);

  // the committed seed file parses and has the documented shape
  const seed = JSON.parse(readFileSync(new URL('../data/tfs-update-log.json', import.meta.url), 'utf8'));
  check('data/tfs-update-log.json is seeded with a README and an entries array',
    typeof seed._README === 'string' && Array.isArray(seed.entries));
}

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
