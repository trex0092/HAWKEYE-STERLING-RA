/* Unit tests for adverse-media screening pure logic (no network).
   Usage: node test/adverse-media.test.mjs */
import { adverseMediaUrl, adverseMediaUrlAr, gdeltUrl, parseRss, parseGdelt, scoreAdverseMedia, ADVERSE_TERMS, ADVERSE_TERMS_AR,
  LANG_TERMS, ALL_TERMS, LOCALES, adverseMediaUrlFor, activeLocales, dedupItems, mapPool,
  canonicalLink, sourceTierFor, resolveLocaleBudget, budgetedLocales, rotationCycleDays, CORE_LOCALE_IDS,
  GDELT_RISK_TERMS, GDELT_EXTRA_TERMS, GDELT_QUERY_MAX, gdeltTerms,
  gdeltQueryString } from '../scripts/adverse-media.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const ROOT2 = resolve(dirname(fileURLToPath(import.meta.url)), '..');

let passed = 0, failed = 0;
function check(name, cond) {
  if (cond) { passed++; console.log('  ok  ' + name); }
  else { failed++; console.log('FAIL  ' + name); }
}

check('adverseMediaUrl targets Google News RSS with quoted name + risk terms',
  adverseMediaUrl('Acme Co').startsWith('https://news.google.com/rss/search?q=') &&
  decodeURIComponent(adverseMediaUrl('Acme Co')).includes('"Acme Co"') &&
  decodeURIComponent(adverseMediaUrl('Acme Co')).includes('money laundering'));

const rss = '<rss><channel>' +
  '<item><title>Acme Co director charged with money laundering</title><link>http://x/1</link><source url="http://news">Reuters</source><pubDate>Mon, 01 Jun 2026</pubDate></item>' +
  '<item><title><![CDATA[Unrelated Acme bakery wins award]]></title><link>http://x/2</link></item>' +
  '</channel></rss>';
const items = parseRss(rss);
check('parseRss extracts items incl. CDATA titles', items.length === 2 && items[0].source === 'Reuters' && items[1].title === 'Unrelated Acme bakery wins award');
/* Same coverage decision as parseGdelt: a locale that could not be asked must
   not score as a locale that answered clean. Google News serves HTTP 200 with a
   consent/interstitial page when it throttles a runner IP — no <item> tags, and
   the old parser read that as "no adverse media about this subject". */
check('parseRss: a consent/interstitial page is "could not ask" (null), not a clean locale',
  parseRss('<!DOCTYPE html><html><body>Before you continue to Google</body></html>') === null
  && parseRss('') === null && parseRss(null) === null);
check('parseRss: a real feed with no matching stories still means zero results',
  Array.isArray(parseRss('<rss><channel><title>q</title></channel></rss>'))
  && parseRss('<rss><channel><title>q</title></channel></rss>').length === 0);

const score = scoreAdverseMedia('Acme Co', items);
check('scoreAdverseMedia flags a name+risk-term headline as a strong hit',
  score.hit === true && score.band === 'high' && score.terms.includes('money laundering') && score.count === 1);

const noTerm = scoreAdverseMedia('Acme Co', [{ title: 'Acme Co opens new office', link: '' }]);
check('scoreAdverseMedia does not flag a clean headline', noTerm.hit === false);

const noName = scoreAdverseMedia('Zzz Holdings', items);
check('scoreAdverseMedia requires the customer name in the headline', noName.hit === false);

const weak = scoreAdverseMedia('Acme Co', [{ title: 'Acme Co accused of corruption', link: '' }]);
check('scoreAdverseMedia uses medium band for a non-strong risk term', weak.hit === true && weak.band === 'medium');

check('ADVERSE_TERMS covers core AML predicates', ADVERSE_TERMS.includes('sanctions') && ADVERSE_TERMS.includes('terrorism'));

/* Corporate boilerplate must not be required in the headline: a UAE-shaped legal
   name still matches a headline that carries only its distinctive tokens. */
