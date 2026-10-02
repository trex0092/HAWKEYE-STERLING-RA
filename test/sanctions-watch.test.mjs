/* Unit tests for the Sanctions Watch pure logic (no network).
   Usage: node test/sanctions-watch.test.mjs */
import { readFileSync } from 'node:fs';
import { countEntries, buildReport, trackErrorStreaks, extractPublishedDate, tfsNewEntries,
  resolveRescreens, capTfsEntries, sealTfsLog, verifyTfsChain, canonicalJson,
  SCREEN_WORKFLOWS, TFS_LOG_CAP, fetchSource, looksLikeHtmlPage,
  watchedSources, namesFingerprintBody, rescreenTriggers, splitCoveredErrors, WATCHED_FALLBACK_URLS } from '../scripts/sanctions-watch.mjs';
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

/* ── tamper-evident chain over the TFS log (sealTfsLog / verifyTfsChain) ── */
{
  check('canonicalJson is key-order independent',
    canonicalJson({ b: 1, a: [2, null] }) === canonicalJson({ a: [2, null], b: 1 }));

  const mk = (i, status) => ({ id: 'l' + i, list: 'List ' + i, change: 'list changed',
    publicationDate: null, detectedAt: '2026-06-1' + i + 'T05:00:00Z',
    prevCount: i * 10, newCount: i * 10 + 1, rescreen: null,
    status: status || 'pending-rescreen' });
  const log = [mk(1, 'complete'), mk(2), mk(3, 'baseline')];
  log[0].rescreen = { workflow: 'sanctions-screen.yml', runId: 9, startedAt: '2026-06-11T06:00:00Z' };
  log[0].latencyHours = 1;

  const sealed = sealTfsLog(log);
  check('sealing chains every unsealed entry (pre-chain logs migrate in one pass)',
    sealed === 3 && log.every(e => e.chainHash) && log[1].chainPrev === log[0].chainHash
    && log[2].chainPrev === log[1].chainHash && log[0].chainPrev === '');
  check('terminal entries carry a resolution seal; pending entries do not',
    !!log[0].resolutionHash && !log[1].resolutionHash && !!log[2].resolutionHash);
  check('a freshly sealed log verifies clean', verifyTfsChain(log).ok === true);
  check('sealing is idempotent', sealTfsLog(log) === 0 && verifyTfsChain(log).ok === true);
  check('an empty log verifies clean', verifyTfsChain([]).ok === true);

  const t1 = JSON.parse(JSON.stringify(log)); t1[1].detectedAt = '2026-06-12T05:01:00Z';
  const v1 = verifyTfsChain(t1);
  check('editing a detection field breaks the chain at that entry', v1.ok === false && v1.index === 1);

  const t2 = JSON.parse(JSON.stringify(log)); t2[0].latencyHours = 0.1;
  const v2 = verifyTfsChain(t2);
  check('editing a resolution field breaks its seal', v2.ok === false && v2.index === 0);

  const t3 = [log[0], log[2]];
  check('deleting a mid-log entry breaks the linkage', verifyTfsChain(t3).ok === false);

  const t4 = JSON.parse(JSON.stringify(log)); delete t4[2].resolutionHash;
  check('stripping a terminal seal is itself a failure', verifyTfsChain(t4).ok === false);

  check('a capped log (oldest entries dropped) still verifies', verifyTfsChain(log.slice(1)).ok === true);

  // a later resolution re-seals cleanly: pending entry resolves, then seals
  const runs2 = { 'sanctions-screen.yml': [{ id: 77, startedAt: '2026-06-13T09:00:00Z' }] };
  const r2 = resolveRescreens(log, runs2);
  const resealed = sealTfsLog(log);
  check('a post-seal resolution re-seals and verifies',
    r2 === 1 && resealed === 1 && !!log[1].resolutionHash && verifyTfsChain(log).ok === true);

  // and the workflow actually runs the verifier daily, before the watch
  const wyml = readFileSync(new URL('../.github/workflows/sanctions-watch.yml', import.meta.url), 'utf8');
  check('the watch workflow verifies log integrity before each run',
    wyml.indexOf('sanctions-watch.mjs verify-log') !== -1
    && wyml.indexOf('verify-log') < wyml.indexOf('Run sanctions watch'));
}

