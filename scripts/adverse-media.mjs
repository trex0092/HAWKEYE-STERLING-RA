/* Adverse-media screening — free, no API key, zero dependencies.

   GLOBAL coverage: for each customer we sweep Google News' public RSS endpoint
   (news.google.com/rss/search) across a worldwide matrix of country/language
   locales — each queried with AML risk terms IN THAT LANGUAGE — and cross-check
   the GDELT DOC 2.0 global index (65+ languages, machine-translated). Every
   recent article whose headline names the subject AND carries a risk term is an
   adverse-media hit for MLRO review. This is a SIGNAL, not a finding — false
   positives are expected and a hit means "look", never "guilty".

   Why locale + language breadth: negative news frequently breaks first in local
   /native-language press (Arabic, Spanish, Russian, Chinese, …). English-only
   screening leaves a large recall gap for a global customer base; GDELT is the
   worldwide net and the per-language Google News locales add regional depth.

   (Google's paid Programmable Search API and scraping the HTML results page are
   not free / not ToS-clean; the RSS feed is the legitimate free path.)

   Pure helpers (query building + RSS parsing + scoring) are unit-tested offline;
   the fetch wrapper is the only network part. */

/* ── English risk terms (default) ─────────────────────────────────────────────
   Appended to the customer name. A hit on a "strong" term (see STRONG_LIST)
   escalates the band. */
export const ADVERSE_TERMS = [
  'fraud', 'money laundering', 'sanctions', 'sanctions evasion', 'terrorism',
  'terrorist financing', 'bribery', 'corruption', 'embezzlement', 'arrested',
  'indicted', 'convicted', 'trafficking', 'smuggling', 'tax evasion',
  'organized crime', 'wire fraud', 'ponzi scheme'
];

/* Arabic-language risk terms — for a UAE deployment, adverse media often breaks
   in Arabic press first. Querying these (against Arabic Google News) closes a
   recall gap English-only screening leaves open. Matching is Unicode-aware (see
   normalize), so an Arabic-script subject name matches an Arabic headline; a
   Latin-only name simply finds nothing in Arabic press (correct — not a false
   clear, since the English + GDELT queries still run). */
export const ADVERSE_TERMS_AR = [
  'احتيال', 'غسل الأموال', 'عقوبات', 'إرهاب', 'تمويل الإرهاب',
  'رشوة', 'فساد', 'اختلاس', 'اعتقال', 'إدانة', 'تهريب', 'الاتجار بالبشر'
];

/* ── Multilingual risk-term dictionaries ──────────────────────────────────────
   One list per language: money laundering · fraud · sanctions · terrorism ·
   terrorist financing · bribery · corruption · embezzlement · arrested ·
   convicted (+ trafficking/smuggling where idiomatic). Terms are matched
   diacritic-insensitively and script-aware (see normalize). Extend freely. */