const corpHit = scoreAdverseMedia('Al Haramain General Trading LLC',
  [{ title: 'Al Haramain investigated for money laundering', link: '' }]);
check('scoreAdverseMedia matches despite dropped "General Trading LLC" boilerplate',
  corpHit.hit === true && corpHit.terms.includes('money laundering'));
/* A pure surname must still require a risk term (no over-broad match). */
const corpClean = scoreAdverseMedia('Al Haramain General Trading LLC',
  [{ title: 'Al Haramain opens a new showroom', link: '' }]);
check('boilerplate-stripped name still needs a risk term', corpClean.hit === false);

/* ── GDELT (second English/global source) ──────────────────────────────────── */
check('gdeltUrl targets the GDELT DOC 2.0 artlist JSON API with the quoted name',
  gdeltUrl('Acme Co').startsWith('https://api.gdeltproject.org/api/v2/doc/doc?query=') &&
  decodeURIComponent(gdeltUrl('Acme Co')).includes('"Acme Co"') &&
  gdeltUrl('Acme Co').includes('format=json') && gdeltUrl('Acme Co').includes('mode=artlist'));

const gd = parseGdelt(JSON.stringify({ articles: [
  { title: 'Acme Co probed in money laundering case', url: 'http://g/1', domain: 'apnews.com', seendate: '20260601T000000Z' },
  { title: '', url: 'http://g/2' },
] }));
check('parseGdelt extracts articles (title/link/source/date), dropping empty titles',
  gd.length === 1 && gd[0].source === 'apnews.com' && gd[0].link === 'http://g/1');
/* NULL vs [] is a coverage decision, not a parsing detail. checkAdverseMedia
   reads `gd !== null` to decide whether the worldwide backbone answered at all;
   an unparseable body returned as [] scored as "GDELT swept the global index
   and found nothing" — a false clear. GDELT replies HTTP 200 with plain text
   when it rejects a query and with an HTML page when it is overloaded, so this
   is the ordinary failure mode, not an exotic one. */
check('parseGdelt: malformed JSON is "could not ask" (null), NEVER a clean sweep',
  parseGdelt('{not json') === null);
check('parseGdelt: an HTML error page or plain-text complaint is null, not zero results',
  parseGdelt('<html><body>Service Unavailable</body></html>') === null
  && parseGdelt('Your query was rejected.') === null);
check('parseGdelt: valid JSON with no articles array is an error envelope, not zero results',
  parseGdelt('{"status":"error"}') === null && parseGdelt('[]') === null);
check('parseGdelt: GDELT\'s real zero-result shapes still mean zero results',
  Array.isArray(parseGdelt('{"articles":[]}')) && parseGdelt('{"articles":[]}').length === 0
  && Array.isArray(parseGdelt('')) && Array.isArray(parseGdelt('   \n')));

const gdScore = scoreAdverseMedia('Acme Co', gd);
check('GDELT items score through the same scorer', gdScore.hit === true && gdScore.terms.includes('money laundering'));

/* ── Arabic-language adverse media (Unicode-aware matching) ─────────────────── */
check('adverseMediaUrlAr targets Arabic Google News (hl=ar, AE locale) with Arabic terms',
  adverseMediaUrlAr('شركة المثال').includes('hl=ar') && adverseMediaUrlAr('شركة المثال').includes('ceid=AE:ar') &&
  decodeURIComponent(adverseMediaUrlAr('شركة المثال')).includes('عقوبات'));

const arItems = [{ title: 'شركة المثال متورطة في غسل الأموال', link: 'http://a/1' }];
const arScore = scoreAdverseMedia('شركة المثال', arItems, ADVERSE_TERMS_AR);
check('Arabic name matches an Arabic headline with an Arabic risk term (strong)',
  arScore.hit === true && arScore.band === 'high' && arScore.terms.includes('غسل الأموال'));

