/* Unit tests for the Regulatory Watch pure logic (no network).
   Usage: node test/reg-watch.test.mjs */
import { readFileSync } from 'node:fs';
import { loadSources, extractText, fingerprint, computeChanges, contentChanges, buildReport } from '../scripts/reg-watch.mjs';

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

/* ── Report ── */
const rep = buildReport(changes, '2026-06-16');
check('report names changed sources and the data files to edit',
  rep.includes('Source A') && rep.includes('Source B') && rep.includes('assets/super-data.js'));
check('report folds fetch errors into a no-action note', rep.includes('could not be fetched') && rep.includes('Source D'));
check('report is quiet when nothing moved',
  buildReport([{ id: 'c', name: 'C', status: 'unchanged' }], '2026-06-16').includes('No regulatory content changes detected'));

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