export const LANG_TERMS = {
  en: ADVERSE_TERMS,
  ar: ADVERSE_TERMS_AR,
  es: ['fraude', 'lavado de dinero', 'blanqueo de capitales', 'sanciones', 'terrorismo',
    'financiación del terrorismo', 'soborno', 'corrupción', 'malversación', 'detenido',
    'condenado', 'narcotráfico', 'contrabando'],
  fr: ['fraude', "blanchiment d'argent", 'sanctions', 'terrorisme', 'financement du terrorisme',
    'corruption', 'pot-de-vin', 'détournement de fonds', 'arrêté', 'condamné', 'trafic', 'contrebande'],
  de: ['Betrug', 'Geldwäsche', 'Sanktionen', 'Terrorismus', 'Terrorismusfinanzierung',
    'Bestechung', 'Korruption', 'Veruntreuung', 'verhaftet', 'verurteilt', 'Schmuggel', 'Menschenhandel'],
  pt: ['fraude', 'lavagem de dinheiro', 'sanções', 'terrorismo', 'financiamento do terrorismo',
    'suborno', 'corrupção', 'desvio de dinheiro', 'preso', 'condenado', 'tráfico', 'contrabando'],
  ru: ['мошенничество', 'отмывание денег', 'санкции', 'терроризм', 'финансирование терроризма',
    'взяточничество', 'коррупция', 'растрата', 'арестован', 'осуждён', 'контрабанда'],
  zh: ['欺诈', '诈骗', '洗钱', '制裁', '恐怖主义', '恐怖融资', '贿赂', '腐败', '挪用公款', '被捕', '定罪', '走私', '贩运'],
  it: ['frode', 'riciclaggio di denaro', 'sanzioni', 'terrorismo', 'finanziamento del terrorismo',
    'corruzione', 'tangente', 'appropriazione indebita', 'arrestato', 'condannato', 'traffico', 'contrabbando'],
  tr: ['dolandırıcılık', 'kara para aklama', 'yaptırımlar', 'terörizm', 'terörün finansmanı',
    'rüşvet', 'yolsuzluk', 'zimmet', 'tutuklandı', 'mahkûm', 'kaçakçılık'],
  ja: ['詐欺', 'マネーロンダリング', '資金洗浄', '制裁', 'テロ', 'テロ資金供与', '贈収賄', '汚職', '横領', '逮捕', '有罪', '密輸'],
  ko: ['사기', '자금세탁', '제재', '테러', '테러자금', '뇌물', '부패', '횡령', '체포', '유죄', '밀수'],
  hi: ['धोखाधड़ी', 'मनी लॉन्ड्रिंग', 'प्रतिबंध', 'आतंकवाद', 'आतंकी वित्तपोषण', 'रिश्वत', 'भ्रष्टाचार', 'गबन', 'गिरफ्तार', 'दोषी', 'तस्करी'],
  id: ['penipuan', 'pencucian uang', 'sanksi', 'terorisme', 'pendanaan terorisme', 'suap',
    'korupsi', 'penggelapan', 'ditangkap', 'terpidana', 'penyelundupan'],
  fa: ['کلاهبرداری', 'پولشویی', 'تحریم', 'تروریسم', 'تأمین مالی تروریسم', 'رشوه', 'فساد', 'اختلاس', 'دستگیر', 'محکوم', 'قاچاق'],
  ur: ['دھوکہ دہی', 'منی لانڈرنگ', 'پابندیاں', 'دہشت گردی', 'دہشت گردی کی مالی معاونت', 'رشوت', 'بدعنوانی', 'غبن', 'گرفتار', 'اسمگلنگ'],
  uk: ['шахрайство', 'відмивання грошей', 'санкції', 'тероризм', 'фінансування тероризму',
    'хабарництво', 'корупція', 'розтрата', 'заарештований', 'засуджений', 'контрабанда'],
  nl: ['fraude', 'witwassen', 'sancties', 'terrorisme', 'terrorismefinanciering', 'omkoping',
    'corruptie', 'verduistering', 'gearresteerd', 'veroordeeld', 'smokkel']
};

/* Union of every language's terms — the term set used when scoring the merged,
   multi-locale item stream. */
export const ALL_TERMS = [...new Set(Object.values(LANG_TERMS).flat())];

/* "Strong" (escalating) predicates across languages: money laundering, sanctions
   (+ evasion), terrorism, terrorist financing. A hit on any of these → high band. */
const STRONG_LIST = [
  'money laundering', 'sanctions', 'sanctions evasion', 'terrorism', 'terrorist financing',
  'غسل الأموال', 'عقوبات', 'إرهاب', 'تمويل الإرهاب',
  'lavado de dinero', 'blanqueo de capitales', 'sanciones', 'terrorismo', 'financiación del terrorismo',
  "blanchiment d'argent", 'terrorisme', 'financement du terrorisme',
  'Geldwäsche', 'Sanktionen', 'Terrorismus', 'Terrorismusfinanzierung',
  'lavagem de dinheiro', 'sanções', 'financiamento do terrorismo',
  'отмывание денег', 'санкции', 'терроризм', 'финансирование терроризма',
  '洗钱', '制裁', '恐怖主义', '恐怖融资',
  'riciclaggio di denaro', 'sanzioni', 'finanziamento del terrorismo',
  'kara para aklama', 'yaptırımlar', 'terörizm', 'terörün finansmanı',
  'マネーロンダリング', '資金洗浄', 'テロ資金供与',
  '자금세탁', '테러', '테러자금',
  'मनी लॉन्ड्रिंग', 'आतंकवाद', 'आतंकी वित्तपोषण',
  'pencucian uang', 'terorisme', 'pendanaan terorisme',
  'پولشویی', 'تروریسم', 'تأمین مالی تروریسم',
  'منی لانڈرنگ', 'دہشت گردی',
  'відмивання грошей', 'санкції', 'тероризм', 'фінансування тероризму',
  'witwassen', 'sancties', 'terrorisme', 'terrorismefinanciering'
];
const STRONG_TERMS = new Set(STRONG_LIST);