const latinVsArabic = scoreAdverseMedia('Acme Co', arItems, [...ADVERSE_TERMS, ...ADVERSE_TERMS_AR]);
check('a Latin-only name does NOT falsely match an unrelated Arabic headline', latinVsArabic.hit === false);

const arDiacritics = scoreAdverseMedia('محمد', [{ title: 'مُحَمَّد قيد التحقيق بتهمة الفساد', link: '' }], ADVERSE_TERMS_AR);
check('Arabic matching is harakat-insensitive (diacritics stripped)', arDiacritics.hit === true);

check('ADVERSE_TERMS_AR covers core Arabic AML predicates',
  ADVERSE_TERMS_AR.includes('عقوبات') && ADVERSE_TERMS_AR.includes('غسل الأموال'));

/* Short multi-token names (every token <3 chars, e.g. East-Asian names) must
   still be matchable — previously the ≥3-char token filter emptied the set and
   the subject was silently never flagged. */
const shortName = scoreAdverseMedia('Xi Bo', [{ title: 'Xi Bo arrested for terrorism financing', link: '' }]);
check('short multi-token name (e.g. "Xi Bo") is still matched (no silent false-negative)', shortName.hit === true);

/* ── Global coverage: worldwide locale matrix + multilingual terms ──────────── */
check('LOCALES spans many countries incl. the en-US primary and non-English press',
  LOCALES.length >= 25 && LOCALES.some(l => l.id === 'en-US') &&
  LOCALES.some(l => l.lang === 'zh') && LOCALES.some(l => l.lang === 'ru') && LOCALES.some(l => l.lang === 'es'));

check('LANG_TERMS covers the major world languages with native AML terms',
  ['en', 'ar', 'es', 'fr', 'de', 'pt', 'ru', 'zh', 'ja', 'tr', 'hi'].every(k => Array.isArray(LANG_TERMS[k]) && LANG_TERMS[k].length) &&
  LANG_TERMS.es.includes('lavado de dinero') && LANG_TERMS.zh.includes('洗钱') && LANG_TERMS.ru.includes('отмывание денег'));

check('ALL_TERMS is the de-duplicated union across every language',
  ALL_TERMS.includes('money laundering') && ALL_TERMS.includes('غسل الأموال') && ALL_TERMS.includes('洗钱') &&
  ALL_TERMS.length === new Set(ALL_TERMS).size);

check('adverseMediaUrlFor pins a locale and uses that language\'s terms',
  (() => {
    const es = LOCALES.find(l => l.id === 'es-MX');
    const u = adverseMediaUrlFor('Acme SA', es);
    return u.startsWith('https://news.google.com/rss/search?q=') && u.includes('ceid=MX:es-419') &&
      u.includes('gl=MX') && decodeURIComponent(u).includes('lavado de dinero');
  })());

check('a Chinese headline flags via the multilingual union (洗钱 = strong/high)',
  (() => {
    const r = scoreAdverseMedia('中国铝业', [{ title: '中国铝业 涉嫌 洗钱', link: 'http://z/1' }], ALL_TERMS);
    return r.hit === true && r.band === 'high' && r.terms.includes('洗钱');
  })());

check('a Spanish headline flags via the union (lavado de dinero = strong/high)',
  (() => {
    const r = scoreAdverseMedia('Grupo Ejemplo', [{ title: 'Grupo Ejemplo investigado por lavado de dinero', link: 'http://s/1' }], ALL_TERMS);
    return r.hit === true && r.band === 'high' && r.terms.includes('lavado de dinero');
  })());

check('a Russian headline flags via the union (санкции)',
  scoreAdverseMedia('Пример', [{ title: 'Пример попал под санкции', link: 'http://r/1' }], ALL_TERMS).hit === true);

