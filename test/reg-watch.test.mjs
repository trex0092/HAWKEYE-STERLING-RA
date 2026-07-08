/* Unit tests for the Regulatory Watch pure logic (no network).
   Usage: node test/reg-watch.test.mjs */
import { readFileSync } from 'node:fs';
import {
  loadSources, extractText, fingerprint, denoise, computeChanges, contentChanges, buildReport,
  persistentErrors, stateMateriallyChanged, snapshotAgeDays, rawSnapshotUrl, fetchWithFallback,
  captureAcceptable, tsToIsoDate, spnAuthHeader, diffTexts, ERROR_STREAK_ALERT, SNAPSHOT_STALE_DAYS
} from '../scripts/reg-watch.mjs';

let passed = 0, failed = 0;
function check(name, cond) {
  if (cond) { passed++; console.log('  ok  ' + name); }
  else { failed++; console.log('FAIL  ' + name); }
}

/* ── Registry is valid and UAE-weighted ── */
const sources = loadSources(readFileSync(new URL('../data/reg-sources.json', import.meta.url), 'utf8'));
check('registry loads with no duplicate ids and valid urls', sources.length >= 15);
check('registry leads with UAE sources (UAE-weighted)', sources[0].jurisdiction === 'UAE'
  && sources.filter(s => s.jurisdiction === 'UAE').length >= 6);
check('registry has worldwide coverage too', sources.some(s => s.jurisdiction === 'Global')
  && sources.some(s => s.id === 'fatf-guidance') && sources.some(s => s.id === 'ofac'));
check('every source carries a narrative', sources.every(s => typeof s.narrative === 'string' && s.narrative.length > 40));
check('loadSources rejects duplicate ids', (() => {
  try { loadSources({ sources: [{ id: 'x', name: 'X', url: 'https://a' }, { id: 'x', name: 'Y', url: 'https://b' }] }); return false; }
  catch { return true; }
})());
check('loadSources rejects non-http urls', (() => {
  try { loadSources({ sources: [{ id: 'x', name: 'X', url: 'ftp://a' }] }); return false; } catch { return true; }
})());

/* ── Fingerprint ignores markup churn, tracks text changes ── */
check('extractText strips tags/scripts and collapses whitespace',
  extractText('<div> Hello   <b>World</b><script>x=1</script> </div>') === 'hello world');
check('fingerprint is stable across markup-only changes',
  fingerprint('<p>Circular 8 of 2021 applies.</p>') === fingerprint('<section>\n  Circular 8 of 2021 applies.\n</section>'));
check('fingerprint moves when the text changes',
  fingerprint('<p>threshold AED 55,000</p>') !== fingerprint('<p>threshold AED 60,000</p>'));

/* denoise: volatile timestamps/sessions/nonces do not move the fingerprint,
   but real regulatory figures (5-6 digit thresholds) still do */
check('denoise: an updated timestamp does not move the fingerprint',
  fingerprint('<p>Updated 2026-06-16T10:00:00Z. CDD applies.</p>')
    === fingerprint('<p>Updated 2026-06-16T11:30:05Z. CDD applies.</p>'));
check('denoise: a rotating session token does not move the fingerprint',
  fingerprint('<a href="/x?sessionid=abc123def">Guidance</a>')
    === fingerprint('<a href="/x?sessionid=zzz999qqq">Guidance</a>'));
check('denoise: a long hex nonce is stripped',
  fingerprint('rule <span>0123456789abcdef01234567</span> text')
    === fingerprint('rule <span>ffffffffffffffffffffffff</span> text'));
check('denoise: real 5-digit thresholds are preserved (not stripped)',
  denoise('threshold aed 55000').includes('55000')
    && fingerprint('<p>aed 55000</p>') !== fingerprint('<p>aed 60000</p>'));