// EU FSF since 1 Oct 2026: the public token redirects to EU Login. The watch
// must never fingerprint a sign-in/HTML page as a list, must name the cause,
// and must escalate a sign-in gate at once (not after the 3-run streak).
{
  const resp = (status, body, { location, cookies = [] } = {}) => ({
    status, ok: status >= 200 && status < 300,
    headers: { get: k => (k === 'location' ? (location || null) : null), getSetCookie: () => cookies },
    text: async () => body,
  });
  const csvSrc = { id: 'eu-fsf', name: 'EU', type: 'csv', url: 'https://list.example/content?token=pub', tokenEnv: 'EU_FSF_TOKEN' };
  const html = await fetchSource(csvSrc, 5000, { fetchImpl: async () => resp(200, '<!DOCTYPE html><html><title>EU Login</title>') });
  check('watch: an HTML page served for a CSV list is an error, never fingerprinted', !html.ok && html.gated && html.body === '' && /HTML page/.test(html.error));
  check('watch: XML lists are not mistaken for HTML', !looksLikeHtmlPage('<?xml version="1.0"?><sanctions/>') && looksLikeHtmlPage('\uFEFF  <html lang="en">'));
  const loopErr = new TypeError('fetch failed', { cause: new Error('redirect count exceeded') });
  const gateHops = {
    'https://list.example/content?token=pub': resp(307, '', { location: 'https://sso.example/cas/login?id=1', cookies: ['s=1'] }),
    'https://sso.example/cas/login?id=1': resp(200, '<html>login</html>'),
  };
  const gated = await fetchSource(csvSrc, 5000, { fetchImpl: async (u, o) => { if (o.redirect === 'follow') throw loopErr; return gateHops[u]; } });
  check('watch: a redirect loop ending on a sign-in page is named, not a bare "fetch failed"', !gated.ok && gated.gated && /requires a sign-in/.test(gated.error));
  const ok = await fetchSource(csvSrc, 5000, { fetchImpl: async (u, o) => { if (o.redirect === 'follow') throw loopErr; return resp(200, 'Entity;Name\n1;X'); } });
  check('watch: a cookie-gated loop that resolves to the list is fingerprinted normally', ok.ok && ok.body.startsWith('Entity'));
  const plainErr = await fetchSource(csvSrc, 5000, { fetchImpl: async () => { throw new TypeError('fetch failed', { cause: Object.assign(new Error('getaddrinfo ENOTFOUND'), { code: 'ENOTFOUND' }) }); } });
  check('watch: a network failure carries its cause chain and is not a sign-in gate', !plainErr.ok && /ENOTFOUND/.test(plainErr.error) && !plainErr.gated);
  let seenUrl = '';
  const prevTok = process.env.EU_FSF_TOKEN;
  process.env.EU_FSF_TOKEN = 'personal123';
  await fetchSource(csvSrc, 5000, { fetchImpl: async u => { seenUrl = u; return resp(200, 'a,b\n1,2'); } });
  if (prevTok === undefined) delete process.env.EU_FSF_TOKEN; else process.env.EU_FSF_TOKEN = prevTok;
  check('watch: the personal token, when set, is used for the request', new URL(seenUrl).searchParams.get('token') === 'personal123');
  const st = { 'eu-fsf': { errStreak: 0 } };
  const r1 = trackErrorStreaks([csvSrc], { 'eu-fsf': gated }, st, 3);
  check('watch: a sign-in gate escalates on the FIRST run, naming the secret',
    r1.persistentErrors.length === 1 && r1.persistentErrors[0].status === 'sign-in required' && /EU_FSF_TOKEN/.test(r1.persistentErrors[0].detail));
  const r2 = trackErrorStreaks([csvSrc], { 'eu-fsf': plainErr }, { 'eu-fsf': { errStreak: 0 } }, 3);
  check('watch: an ordinary outage still waits for the streak threshold', r2.persistentErrors.length === 0 && r2.anyError);
  const wf = readFileSync(new URL('../.github/workflows/sanctions-watch.yml', import.meta.url), 'utf8');
  check('watch: the workflow passes EU_FSF_TOKEN to the check step', /EU_FSF_TOKEN: \$\{\{ secrets\.EU_FSF_TOKEN \}\}\n\s+run: node scripts\/sanctions-watch\.mjs "\$MODE"/.test(wf));
}