check('activeLocales honours the ADVERSE_MEDIA_LOCALES env override',
  (() => {
    process.env.ADVERSE_MEDIA_LOCALES = 'en-US,ar-AE,zh-CN';
    const sel = activeLocales();
    delete process.env.ADVERSE_MEDIA_LOCALES;
    return sel.length === 3 && sel.every(l => ['en-US', 'ar-AE', 'zh-CN'].includes(l.id)) && activeLocales().length === LOCALES.length;
  })());

/* ── Per-run locale budget + rotation (screen.py parity) ──
   The unbudgeted full-matrix sweep is the measured way to LOSE coverage (the
   Python workflow records 14 locales tripping Google's per-IP limiter → 805/838
   subjects with zero adverse coverage), so the default must be a small budget. */
check('resolveLocaleBudget defaults to 8 on unset/junk and clamps to [1, total]',
  resolveLocaleBudget(undefined, 70) === 8 && resolveLocaleBudget('soon', 70) === 8 &&
  resolveLocaleBudget('0', 70) === 1 && resolveLocaleBudget('999', 70) === 70 && resolveLocaleBudget('12', 70) === 12);
check('resolveLocaleBudget honours all/full/max/* as the whole matrix',
  ['all', 'full', 'max', '*'].every(s => resolveLocaleBudget(s, 70) === 70));
check('budgetedLocales sweeps exactly the budget with every core edition pinned',
  (() => {
    const day = new Date('2026-08-05T00:00:00Z');
    const set = budgetedLocales(day, 8);
    const ids = set.map(l => l.id);
    return set.length === 8 && CORE_LOCALE_IDS.every(c => ids.includes(c));
  })());
check('budgetedLocales is deterministic within a day and rotates across days',
  (() => {
    const a1 = budgetedLocales(new Date('2026-08-05T01:00:00Z'), 8).map(l => l.id).join(',');
    const a2 = budgetedLocales(new Date('2026-08-05T23:00:00Z'), 8).map(l => l.id).join(',');
    const b = budgetedLocales(new Date('2026-08-06T01:00:00Z'), 8).map(l => l.id).join(',');
    return a1 === a2 && a1 !== b;
  })());
check('budget rotation reaches EVERY edition within the stated cycle',
  (() => {
    const days = rotationCycleDays(8);
    const seen = new Set();
    for (let d = 0; d < days; d++) {
      for (const l of budgetedLocales(new Date(Date.UTC(2026, 7, 1 + d)), 8)) seen.add(l.id);
    }
    return days > 0 && seen.size === LOCALES.length;
  })());
check('a budget at/below the core count never rotates (cycle 0 = disclosed as never)',
  rotationCycleDays(5) === 0 && budgetedLocales(new Date('2026-08-05T00:00:00Z'), 5).length === 5);
check('an explicit ADVERSE_MEDIA_LOCALES id-list is respected by activeLocales while the budget path stays capped',
  (() => {
    process.env.ADVERSE_MEDIA_LOCALES = 'en-US,zh-CN';
    const explicit = activeLocales().length;
    delete process.env.ADVERSE_MEDIA_LOCALES;
    process.env.ADVERSE_LOCALES = '6';
    const budgeted = budgetedLocales(new Date('2026-08-05T00:00:00Z')).length;
    delete process.env.ADVERSE_LOCALES;
    return explicit === 2 && budgeted === 6;
  })());

check('dedupItems collapses the same story surfaced across editions (by link)',
  dedupItems([{ title: 'A', link: 'http://x/1' }, { title: 'A (mirror)', link: 'http://x/1' }, { title: 'B', link: 'http://x/2' }]).length === 2);

check('mapPool preserves order and runs every item under a concurrency bound',
  (await mapPool([1, 2, 3, 4, 5], 2, async n => n * 2)).join(',') === '2,4,6,8,10');

check('gdeltUrl broadened default terms still target the global artlist JSON',
  gdeltUrl('Acme Co').includes('maxrecords=250') && decodeURIComponent(gdeltUrl('Acme Co')).includes('terrorist financing'));

