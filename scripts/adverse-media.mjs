/* Adverse-media screening — free, no API key, zero dependencies.

   Google News exposes a public RSS endpoint (news.google.com/rss/search) that
   needs no key and returns machine-readable XML. For each customer we query the
   name together with AML risk terms (fraud, money laundering, sanctions,
   terrorism, bribery…) and flag any recent article as an adverse-media hit for
   MLRO review. This is a SIGNAL, not a finding — false positives are expected
   and a hit means "look", never "guilty".

   (Google's paid Programmable Search API and scraping the HTML results page are
   not free / not ToS-clean; the RSS feed is the legitimate free path.)

   Pure helpers (query building + RSS parsing + scoring) are unit-tested offline;
   the fetch wrapper is the only network part. */

/* Risk terms appended to the customer name. A hit on a "strong" term escalates. */
export const ADVERSE_TERMS = [
  'fraud', 'money laundering', 'sanctions', 'terrorism', 'terrorist financing',
  'bribery', 'corruption', 'embezzlement', 'arrested', 'indicted', 'convicted'
];
const STRONG_TERMS = new Set(['money laundering', 'sanctions', 'terrorism', 'terrorist financing']);

/* Build the Google News RSS search URL for a subject. The OR-joined risk terms
   keep it to a single request per customer. hl/gl/ceid pin English results. */
export function adverseMediaUrl(name, terms = ADVERSE_TERMS) {
  const q = '"' + String(name).trim() + '" (' + terms.map(t => '"' + t + '"').join(' OR ') + ')';
  return 'https://news.google.com/rss/search?q=' + encodeURIComponent(q) + '&hl=en-US&gl=US&ceid=US:en';
}

const RSS_ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
function decode(x) {
  return String(x).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&(amp|lt|gt|quot|apos);/g, (_, n) => RSS_ENT[n])
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

/* Parse a Google News RSS feed → [{ title, link, source, date }]. */
export function parseRss(xml) {
  const items = [], re = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = re.exec(String(xml)))) {
    const b = m[1];
    const tag = n => { const t = new RegExp('<' + n + '\\b[^>]*>([\\s\\S]*?)<\\/' + n + '>').exec(b); return t ? decode(t[1]).trim() : ''; };
    const title = tag('title');
    if (!title) continue;
    items.push({ title, link: tag('link'), source: tag('source'), date: tag('pubDate') });
  }
  return items;
}

/* Score adverse-media items for a subject. Requires the customer name to appear
   in the headline (Google News OR-matches loosely) AND a risk term to be present,
   so we don't flag an unrelated article that merely shares a surname. Returns
   { hit, score, band, top, count, terms[] }. */
export function scoreAdverseMedia(name, items, terms = ADVERSE_TERMS) {
  const nm = normalize(name);
  const nameTokens = nm.split(' ').filter(t => t.length >= 3);
  const matched = [];
  for (const it of (items || [])) {
    const title = normalize(it.title);
    const hasName = nameTokens.length > 0 && nameTokens.every(t => title.includes(t));
    if (!hasName) continue;
    const hitTerms = terms.filter(t => title.includes(normalize(t)));
    if (!hitTerms.length) continue;
    matched.push({ ...it, terms: hitTerms });
  }
  if (!matched.length) return { hit: false, score: 0, band: 'low', top: null, count: 0, terms: [] };
  const strong = matched.some(a => a.terms.some(t => STRONG_TERMS.has(t)));
  const allTerms = [...new Set(matched.flatMap(a => a.terms))];
  return {
    hit: true,
    score: strong ? 90 : 80,
    band: strong ? 'high' : 'medium',
    top: matched[0],
    count: matched.length,
    terms: allTerms
  };
}

function normalize(s) {
  return String(s == null ? '' : s).normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/* Network: fetch + screen one subject's adverse media. Tolerant — on any error
   returns { errored:true } so the caller can flag degraded coverage rather than
   imply a clean result. */
export async function checkAdverseMedia(name, { timeoutMs = 20000 } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(adverseMediaUrl(name), {
      signal: ctrl.signal, redirect: 'follow',
      headers: { 'user-agent': 'HawkeyeSterling-AdverseMedia/1.0', Accept: 'application/rss+xml, application/xml, text/xml' }
    });
    if (!res.ok) return { errored: true, error: 'HTTP ' + res.status };
    const xml = await res.text();
    return scoreAdverseMedia(name, parseRss(xml));
  } catch (e) {
    return { errored: true, error: String(e && e.message || e).slice(0, 200) };
  } finally { clearTimeout(t); }
}
