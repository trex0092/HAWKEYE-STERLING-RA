/* Unit tests for the Link / citation health pure logic (no network).
   Usage: node test/link-check.test.mjs */
import { collectUrls, isDead, summarize, buildReport, ALLOWLIST, probe } from '../scripts/link-check.mjs';

let passed = 0, failed = 0;
function check(name, cond) {
  if (cond) { passed++; console.log('  ok  ' + name); }
  else { failed++; console.log('FAIL  ' + name); }
}

/* collectUrls: JSON registry uses the url field; markdown falls back to regex */
const files = {
  'data/reg-sources.json': JSON.stringify({ sources: [
    { id: 'a', url: 'https://example.com/a' },
    { id: 'b', url: 'https://example.com/b' }
  ]}),
  'data/sanctions-sources.json': JSON.stringify({ sources: [{ id: 'c', url: 'https://example.com/a' }] }), // dup of a
  'docs/x.md': 'See https://docs.example.com/page. and (https://example.com/b) again'
};
const urls = collectUrls(files);
const map = Object.fromEntries(urls.map(u => [u.url, u.sources]));
check('extracts registry urls and dedupes across files',
  urls.length === 3 && map['https://example.com/a'].length === 2
  && map['https://example.com/a'].includes('data/reg-sources.json')
  && map['https://example.com/a'].includes('data/sanctions-sources.json'));
check('strips trailing punctuation from markdown urls',
  map['https://docs.example.com/page'] && !map['https://docs.example.com/page.']);
check('markdown url with surrounding parens is captured cleanly',
  !!map['https://example.com/b'] && map['https://example.com/b'].includes('docs/x.md'));
/* trailing markdown backtick is stripped so `https://x/` isn't probed with it */
const bt = collectUrls({ 'docs/y.md': 'goAML at `https://www.uaefiu.gov.ae/en/` resolves' });
check('strips trailing markdown backtick from urls',
  bt.some(u => u.url === 'https://www.uaefiu.gov.ae/en/') && !bt.some(u => u.url.endsWith('`')));

/* isDead: 2xx/3xx ok; anti-bot/method/format/geo + transient gateway
   (401/403/405/406/415/418/429/451/502/503/504) tolerated; 404 + unreachable dead */
check('200 is alive', isDead({ ok: true, status: 200 }) === false);
check('403 anti-bot is tolerated (not dead)', isDead({ ok: false, status: 403 }) === false);
check('429 rate-limit is tolerated', isDead({ ok: false, status: 429 }) === false);
check('415 unsupported-media (anti-bot HEAD/GET) is tolerated', isDead({ ok: false, status: 415 }) === false);
check('418 teapot (anti-bot) is tolerated', isDead({ ok: false, status: 418 }) === false);
check('451 geo-block is tolerated', isDead({ ok: false, status: 451 }) === false);
check('503 transient unavailable is tolerated', isDead({ ok: false, status: 503 }) === false);
check('504 gateway timeout (UN consolidated-list page) is tolerated', isDead({ ok: false, status: 504 }) === false);
check('404 is dead', isDead({ ok: false, status: 404 }) === true);
check('500 internal error is still dead (not a transient gateway status)', isDead({ ok: false, status: 500 }) === true);
check('unreachable is dead', isDead({ ok: false, status: null, error: 'ENOTFOUND' }) === true);

/* summarize + report */
const results = [
  { url: 'https://ok.example', sources: ['data/reg-sources.json'], ok: true, status: 200 },
  { url: 'https://dead.example', sources: ['docs/x.md'], ok: false, status: 404 },
  { url: 'https://gone.example', sources: ['data/reg-sources.json'], ok: false, status: null, error: 'ENOTFOUND' }
];
const s = summarize(results);
check('summarize counts dead vs ok', s.total === 3 && s.dead === 2 && s.ok === 1);
/* allowlisted, verified-good-but-probe-hostile sources are excluded from dead */
const allowUrl = [...ALLOWLIST][0];
const sAllow = summarize([{ url: allowUrl, sources: ['data/sanctions-sources.json'], ok: false, status: 404 }]);
check('ALLOWLIST source is not counted dead even on a 404 probe', sAllow.dead === 0);
/* allowlisted source that the probe could not reach at all (aborted/timeout,
   null status) is still excluded — e.g. the slow UN SC consolidated-list page */
const slowAllowUrl = 'https://www.un.org/securitycouncil/content/un-sc-consolidated-list';
const sSlow = summarize([{ url: slowAllowUrl, sources: ['data/reg-sources.json'], ok: false, status: null, error: 'This operation was aborted' }]);
check('ALLOWLIST source aborted/timed-out by the probe is not counted dead',
  ALLOWLIST.has(slowAllowUrl) && sSlow.dead === 0);
const rep = buildReport(results, '2026-06-16');
check('report lists dead urls with status + source file', rep.includes('https://dead.example')
  && rep.includes('404') && rep.includes('docs/x.md') && rep.includes('2 of 3'));
check('clean report says no dead citations',
  buildReport([results[0]], '2026-06-16').includes('No dead citations'));

/* probe must retry with GET when HEAD returns a non-OK status (not only 405/501) —
   some servers 404/403/5xx a HEAD but serve on GET; returning the HEAD status
   would mis-report a live citation as dead. */
const _realFetch = globalThis.fetch;
await (async () => {
  const calls = [];
  globalThis.fetch = async (url, opts) => { calls.push(opts.method); return { ok: opts.method === 'GET', status: opts.method === 'GET' ? 200 : 404 }; };
  const r = await probe('https://example.test/resource', 1000);
  check('probe retries GET after a 404 HEAD and reports the live link', calls.join(',') === 'HEAD,GET' && r.ok === true && r.status === 200 && isDead(r) === false);
  globalThis.fetch = async () => ({ ok: false, status: 404 });
  const d = await probe('https://example.test/gone', 1000);
  check('probe still reports a truly dead link (GET also 404)', d.ok === false && isDead(d) === true);
})();
globalThis.fetch = _realFetch;

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