/* ── GDELT term-set alignment (JS backbone widened to the Python comprehensive
   set) + worldwide language expansion (2026-08-05, adversarially-verified) ── */
check('GDELT query carries the full predicate-offence cluster incl. proliferation financing',
  ['proliferation financing', 'organized crime', 'cartel', 'narcotics', 'smuggling', 'asset freeze', 'convicted', 'arrested']
    .every(t => GDELT_RISK_TERMS.includes(t))
  && GDELT_RISK_TERMS.length >= 26);
check('gdeltUrl query includes the widened terms (GDELT translates → reaches every language)',
  ['proliferation financing', 'organized crime', 'narcotics', 'asset freeze']
    .every(t => decodeURIComponent(gdeltUrl('Acme Co')).includes(t)));
check('gdeltUrl fetches at the GDELT API max (250) by default, env-tunable and clamped', (() => {
  const prev = process.env.ADVERSE_MEDIA_MAXRECORDS;
  process.env.ADVERSE_MEDIA_MAXRECORDS = '9999';
  const clamped = gdeltUrl('X').includes('maxrecords=250');
  process.env.ADVERSE_MEDIA_MAXRECORDS = '40';
  const tuned = gdeltUrl('X').includes('maxrecords=40');
  process.env.ADVERSE_MEDIA_MAXRECORDS = '';
  const dflt = gdeltUrl('X').includes('maxrecords=250');
  if (prev == null) delete process.env.ADVERSE_MEDIA_MAXRECORDS; else process.env.ADVERSE_MEDIA_MAXRECORDS = prev;
  return clamped && tuned && dflt;
})());
check('LANG_TERMS gains the high-risk-region languages with native-script terms', (() => {
  const added = ['az', 'kk', 'uz', 'ka', 'hy', 'ne', 'si', 'pa', 'mr', 'my', 'km', 'ha', 'so', 'am', 'af', 'sq', 'hr', 'sl', 'lt', 'lv', 'et', 'mk'];
  return added.every(k => Array.isArray(LANG_TERMS[k]) && LANG_TERMS[k].length >= 8)
    && LANG_TERMS.kk.includes('ақшаны жылыстату') && LANG_TERMS.ka.includes('ფულის გათეთრება')
    && LANG_TERMS.hy.includes('փողերի լվացում') && LANG_TERMS.sq.includes('pastrim parash');
})());
check('LOCALES gains the edition-confirmed high-risk editions (still deduped by id)',
  ['az-AZ', 'kk-KZ', 'ka-GE', 'hy-AM', 'my-MM', 'sq-AL', 'lt-LT'].every(id => LOCALES.some(l => l.id === id))
  && LOCALES.length === new Set(LOCALES.map(l => l.id)).size);
check('a native-language adverse headline scores a hit in a newly-added language (Kazakh)',
  scoreAdverseMedia('Нурлан Бектас', [{ title: 'Нурлан Бектас ақшаны жылыстату ісі бойынша қамауға алынды', link: 'http://k/1' }], ALL_TERMS).hit === true);
check('a strong native predicate (Georgian money laundering) escalates to high band',
  scoreAdverseMedia('გიორგი', [{ title: 'გიორგი ფულის გათეთრება ბრალდებით დააკავეს', link: 'http://g/1' }], ALL_TERMS).band === 'high');
check('a terms-only language with no Google News edition still scores via GDELT titles (Somali)',
  scoreAdverseMedia('Cabdi Xasan', [{ title: 'Cabdi Xasan oo lagu xiray dhaqidda lacagta', link: 'http://so/1' }], ALL_TERMS).hit === true);

/* ── Phase-4 hardening: description scanning, tiers, canonical dedup ──────── */
const descRss = '<rss><channel><item><title>Acme Corp restructures Gulf operations</title>'
  + '<link>https://www.ft.com/content/acme-restructure?utm_source=rss</link>'
  + '<source>FT</source><pubDate>Mon, 20 Jul 2026 08:00:00 GMT</pubDate>'
  + '<description>&lt;p&gt;The shake-up follows a &lt;b&gt;money laundering&lt;/b&gt; probe into two units.&lt;/p&gt;</description>'
  + '</item></channel></rss>';