/* ── Worldwide Google News locale matrix ──────────────────────────────────────
   { id, hl (UI language), gl (country), ceid (country:lang), lang (LANG_TERMS
   key) }. Regional English editions (US/GB/IN/AE/…) are kept separate because
   local press differs; non-English locales query their own language's terms.
   Tunable at runtime with ADVERSE_MEDIA_LOCALES (comma-separated ids). */
export const LOCALES = [
  // English — global regional editions
  { id: 'en-US', hl: 'en-US', gl: 'US', ceid: 'US:en', lang: 'en' },
  { id: 'en-GB', hl: 'en-GB', gl: 'GB', ceid: 'GB:en', lang: 'en' },
  { id: 'en-IN', hl: 'en-IN', gl: 'IN', ceid: 'IN:en', lang: 'en' },
  { id: 'en-AE', hl: 'en-AE', gl: 'AE', ceid: 'AE:en', lang: 'en' },
  { id: 'en-SG', hl: 'en-SG', gl: 'SG', ceid: 'SG:en', lang: 'en' },
  { id: 'en-AU', hl: 'en-AU', gl: 'AU', ceid: 'AU:en', lang: 'en' },
  { id: 'en-NG', hl: 'en-NG', gl: 'NG', ceid: 'NG:en', lang: 'en' },
  { id: 'en-ZA', hl: 'en-ZA', gl: 'ZA', ceid: 'ZA:en', lang: 'en' },
  { id: 'en-PK', hl: 'en-PK', gl: 'PK', ceid: 'PK:en', lang: 'en' },
  { id: 'en-PH', hl: 'en-PH', gl: 'PH', ceid: 'PH:en', lang: 'en' },
  // Arabic
  { id: 'ar-AE', hl: 'ar', gl: 'AE', ceid: 'AE:ar', lang: 'ar' },
  { id: 'ar-SA', hl: 'ar', gl: 'SA', ceid: 'SA:ar', lang: 'ar' },
  { id: 'ar-EG', hl: 'ar', gl: 'EG', ceid: 'EG:ar', lang: 'ar' },
  // Spanish
  { id: 'es-ES', hl: 'es', gl: 'ES', ceid: 'ES:es', lang: 'es' },
  { id: 'es-MX', hl: 'es-419', gl: 'MX', ceid: 'MX:es-419', lang: 'es' },
  { id: 'es-AR', hl: 'es-419', gl: 'AR', ceid: 'AR:es-419', lang: 'es' },
  // French
  { id: 'fr-FR', hl: 'fr', gl: 'FR', ceid: 'FR:fr', lang: 'fr' },
  { id: 'fr-CA', hl: 'fr', gl: 'CA', ceid: 'CA:fr', lang: 'fr' },
  // German
  { id: 'de-DE', hl: 'de', gl: 'DE', ceid: 'DE:de', lang: 'de' },
  { id: 'de-CH', hl: 'de', gl: 'CH', ceid: 'CH:de', lang: 'de' },
  // Portuguese
  { id: 'pt-BR', hl: 'pt-BR', gl: 'BR', ceid: 'BR:pt-419', lang: 'pt' },
  { id: 'pt-PT', hl: 'pt-PT', gl: 'PT', ceid: 'PT:pt-150', lang: 'pt' },
  // Russian / Ukrainian
  { id: 'ru-RU', hl: 'ru', gl: 'RU', ceid: 'RU:ru', lang: 'ru' },
  { id: 'uk-UA', hl: 'uk', gl: 'UA', ceid: 'UA:uk', lang: 'uk' },
  // Chinese
  { id: 'zh-CN', hl: 'zh-CN', gl: 'CN', ceid: 'CN:zh-Hans', lang: 'zh' },
  { id: 'zh-TW', hl: 'zh-TW', gl: 'TW', ceid: 'TW:zh-Hant', lang: 'zh' },
  { id: 'zh-HK', hl: 'zh-HK', gl: 'HK', ceid: 'HK:zh-Hant', lang: 'zh' },
  // Other major languages
  { id: 'it-IT', hl: 'it', gl: 'IT', ceid: 'IT:it', lang: 'it' },
  { id: 'tr-TR', hl: 'tr', gl: 'TR', ceid: 'TR:tr', lang: 'tr' },
  { id: 'ja-JP', hl: 'ja', gl: 'JP', ceid: 'JP:ja', lang: 'ja' },
  { id: 'ko-KR', hl: 'ko', gl: 'KR', ceid: 'KR:ko', lang: 'ko' },
  { id: 'hi-IN', hl: 'hi', gl: 'IN', ceid: 'IN:hi', lang: 'hi' },
  { id: 'id-ID', hl: 'id', gl: 'ID', ceid: 'ID:id', lang: 'id' },
  { id: 'fa-IR', hl: 'fa', gl: 'IR', ceid: 'IR:fa', lang: 'fa' },
  { id: 'ur-PK', hl: 'ur', gl: 'PK', ceid: 'PK:ur', lang: 'ur' },
  { id: 'nl-NL', hl: 'nl', gl: 'NL', ceid: 'NL:nl', lang: 'nl' }
];

