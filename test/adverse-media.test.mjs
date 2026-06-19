/* Unit tests for adverse-media screening pure logic (no network).
   Usage: node test/adverse-media.test.mjs */
import { adverseMediaUrl, parseRss, scoreAdverseMedia, ADVERSE_TERMS } from '../scripts/adverse-media.mjs';

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

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
