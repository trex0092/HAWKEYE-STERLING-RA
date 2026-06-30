/* Unit tests for adverse-media screening pure logic (no network).
   Usage: node test/adverse-media.test.mjs */
import { adverseMediaUrl, adverseMediaUrlAr, gdeltUrl, parseRss, parseGdelt, scoreAdverseMedia, ADVERSE_TERMS, ADVERSE_TERMS_AR } from '../scripts/adverse-media.mjs';

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
check('parseGdelt tolerates malformed JSON (returns [])', Array.isArray(parseGdelt('{not json')) && parseGdelt('{not json').length === 0);

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

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