/* The locale set to sweep this run — all of LOCALES unless narrowed by the
   ADVERSE_MEDIA_LOCALES env (comma-separated ids), so an operator can dial
   coverage vs runtime without a code change. Unknown ids are ignored. */
export function activeLocales() {
  const sel = String(process.env.ADVERSE_MEDIA_LOCALES || '').split(',').map(s => s.trim()).filter(Boolean);
  if (!sel.length) return LOCALES;
  const picked = LOCALES.filter(l => sel.includes(l.id));
  return picked.length ? picked : LOCALES;
}

/* Build the Google News RSS search URL for a subject. The OR-joined risk terms
   keep it to a single request per locale. hl/gl/ceid pin English (US) results. */
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

/* Generic per-locale Google News RSS URL: quotes the name, OR-joins that
   locale's language risk terms, and pins hl/gl/ceid. The ceid colon is left
   literal (URL-safe in a query value; Google requires the `country:lang` form).*/
export function adverseMediaUrlFor(name, loc) {
  const terms = LANG_TERMS[loc.lang] || ADVERSE_TERMS;
  const q = '"' + String(name).trim() + '" (' + terms.map(t => '"' + t + '"').join(' OR ') + ')';
  return 'https://news.google.com/rss/search?q=' + encodeURIComponent(q)
    + '&hl=' + encodeURIComponent(loc.hl) + '&gl=' + encodeURIComponent(loc.gl) + '&ceid=' + loc.ceid;
}

/* GDELT DOC 2.0 API — a free, no-key GLOBAL news index spanning 65+ languages
   and outlets that Google News RSS does not surface (it machine-translates, so
   English risk terms still reach non-English coverage). The worldwide backbone
   of the sweep; the per-locale Google News queries add regional depth. */