/* Declared fallbacks are watched (eu-fsf -> fr-dgt while EU Login gates the
   EU list), fingerprinted by name set, and a first snapshot never re-screens. */
{
  const core = [
    { id: 'eu-fsf', name: 'EU', url: 'https://example.invalid/eu', type: 'csv', fallbackSourceId: 'fr-dgt' },
    { id: 'uk-ofsi', name: 'UK', url: 'https://example.invalid/uk', type: 'csv' },
  ];
  const extra = [
    { id: 'fr-dgt', name: 'FR DGT', url: 'https://example.invalid/tampered', type: 'json', parser: 'json' },
    { id: 'zz-other', name: 'Not a fallback', url: 'https://example.invalid/zz', type: 'json', parser: 'json' },
    { id: 'off', name: 'Disabled', url: 'https://example.invalid/off', enabled: false },
  ];
  const w = watchedSources(core, extra);
  check('watch adds a core list\'s declared fallback, and only that', w.map(s => s.id).join() === 'eu-fsf,uk-ofsi,fr-dgt');
  check('a watched fallback is fingerprinted by name set and names its primary',
    w[2].fingerprintBy === 'names' && w[2].fallbackFor === 'eu-fsf' && w[0].fingerprintBy === undefined);
  check('a watched fallback is fetched from the in-code allowlist, never the registry url',
    w[2].url === WATCHED_FALLBACK_URLS['fr-dgt'] && w[2].parser === 'json' && w[2].name === 'FR DGT');
  check('a declared fallback missing from the allowlist is not watched',
    watchedSources([{ id: 'a', name: 'A', url: 'https://x.invalid', fallbackSourceId: 'zz-other' }], extra).length === 1);
  check('a fallback that is disabled or absent is not invented',
    watchedSources([{ id: 'a', name: 'A', url: 'https://x.invalid', fallbackSourceId: 'off' }], extra).length === 1);
  const real = JSON.parse(readFileSync(new URL('../data/sanctions-sources.json', import.meta.url), 'utf8')).sources;
  const realExtra = JSON.parse(readFileSync(new URL('../data/sanctions-extra.json', import.meta.url), 'utf8')).sources;
  check('the live registry watches fr-dgt as the EU fallback', watchedSources(real, realExtra).some(s => s.id === 'fr-dgt' && s.fallbackFor === 'eu-fsf'));
  check('every allowlisted watch URL equals its registry entry (no drift)',
    Object.entries(WATCHED_FALLBACK_URLS).every(([id, url]) => (realExtra.find(s => s.id === id) || {}).url === url));
  check('every fallback the core registry declares is allowlisted for the watch',
    real.filter(s => s.fallbackSourceId).every(s => Object.prototype.hasOwnProperty.call(WATCHED_FALLBACK_URLS, s.fallbackSourceId)));

  const src = { id: 'fr-dgt', parser: 'json', type: 'json' };
  const a = namesFingerprintBody(src, JSON.stringify({ published: '2026-10-01T08:00', items: [{ name: 'Bravo Ltd' }, { name: 'Alpha Co' }] }));
  const b = namesFingerprintBody(src, JSON.stringify({ published: '2026-10-02T08:00', items: [{ name: 'Alpha Co' }, { name: 'Bravo  Ltd' }] }));
  const c = namesFingerprintBody(src, JSON.stringify({ published: '2026-10-02T08:00', items: [{ name: 'Alpha Co' }, { name: 'Bravo Ltd' }, { name: 'Charlie SA' }] }));
  check('name-set fingerprint ignores a new publication timestamp and record order', a && b && a.text === b.text && a.count === 2);
  check('name-set fingerprint moves when a designation is added', c && c.text !== a.text && c.count === 3);
  check('name-set fingerprint of an unparseable body is null (treated as an error, not an empty list)',
    namesFingerprintBody(src, '<html>sign in</html>') === null && namesFingerprintBody(src, '{}') === null);
  check('name-set fingerprints hash the same way through the shared fingerprint()', fingerprint(a.text) === fingerprint(b.text) && fingerprint(a.text) !== fingerprint(c.text));

  const ch = [{ id: 'x', status: 'new' }, { id: 'y', status: 'changed' }, { id: 'z', status: 'unchanged' }, { id: 'e', status: 'error' }];
  check('only a CHANGED list triggers an immediate re-screen (a first snapshot is a baseline)',
    rescreenTriggers(ch).map(c => c.id).join() === 'y' && rescreenTriggers([]).length === 0);
}

{
  const srcs = [
    { id: 'eu-fsf', name: 'EU', fallbackSourceId: 'fr-dgt' },
    { id: 'uk-ofsi', name: 'UK' },
    { id: 'fr-dgt', name: 'FR' },
  ];
  const errs = [{ id: 'eu-fsf', name: 'EU', status: 'sign-in required', streak: 1 }, { id: 'uk-ofsi', name: 'UK', status: 'unreachable', streak: 3 }];
  const ok = splitCoveredErrors(errs, srcs, { 'fr-dgt': { ok: true } });
  check('a gated primary with a clean fallback is covered, not escalated',
    ok.covered.map(e => e.id).join() === 'eu-fsf' && ok.covered[0].fallback === 'fr-dgt' && ok.blind.map(e => e.id).join() === 'uk-ofsi');
  const down = splitCoveredErrors(errs, srcs, { 'fr-dgt': { ok: false } });
  check('a gated primary whose fallback is also down stays a persistent error',
    down.covered.length === 0 && down.blind.map(e => e.id).sort().join() === 'eu-fsf,uk-ofsi');
  check('a list with no declared fallback is never covered', splitCoveredErrors([errs[1]], srcs, { 'fr-dgt': { ok: true } }).covered.length === 0);
}

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