/* ── computeChanges: new / changed / unchanged / error ── */
const src = [
  { id: 'a', name: 'Source A', jurisdiction: 'UAE', url: 'https://a' },
  { id: 'b', name: 'Source B', jurisdiction: 'Global', url: 'https://b' },
  { id: 'c', name: 'Source C', jurisdiction: 'Global', url: 'https://c' },
  { id: 'd', name: 'Source D', jurisdiction: 'UAE', url: 'https://d' }
];
const prev = { updated: '2026-06-01', sources: {
  b: { hash: fingerprint('old B body'), bytes: 9, changedAt: '2026-06-01' },
  c: { hash: fingerprint('stable C body'), bytes: 13, changedAt: '2026-05-01' },
  d: { hash: fingerprint('old D body'), bytes: 9, changedAt: '2026-05-01' }
}};
const fetched = {
  a: { ok: true, status: 200, body: 'brand new A body' },          // new
  b: { ok: true, status: 200, body: 'updated B body now' },        // changed
  c: { ok: true, status: 200, body: 'stable C body' },             // unchanged
  d: { ok: false, status: 404, error: 'HTTP 404' }                 // error (was known)
};
const { changes, state } = computeChanges(src, prev, fetched, '2026-06-16');
const byId = Object.fromEntries(changes.map(c => [c.id, c]));
check('new source flagged as new', byId.a.status === 'new');
check('changed source flagged as changed', byId.b.status === 'changed' && byId.b.prevHash !== byId.b.newHash);
check('unchanged source not flagged', byId.c.status === 'unchanged');
check('fetch error is not a content change', byId.d.status === 'error');
check('contentChanges returns only new + changed', contentChanges(changes).map(c => c.id).sort().join() === 'a,b');
check('state records new hashes + checkedAt for all, keeps old hash on error',
  state.sources.a.hash && state.sources.b.changedAt === '2026-06-16'
  && state.sources.c.changedAt === '2026-05-01'   // unchanged keeps original changedAt
  && state.sources.d.hash === prev.sources.d.hash && state.sources.d.error.includes('404'));

/* error on a previously-unknown source does not crash and is not a content change */
const e2 = computeChanges([{ id: 'z', name: 'Z', url: 'https://z' }], { sources: {} },
  { z: { ok: false, status: 'error', error: 'timeout' } }, '2026-06-16');
check('unknown source error handled cleanly', e2.changes[0].status === 'error' && e2.state.sources.z.hash === null);

/* recovered: first good snapshot after a prior error records silently, no PR */
const rec = computeChanges([{ id: 'z', name: 'Z', url: 'https://z' }],
  { sources: { z: { hash: null, bytes: 0, changedAt: null, status: 404, error: 'HTTP 404' } } },
  { z: { ok: true, status: 200, body: 'now reachable content' } }, '2026-06-16');
check('recovery after error is "recovered", not a content change',
  rec.changes[0].status === 'recovered' && rec.state.sources.z.hash && contentChanges(rec.changes).length === 0);

/* an "ok" 200 with empty/markup-only body is NOT a content change and never overwrites a good hash */
const goodHash = fingerprint('the real circular text');
const empty = computeChanges([{ id: 'p', name: 'P', url: 'https://p' }],
  { sources: { p: { hash: goodHash, bytes: 20, changedAt: '2026-06-01', status: 200 } } },
  { p: { ok: true, status: 200, body: '<html><head><style>x{}</style></head><body></body></html>' } }, '2026-06-16');
check('empty 200 is treated as error and keeps the last good hash',
  empty.changes[0].status === 'error' && empty.changes[0].detail.includes('empty')
  && empty.state.sources.p.hash === goodHash && contentChanges(empty.changes).length === 0);

/* seed-mode report reads as a baseline, not "no changes" */
const seedRep = buildReport([{ id: 'a', name: 'A', status: 'new', newHash: 'h' }, { id: 'b', name: 'B', status: 'error', detail: 'HTTP 403' }], '2026-06-16', 'seed');
check('seed report reads as a baseline with the seeded count', seedRep.includes('baseline')
  && seedRep.includes('Recorded baseline fingerprints for **1**'));

/* ── Report ── */
const rep = buildReport(changes, '2026-06-16');
check('report names changed sources and the data files to edit',
  rep.includes('Source A') && rep.includes('Source B') && rep.includes('assets/super-data.js'));
check('report folds fetch errors into a no-action note', rep.includes('could not be fetched') && rep.includes('Source D'));
check('report is quiet when nothing moved',
  buildReport([{ id: 'c', name: 'C', status: 'unchanged' }], '2026-06-16').includes('No regulatory content changes detected'));