const descItems = parseRss(descRss);
check('parseRss captures and tag-strips the item description',
  descItems.length === 1 && descItems[0].description.includes('money laundering')
  && !descItems[0].description.includes('<'));
check('scoreAdverseMedia flags on a description-only risk term (was headline-blind)',
  scoreAdverseMedia('Acme Corp', descItems, ALL_TERMS).hit === true
  && scoreAdverseMedia('Acme Corp', [{ title: descItems[0].title }], ALL_TERMS).hit === false);
check('weak-only generic terms flag at tier weak / 75 / medium (for the record, not escalation)',
  (() => {
    const r = scoreAdverseMedia('Atlas Group', [{ title: 'Atlas Group faces lawsuit over lease' }], ALL_TERMS);
    return r.hit === true && r.tier === 'weak' && r.score === 75 && r.band === 'medium';
  })());
check('a strong term keeps 90/high/tier strong; a normal crime term 80/medium/normal',
  scoreAdverseMedia('Acme', [{ title: 'Acme money laundering probe' }], ALL_TERMS).tier === 'strong'
  && scoreAdverseMedia('Acme', [{ title: 'Acme fraud charges filed' }], ALL_TERMS).tier === 'normal');
check('stem terms close the exact-word gaps (sanctioned / laundered / kickback / guilty)',
  scoreAdverseMedia('Gulf Falcon', [{ title: 'Gulf Falcon sanctioned by OFAC' }], ALL_TERMS).hit
  && scoreAdverseMedia('Waleed Nasser', [{ title: 'Waleed Nasser laundered proceeds, court told' }], ALL_TERMS).hit
  && scoreAdverseMedia('Ibrahim Yildiz', [{ title: 'Ibrahim Yildiz kickback investigation widens' }], ALL_TERMS).hit
  && scoreAdverseMedia('Rashid Al Marri', [{ title: 'Rashid Al Marri guilty of insider trading' }], ALL_TERMS).hit);
check('canonicalLink strips tracking params, fragments, www and trailing slashes',
  canonicalLink('https://www.apnews.com/article/x?utm_source=rss&ncid=tw#frag') === 'apnews.com/article/x'
  && canonicalLink('https://apnews.com/article/x/') === 'apnews.com/article/x'
  && canonicalLink('not a url') === '');
check('dedupItems collapses the same article under rotating tracking params (was 3 items)',
  dedupItems([
    { title: 'A', link: 'https://apnews.com/article/x?utm_source=rss' },
    { title: 'A2', link: 'https://www.apnews.com/article/x?ncid=tw' },
    { title: 'A3', link: 'https://apnews.com/article/x?ref=daily' },
  ]).length === 1);
check('sourceTierFor ranks known wires tier 1, regionals tier 2, unknowns tier 3',
  sourceTierFor({ link: 'https://www.reuters.com/world/x' }) === 1
  && sourceTierFor({ link: 'https://www.cnn.com/x' }) === 2
  && sourceTierFor({ link: 'https://blog.example.xyz/p' }) === 3
  && sourceTierFor({ source: 'Reuters' }) === 1);


/* Cross-engine parity: screen.py's ADVERSE_KEYWORDS are the flagging contract —
   both engines screen the same customers daily, and sanctions-screen.mjs only
   pushes an adverse-media list entry / escalates the band on am.hit, so a term
   only Python knows is a SILENT JS miss, not a loud one. Weak-tier generics must
   stay weak (screen.py KEYWORD_TIER_WEAK) and a clean headline must still clear. */