export function gdeltUrl(name, terms = ['sanctions', 'sanctions evasion', 'money laundering', 'fraud', 'corruption', 'bribery', 'terrorism', 'terrorist financing', 'embezzlement', 'trafficking']) {
  const q = '"' + String(name).trim() + '" (' + terms.map(t => t.includes(' ') ? '"' + t + '"' : t).join(' OR ') + ')';
  const span = String(process.env.ADVERSE_MEDIA_TIMESPAN || '12m');
  return 'https://api.gdeltproject.org/api/v2/doc/doc?query=' + encodeURIComponent(q)
    + '&mode=artlist&format=json&maxrecords=75&sort=datedesc&timespan=' + encodeURIComponent(span);
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
   { hit, score, band, top, count, terms[] }. Pass ALL_TERMS to score a merged
   multi-language stream. */
export function scoreAdverseMedia(name, items, terms = ADVERSE_TERMS) {
  const nm = normalize(name);
  // Prefer tokens ≥3 chars; but for short multi-token names (e.g. "Xi Bo",
  // common in East-Asian names) that filter is empty — fall back to ≥2 so the
  // subject is still matchable rather than silently never flagged.
  let nameTokens = nm.split(' ').filter(t => t.length >= 3);
  if (!nameTokens.length) nameTokens = nm.split(' ').filter(t => t.length >= 2);
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
    // Strip ONLY combining marks — Latin diacritics (U+0300–U+036F) and Arabic
    // harakat/tatweel/superscript-alef — using explicit code points so the class
    // can never widen into base letters (Cyrillic, Arabic, Hebrew, …). So
    // "Muḥammad"→"muhammad" and "مُحَمَّد"→"محمد" normalise stably, while Cyrillic
    // ("санкции") and CJK ("洗钱") pass through intact.
    .replace(/[\u0300-\u036f\u0640\u064b-\u0655\u0670]/g, '')
    .toLowerCase()
    // Keep letters/numbers of ANY script (Latin + Arabic + Cyrillic + CJK + …);
    // previously [^a-z0-9] silently dropped all non-Latin, defeating cross-script matching.
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

/* De-duplicate merged items across locales/sources by link (fallback: normalized
   title), so the same wire story surfaced in many editions is counted once. */
export function dedupItems(items) {
  const seen = new Set(), out = [];
  for (const it of (items || [])) {
    const key = (it && it.link && String(it.link).trim()) || normalize(it && it.title);
    if (!key || seen.has(key)) continue;
    seen.add(key); out.push(it);
  }
  return out;
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

/* Run async `fn` over `items` with bounded concurrency, so a wide locale sweep
   does not fire dozens of simultaneous requests at one host (which Google News
   throttles). Preserves input order. */
export async function mapPool(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  const width = Math.max(1, Math.min(limit, items.length));
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: width }, worker));
  return out;
}

/* Network: fetch + screen one subject's adverse media across the WORLDWIDE locale
   matrix (per-language Google News editions) plus GDELT's global index, merging
   and de-duplicating every item before scoring against ALL_TERMS (all languages).

   Degradation is honest, never a false clear:
   - errored → the two global backbones (en-US Google News AND GDELT) were both
     unreachable, so we effectively could not screen; the caller must not clear a
     standing adverse-media match.
   - partial → at least one backbone answered but some locales failed; coverage is
     narrowed, not absent.
   The return shape is a superset of the original { hit, score, band, top, count,
   terms } — existing callers are unaffected. Tunables: ADVERSE_MEDIA_LOCALES,
   ADVERSE_MEDIA_CONCURRENCY, ADVERSE_MEDIA_TIMESPAN, opts.{concurrency,locales}. */
export async function checkAdverseMedia(name, { timeoutMs = 20000, concurrency, locales } = {}) {
  const xmlAccept = 'application/rss+xml, application/xml, text/xml';
  const localeSet = locales || activeLocales();
  const conc = Math.max(1, concurrency || Number(process.env.ADVERSE_MEDIA_CONCURRENCY) || 6);

  // GDELT (global) runs alongside the pooled per-locale Google News fetches.
  const gdeltP = fetchSource(gdeltUrl(name), parseGdelt, 'application/json', timeoutMs);
  const localeResults = await mapPool(localeSet, conc, loc =>
    fetchSource(adverseMediaUrlFor(name, loc), parseRss, xmlAccept, timeoutMs)
      .then(items => ({ id: loc.id, items }))
  );
  const gd = await gdeltP;

  const enUs = localeResults.find(r => r.id === 'en-US');
  const backboneOk = (enUs && enUs.items !== null) || gd !== null;
  if (!backboneOk) return { errored: true, error: 'global adverse-media backbones unreachable', localesQueried: localeSet.length };

  const okLocales = localeResults.filter(r => r.items !== null);
  const items = dedupItems([...okLocales.flatMap(r => r.items), ...(gd || [])]);
  const result = scoreAdverseMedia(name, items, ALL_TERMS);

  const sourcesOk = okLocales.length + (gd !== null ? 1 : 0);
  const sourcesTotal = localeSet.length + 1; // + GDELT
  const failed = sourcesTotal - sourcesOk;
  const out = { ...result, localesQueried: localeSet.length, sourcesOk, sourcesFailed: failed, itemsScanned: items.length };
  return failed ? { ...out, partial: true } : out;
}