/* ── Error streaks: consecutive failures accumulate, success clears ── */
const zSrc = [{ id: 'z', name: 'Z', jurisdiction: 'Global', url: 'https://z' }];
const fail = { z: { ok: false, status: 403, error: 'HTTP 403' } };
let st = { sources: { z: { hash: fingerprint('good z'), bytes: 6, changedAt: '2026-06-01', status: 200 } } };
let streaks = [];
for (let day = 1; day <= ERROR_STREAK_ALERT + 1; day++) {
  const r = computeChanges(zSrc, st, fail, '2026-07-0' + day);
  streaks.push(r.changes[0].errorStreak);
  st = r.state;
}
check('error streak counts consecutive failed runs', streaks.join() === '1,2,3,4');
check('persistentErrors fires exactly once, when the streak crosses ' + ERROR_STREAK_ALERT,
  (() => {
    let s2 = { sources: { z: { hash: 'h', bytes: 5, changedAt: '2026-06-01', status: 200 } } };
    const hits = [];
    for (let day = 1; day <= ERROR_STREAK_ALERT + 2; day++) {
      const r = computeChanges(zSrc, s2, fail, '2026-07-0' + day);
      hits.push(persistentErrors(r.changes).length);
      s2 = r.state;
    }
    return hits.join() === '0,0,1,0,0';
  })());
check('a clean fetch clears the error streak and stale error fields', (() => {
  const r = computeChanges(zSrc, st, { z: { ok: true, status: 200, body: 'good z' } }, '2026-07-09');
  const rec = r.state.sources.z;
  return rec.errorStreak === undefined && rec.error === undefined && r.changes[0].status === 'unchanged';
})());

/* ── contentAsOf: archive-recovered content keeps the CAPTURE's date ── */
const capSrc = [{ id: 'w', name: 'W', jurisdiction: 'Global', url: 'https://w' }];
const capRec = computeChanges(capSrc, { sources: { w: { hash: null, bytes: 0, changedAt: null, status: 403, error: 'HTTP 403' } } },
  { w: { ok: true, status: 200, body: 'captured content', via: 'web.archive.org snapshot 20260627105659', snapshotTs: '20260627105659' } }, '2026-07-08');
check('REGRESSION: recovery via an archive capture records contentAsOf as the capture date, not the recording day',
  capRec.state.sources.w.contentAsOf === '2026-06-27' && capRec.state.sources.w.changedAt === '2026-07-08');
check('the same capture stays acceptable against that baseline (no error flip-flop)',
  captureAcceptable('20260627105659', capRec.state.sources.w.contentAsOf, Date.UTC(2026, 6, 9)));
check('a direct fetch advances contentAsOf forward, never backward', (() => {
  const r = computeChanges(capSrc, capRec.state, { w: { ok: true, status: 200, body: 'captured content' } }, '2026-07-09');
  return r.state.sources.w.contentAsOf === '2026-07-09' && r.changes[0].status === 'unchanged';
})());

/* ── stateMateriallyChanged: checkedAt alone is not material ── */
const base1 = { sources: { a: { hash: 'h', bytes: 5, checkedAt: '2026-07-01', changedAt: '2026-06-01', status: 200 } } };
const base2 = { sources: { a: { hash: 'h', bytes: 5, checkedAt: '2026-07-02', changedAt: '2026-06-01', status: 200 } } };
const base3 = { sources: { a: { hash: 'h', bytes: 5, checkedAt: '2026-07-02', changedAt: '2026-06-01', status: 403, error: 'HTTP 403', errorStreak: 1 } } };
check('checkedAt-only refresh is not a material state change', !stateMateriallyChanged(base1, base2));
check('an advancing error streak IS a material state change', stateMateriallyChanged(base2, base3));

/* ── Wayback fallback plumbing ── */
check('rawSnapshotUrl adds the id_ flag and upgrades to https',
  rawSnapshotUrl('http://web.archive.org/web/20260707120000/https://www.centralbank.ae/en/cbuae-amlcft/')
    === 'https://web.archive.org/web/20260707120000id_/https://www.centralbank.ae/en/cbuae-amlcft/');
check('snapshotAgeDays: malformed timestamp is Infinity (never trusted)',
  snapshotAgeDays('nonsense') === Infinity && snapshotAgeDays('') === Infinity);
check('snapshotAgeDays: a fresh capture is within the stale window', (() => {
  const now = Date.UTC(2026, 6, 8, 12, 0, 0);
  return snapshotAgeDays('20260707120000', now) <= SNAPSHOT_STALE_DAYS
    && snapshotAgeDays('20260601120000', now) > SNAPSHOT_STALE_DAYS;
})());
check('tsToIsoDate converts a wayback timestamp, rejects garbage',
  tsToIsoDate('20260627105659') === '2026-06-27' && tsToIsoDate('junk') === null);
