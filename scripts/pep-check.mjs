/* PEP (Politically Exposed Person) screening — free, best-effort, zero deps.

   There is no genuinely free, commercial-use PEP *list*: the good feeds
   (OpenSanctions et al.) are licensed. As a $0 signal we use Wikidata's public
   entity-search API (CC0 data, no key): we look the customer up and treat a
   match whose description names a political role (president, minister, senator,
   diplomat, ruler…) as a possible PEP for MLRO review.

   This is intentionally a WEAK, high-recall signal — NOT screening-grade PEP
   coverage. A hit means "verify", and absence of a hit is NOT assurance the
   subject is not a PEP. For proper coverage a licensed PEP feed is required;
   that is documented, not silently implied.

   Pure helpers (URL + result scoring) are unit-tested offline; only checkPep
   touches the network. */

/* Political-role keywords looked for in a Wikidata result description. */
export const PEP_KEYWORDS = [
  'politician', 'president', 'prime minister', 'minister', 'senator', 'governor',
  'mayor', 'member of parliament', 'parliament', 'congressman', 'congresswoman',
  'diplomat', 'ambassador', 'head of state', 'head of government', 'party leader',
  'monarch', 'king', 'queen', 'crown prince', 'prince', 'princess', 'sheikh',
  'emir', 'sultan', 'ruler', 'secretary of state', 'chancellor', 'legislator',
  'deputy prime', 'foreign minister', 'defence minister', 'defense minister',
  'central bank governor', 'supreme court', 'attorney general', 'state official'
];

/* Wikidata entity-search endpoint (no key, returns JSON). */
export function pepSearchUrl(name) {
  return 'https://www.wikidata.org/w/api.php?action=wbsearchentities&format=json'
    + '&language=en&uselang=en&type=item&limit=7&search=' + encodeURIComponent(String(name).trim());
}

function normalize(s) {
  return String(s == null ? '' : s).normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/* Does a result label plausibly match the subject? All significant subject
   tokens must appear in the result label (guards against unrelated namesakes). */
function labelMatches(name, label) {
  // ≥3-char tokens normally; fall back to ≥2 for short multi-token names
  // (e.g. "Xi Bo") so a real PEP namesake is not silently missed.
  let want = normalize(name).split(' ').filter(t => t.length >= 3);
  if (!want.length) want = normalize(name).split(' ').filter(t => t.length >= 2);
  const have = normalize(label);
  return want.length > 0 && want.every(t => have.includes(t));
}

/* Score a Wikidata wbsearchentities response for a subject. Returns
   { hit, score, band, match:{label,description,id}, count }. */
export function scorePep(name, json) {
  const results = (json && Array.isArray(json.search)) ? json.search : [];
  const hits = [];
  for (const r of results) {
    const desc = String(r.description || '');
    const dn = normalize(desc);
    if (!dn) continue;
    if (!PEP_KEYWORDS.some(k => dn.includes(normalize(k)))) continue;
    if (!labelMatches(name, r.label || r.match && r.match.text || '')) continue;
    hits.push({ id: r.id, label: r.label || '', description: desc });
  }
  if (!hits.length) return { hit: false, score: 0, band: 'low', match: null, count: 0 };
  return { hit: true, score: 80, band: 'medium', match: hits[0], count: hits.length };
}

/* Wikidata rate-limits (429) and occasionally 5xx's under burst — when the whole
   customer base is screened at once these are transient, not real failures. */
const PEP_RETRY_STATUS = new Set([429, 500, 502, 503, 504]);
const _sleep = ms => new Promise(r => setTimeout(r, ms));

/* Network: look up one subject's PEP signal. Tolerant — on error returns
   { errored:true } so the caller flags degraded coverage, never a clean PEP.
   Retries transient rate-limit / 5xx responses with exponential backoff +
   jitter, honouring a Retry-After header when present. */
export async function checkPep(name, { timeoutMs = 20000, retries = 2, backoffMs = 600 } = {}) {
  let lastErr = 'unreachable';
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(pepSearchUrl(name), {
        signal: ctrl.signal, redirect: 'follow',
        headers: { 'user-agent': 'HawkeyeSterling-PEP/1.0 (compliance screening)', Accept: 'application/json' }
      });
      if (res.ok) return scorePep(name, await res.json());
      lastErr = 'HTTP ' + res.status;
      if (!PEP_RETRY_STATUS.has(res.status) || attempt === retries) return { errored: true, error: lastErr };
      const ra = Number(res.headers && res.headers.get && res.headers.get('retry-after'));
      const wait = Number.isFinite(ra) && ra > 0 ? ra * 1000 : backoffMs * (2 ** attempt);
      await _sleep(wait + Math.floor(Math.random() * 250));
    } catch (e) {
      lastErr = String(e && e.message || e).slice(0, 200);
      if (attempt === retries) return { errored: true, error: lastErr };
      await _sleep(backoffMs * (2 ** attempt) + Math.floor(Math.random() * 250));
    } finally { clearTimeout(t); }
  }
  return { errored: true, error: lastErr };
}
