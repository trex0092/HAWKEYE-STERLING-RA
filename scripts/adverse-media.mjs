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

/* Arabic-language risk terms — for a UAE deployment, adverse media often breaks
   in Arabic press first. Querying these (against Arabic Google News) closes a
   recall gap English-only screening leaves open. Matching is Unicode-aware (see
   normalize), so an Arabic-script subject name matches an Arabic headline; a
   Latin-only name simply finds nothing in Arabic press (correct — not a false
   clear, since the English + GDELT queries still run). */
export const ADVERSE_TERMS_AR = [
  'احتيال', 'غسل الأموال', 'عقوبات', 'إرهاب', 'تمويل الإرهاب',
  'رشوة', 'فساد', 'اختلاس', 'اعتقال', 'إدانة'
];

const STRONG_TERMS = new Set([
  'money laundering', 'sanctions', 'terrorism', 'terrorist financing',
  'غسل الأموال', 'عقوبات', 'إرهاب', 'تمويل الإرهاب'
]);

/* Build the Google News RSS search URL for a subject. The OR-joined risk terms
   keep it to a single request per customer. hl/gl/ceid pin English results. */
export function adverseMediaUrl(name, terms = ADVERSE_TERMS) {
  const q = '"' + String(name).trim() + '" (' + terms.map(t => '"' + t + '"').join(' OR ') + ')';
  return 'https://news.google.com/rss/search?q=' + encodeURIComponent(q) + '&hl=en-US&gl=US&ceid=US:en';
}

/* Arabic-language Google News RSS — same shape, Arabic risk terms, AE/Arabic
   locale so Arabic-language press is returned. */
export function adverseMediaUrlAr(name, terms = ADVERSE_TERMS_AR) {
  const q = '"' + String(name).trim() + '" (' + terms.map(t => '"' + t + '"').join(' OR ') + ')';
  return 'https://news.google.com/rss/search?q=' + encodeURIComponent(q) + '&hl=ar&gl=AE&ceid=AE:ar';
}

/* GDELT DOC 2.0 API — a free, no-key global news index spanning many languages
   and outlets that Google News RSS does not surface. An independent second
   source reduces single-feed dependence. Returns JSON; kept deliberately small. */
export function gdeltUrl(name, terms = ['sanctions', 'money laundering', 'fraud', 'corruption', 'terrorism']) {
  const q = '"' + String(name).trim() + '" (' + terms.map(t => t.includes(' ') ? '"' + t + '"' : t).join(' OR ') + ')';
  return 'https://api.gdeltproject.org/api/v2/doc/doc?query=' + encodeURIComponent(q)
    + '&mode=artlist&format=json&maxrecords=25&sort=datedesc&timespan=12m';
}

const RSS_ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
function decode(x) {
  const cp = n => { try { return String.fromCodePoint(n); } catch { return ''; } };
  return String(x).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&(amp|lt|gt|quot|apos);/g, (_, n) => RSS_ENT[n])
    .replace(/&#(\d+);/g, (_, d) => cp(+d))                       // fromCodePoint: astral planes (>U+FFFF), not just the BMP
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => cp(parseInt(h, 16)));
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
  return String(s == null ? '' : s).normalize('NFKD')
    // Strip combining marks: Latin diacritics + Arabic harakat/tatweel, so
    // "Muḥammad"→"muhammad" and "مُحَمَّد"→"محمد" both normalise stably.
    .replace(/[̀-ًͯ-ْٰـ]/g, '')
    .toLowerCase()
    // Keep letters/numbers of ANY script (Latin + Arabic + …); previously
    // [^a-z0-9] which silently dropped all Arabic, defeating Arabic matching.
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

/* Parse a GDELT DOC 2.0 artlist JSON response → [{ title, link, source, date }],
   the same item shape parseRss yields, so scoreAdverseMedia handles both. */
export function parseGdelt(body) {
  let json;
  try { json = typeof body === 'string' ? JSON.parse(body) : body; } catch { return []; }
  const arts = json && Array.isArray(json.articles) ? json.articles : [];
  return arts.map(a => ({
    title: decode(String(a.title || '')),
    link: String(a.url || ''),
    source: String(a.domain || ''),
    date: String(a.seendate || '')
  })).filter(x => x.title);
}

/* Fetch one source with a per-request timeout. Returns the parsed item array,
   or null on any failure (so the caller can tell "no hits" from "couldn't ask").*/
async function fetchSource(url, parse, accept, timeoutMs) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal, redirect: 'follow',
      headers: { 'user-agent': 'HawkeyeSterling-AdverseMedia/1.0', Accept: accept }
    });
    if (!res.ok) return null;
    return parse(await res.text());
  } catch { return null; }
  finally { clearTimeout(t); }
}

/* Network: fetch + screen one subject's adverse media across three independent
   free sources — English Google News (primary), Arabic Google News, and GDELT —
   merging their items before scoring (combined EN+AR risk terms). Tolerant: if
   the PRIMARY (English) source is unreachable the result is { errored:true } so
   the caller flags degraded coverage (never a false clear); a secondary source
   failing only narrows recall and is surfaced via `partial`, not treated as an
   all-clear. The return shape is unchanged for existing callers. */
export async function checkAdverseMedia(name, { timeoutMs = 20000 } = {}) {
  const xmlAccept = 'application/rss+xml, application/xml, text/xml';
  const [en, ar, gd] = await Promise.all([
    fetchSource(adverseMediaUrl(name), parseRss, xmlAccept, timeoutMs),
    fetchSource(adverseMediaUrlAr(name), parseRss, xmlAccept, timeoutMs),
    fetchSource(gdeltUrl(name), parseGdelt, 'application/json', timeoutMs),
  ]);
  if (en === null) return { errored: true, error: 'primary source unreachable' };
  const items = [...en, ...(ar || []), ...(gd || [])];
  const result = scoreAdverseMedia(name, items, [...ADVERSE_TERMS, ...ADVERSE_TERMS_AR]);
  const partial = (ar === null) || (gd === null);
  return partial ? { ...result, partial: true } : result;
}