check('captureAcceptable: reversed-alert guard — a capture older than the recorded content is rejected', (() => {
  const now = Date.UTC(2026, 6, 8, 12, 0, 0);
  return !captureAcceptable('20260627105659', '2026-07-01', now)     /* older than baseline: rejected */
    && captureAcceptable('20260702120000', '2026-07-01', now)        /* newer than baseline: accepted */
    && captureAcceptable('20260627105659', null, now)                /* no baseline: any recent capture beats zero coverage */
    && !captureAcceptable('20220702120000', null, now);              /* ...but never past the hard age cap */
})());
check('BASELINE_SNAPSHOT_MAX_DAYS caps baseline captures', (() => {
  const now = Date.UTC(2026, 6, 8, 12, 0, 0);
  return captureAcceptable('20260501120000', null, now)              /* 68d — inside the cap */
    && !captureAcceptable('20260401120000', null, now);              /* 98d — outside */
})());
check('spnAuthHeader builds a LOW header from valid keys, rejects garbage',
  spnAuthHeader('abc123:s3cr3t') === 'LOW abc123:s3cr3t'
  && spnAuthHeader(' abc:def ') === 'LOW abc:def'
  && spnAuthHeader('') === null && spnAuthHeader(undefined) === null
  && spnAuthHeader('nocolon') === null && spnAuthHeader('a:b:c') === null && spnAuthHeader('has space:x') === null);
check('fetchWithFallback returns the direct response when it succeeds (no wayback call)',
  await (async () => {
    let calls = 0;
    const fn = async () => { calls++; return { ok: true, status: 200, body: 'direct', error: null }; };
    const r = await fetchWithFallback('https://x', fn);
    return r.body === 'direct' && !r.via && calls === 1;
  })());

/* ── diffTexts: detailed change delivery ── */
const oldPage = 'the reporting threshold is aed 55,000 for cash transactions. registration via goaml is mandatory. contact us on the portal.';
const newPage = 'the reporting threshold is aed 60,000 for cash transactions. registration via goaml is mandatory. new circular 4 of 2026 applies to dealers. contact us on the portal.';
const dd = diffTexts(oldPage, newPage);
check('diffTexts reports the addition verbatim',
  dd.added.some(s => s.includes('circular 4 of 2026')) && dd.addedCount === 2);
check('diffTexts reports the deletion verbatim (a modification = one removal + one addition)',
  dd.removed.some(s => s.includes('55,000')) && dd.added.some(s => s.includes('60,000')) && dd.removedCount === 1);
check('diffTexts is quiet when nothing moved', (() => {
  const q = diffTexts(oldPage, oldPage);
  return q.addedCount === 0 && q.removedCount === 0;
})());
check('diffTexts caps excerpts but keeps true counts', (() => {
  const many = Array.from({ length: 12 }, (_, i) => 'brand new obligation number ' + i + ' applies to dealers.').join(' ');
  const r = diffTexts('', many, { maxExcerpts: 4 });
  return r.added.length === 4 && r.addedCount === 12;
})());
check('diffTexts ignores sub-20-char fragments (nav churn)', (() => {
  const r = diffTexts('home. about. news. the substantive regulatory obligation text stays here.', 'menu. login. the substantive regulatory obligation text stays here.');
  return r.addedCount === 0 && r.removedCount === 0;
})());

/* ── Report: persistent failures are loud, transient ones stay folded ── */
const loudRep = buildReport([
  { id: 'a', name: 'Alive', status: 'unchanged' },
  { id: 'b', name: 'Blip', status: 'error', detail: 'HTTP 500', errorStreak: 1, url: 'https://b' },
  { id: 'c', name: 'Dead', status: 'error', detail: 'HTTP 403', errorStreak: ERROR_STREAK_ALERT, url: 'https://c' }
], '2026-07-08');
check('report shouts about persistently unreachable sources',
  loudRep.includes('persistently unreachable') && loudRep.includes('Dead')
  && loudRep.includes('failing ' + ERROR_STREAK_ALERT + ' consecutive runs'));
check('report keeps one-off blips in the folded no-action note',
  loudRep.includes('could not be fetched') && loudRep.includes('Blip'));

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