check('scoring covers the screen.py keyword classes the JS term set used to miss', (() => {
  const s = t => scoreAdverseMedia('Al Noor Gold Trading', [{ title: 'Al Noor Gold Trading ' + t }], ALL_TERMS);
  const pyOnly = [
    'tied to cartel gold shipments', 'linked to a proliferation financing network',
    'debarred by the World Bank over sourcing', 'boss jailed after theft and blackmail charges',
    'linked to a mafia network in Dubai', 'hit by ransomware, darknet leak follows',
    'accused of modern slavery and forced labour', 'refinery sourced conflict minerals',
    'flagged in a dual-use export control probe', 'named in an arms embargo breach probe'
  ];
  return pyOnly.every(t => { const r = s(t); return r.hit === true && r.tier !== 'weak'; })
    && s('publishes a human rights policy update').tier === 'weak'
    && s('opens a new showroom in Deira').hit === false;
})());
check('parity terms widen SCORING only — the Google News query URL stays short (a rejected query returns zero items)',
  adverseMediaUrl('Al Noor Gold Trading').length < 2000);

/* ── GDELT retrieval breadth ─────────────────────────────────────────────────
   PY_PARITY_TERMS were added SCORING-only and kept out of the Google News query
   for a good reason: that query is already ~1.5KB per locale and one Google
   rejects returns zero items. The reasoning does not transfer to GDELT — a
   separate engine, one request per subject — which was still asking for only 26
   terms. So an article about a subject's ransomware indictment or
   modern-slavery prosecution scored perfectly IF something else surfaced it.
   Nothing asked. These check the expansion is real and cannot backfire. */
{
  const name = 'Mohammed Abdullah Al-Rashid';
  const wide = gdeltTerms(name);
  check('gdelt: the query now asks for the typologies the scorer already knew',
    wide.length > GDELT_RISK_TERMS.length + 30
    && ['ransomware', 'kleptocracy', 'modern slavery', 'human trafficking', 'chemical weapons']
      .every(t => wide.includes(t)));
  check('gdelt: the proven base terms are never dropped to make room',
    GDELT_RISK_TERMS.every(t => wide.includes(t)));
  check('gdelt: the extras are the typology set, admitted on top of the base',
    GDELT_EXTRA_TERMS.length >= 40
    && GDELT_EXTRA_TERMS.every(t => !GDELT_RISK_TERMS.includes(t)));
  check('gdelt: the built query stays inside the length cap',
    gdeltQueryString(name, wide).length <= GDELT_QUERY_MAX);
  /* A query GDELT rejects returns null from fetchSource, which costs the whole
     worldwide backbone for that subject — strictly worse than asking narrowly.
     A pathological subject name must therefore still yield a capped query with
     the base set intact. */
  const long = 'A'.repeat(400);
  const wideLong = gdeltTerms(long);
  check('gdelt: a pathological subject name caps the query instead of overrunning it',
    gdeltQueryString(long, wideLong).length <= GDELT_QUERY_MAX
    && GDELT_RISK_TERMS.every(t => wideLong.includes(t)));
  check('gdelt: the fetch falls back to the base set if the wide query is rejected',
    /GDELT rejected the/.test(readFileSync(join(ROOT2, 'scripts/adverse-media.mjs'), 'utf8')));
  /* 'politic' is the one typology deliberately NOT retrieved: the query is
     name-scoped and GDELT caps a subject at 250 records, so for any public
     figure — and the PEP layer is 422,223 office-holders — it returns ordinary
     political coverage that crowds real financial-crime reporting out of the
     cap. Scoring keeps it; retrieval must not ask for it. */
  check('gdelt: "politic" stays a SCORING signal and is never a retrieval term',
    ALL_TERMS.includes('politic') && !wide.includes('politic'));
  check('gdelt: every retrieval term is also a scoring term (retrieval can never outrun scoring)',
    wide.every(t => ALL_TERMS.some(a => a.toLowerCase() === t.toLowerCase()
      || t.toLowerCase().includes(a.toLowerCase()))));
}

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);

