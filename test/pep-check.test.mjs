/* Unit tests for PEP screening pure logic (no network).
   Usage: node test/pep-check.test.mjs */
import { pepSearchUrl, scorePep, PEP_KEYWORDS, checkPep } from '../scripts/pep-check.mjs';

let passed = 0, failed = 0;
function check(name, cond) {
  if (cond) { passed++; console.log('  ok  ' + name); }
  else { failed++; console.log('FAIL  ' + name); }
}

check('pepSearchUrl hits the Wikidata entity-search API with the name',
  pepSearchUrl('Vladimir Putin').startsWith('https://www.wikidata.org/w/api.php?action=wbsearchentities') &&
  decodeURIComponent(pepSearchUrl('Vladimir Putin')).includes('search=Vladimir Putin'));

const pol = scorePep('Vladimir Putin', { search: [
  { id: 'Q7747', label: 'Vladimir Putin', description: 'President of Russia (born 1952)' }
] });
check('scorePep flags a matching political description', pol.hit === true && pol.band === 'medium' && pol.match.id === 'Q7747');

const namesake = scorePep('Vladimir Putin', { search: [
  { id: 'Q1', label: 'Vladimir Putin', description: 'Russian table tennis player' }
] });
check('scorePep ignores a non-political namesake', namesake.hit === false);

const wrongName = scorePep('John Smith', { search: [
  { id: 'Q2', label: 'Jane Doe', description: 'Senator and politician' }
] });
check('scorePep requires the subject name in the result label', wrongName.hit === false);

check('scorePep tolerates an empty response', scorePep('Acme Co', {}).hit === false);
check('PEP_KEYWORDS includes core political roles', PEP_KEYWORDS.includes('president') && PEP_KEYWORDS.includes('minister'));

// Short multi-token names (every token <3 chars) must still match a real PEP
// namesake — the ≥3-char filter previously emptied the token set → silent miss.
const shortPep = scorePep('Xi Bo', { search: [{ id: 'Q1', label: 'Xi Bo', description: 'Chinese politician and minister' }] });
check('scorePep matches a short multi-token name (e.g. "Xi Bo")', shortPep.hit === true);

/* checkPep retries transient rate-limits (stub global fetch: 429 → 200). */
const _realFetch = globalThis.fetch;
const jsonRes = (obj, ok = true, status = 200, headers = {}) => ({
  ok, status, headers: { get: k => headers[k.toLowerCase()] ?? null }, json: async () => obj,
});
await (async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    if (calls === 1) return jsonRes({}, false, 429, { 'retry-after': '0' });
    return jsonRes({ search: [{ id: 'Q7747', label: 'Vladimir Putin', description: 'President of Russia' }] });
  };
  const r = await checkPep('Vladimir Putin', { retries: 2, backoffMs: 1 });
  check('checkPep retries a 429 then succeeds (transient rate-limit)', calls === 2 && r.hit === true && !r.errored);

  // Persistent 429 across all attempts → errored (degraded), not a clean PEP.
  let calls2 = 0;
  globalThis.fetch = async () => { calls2++; return jsonRes({}, false, 429, {}); };
  const r2 = await checkPep('Someone', { retries: 2, backoffMs: 1 });
  check('checkPep gives up after retries on persistent 429 (errored, never clean)', r2.errored === true && calls2 === 3);

  // A 404 is not retryable → fails fast (single call).
  let calls3 = 0;
  globalThis.fetch = async () => { calls3++; return jsonRes({}, false, 404, {}); };
  const r3 = await checkPep('Someone', { retries: 2, backoffMs: 1 });
  check('checkPep does not retry a non-transient status (404)', r3.errored === true && calls3 === 1);
})();
globalThis.fetch = _realFetch;

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
