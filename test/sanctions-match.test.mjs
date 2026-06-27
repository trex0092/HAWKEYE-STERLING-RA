/* Unit tests for the in-repo sanctions matcher (no network).
   Usage: node test/sanctions-match.test.mjs */
import {
  normalizeName, sigTokens, parseDelimited, parseOfacCsv, parseUnXml, parseOfsiCsv,
  parseEuCsv, parseGenericXml, parseSecoXml, parseCuratedList, parseList, levenshtein, similarity,
  buildIndex, screenName
} from '../scripts/sanctions-match.mjs';

let passed = 0, failed = 0;
function check(name, cond) {
  if (cond) { passed++; console.log('  ok  ' + name); }
  else { failed++; console.log('FAIL  ' + name); }
}

/* ── name folding / tokens ── */
check('normalizeName folds case, punctuation, diacritics',
  normalizeName('YÜKSEL KIYMETLİ A.Ş.') === normalizeName('yuksel kiymetli a s'));
check('sigTokens drops corp suffixes and short/numeric tokens',
  JSON.stringify(sigTokens(normalizeName('WPM Int LLC 12'))) === JSON.stringify(['wpm', 'int']));

/* ── CSV parsing (quotes, embedded commas, custom delimiter) ── */
const rows = parseDelimited('a,"b,c",d\n"e""f",g,h\n', ',');
check('parseDelimited handles quoted commas + escaped quotes',
  rows.length === 2 && rows[0][1] === 'b,c' && rows[1][0] === 'e"f');
check('parseDelimited supports a semicolon delimiter',
  parseDelimited('x;y;z', ';')[0].join('|') === 'x|y|z');

/* ── OFAC (no header, name in col 2, -0- empties) ── */
const ofac = parseOfacCsv('1,"AEROCARIBBEAN AIRLINES",entity,CUBA,-0-\n2,"DOE, JOHN",individual,SDGT,-0-\n');
check('parseOfacCsv pulls col-2 names', ofac.length === 2 && ofac[0] === 'AEROCARIBBEAN AIRLINES' && ofac[1] === 'DOE, JOHN');

/* ── UN XML (primary name parts + aliases, entities + individuals) ── */
const un = parseUnXml(
  '<INDIVIDUAL><FIRST_NAME>Kim</FIRST_NAME><SECOND_NAME>Jong</SECOND_NAME><THIRD_NAME>Un</THIRD_NAME>' +
  '<INDIVIDUAL_ALIAS><ALIAS_NAME>Kim Jong-un</ALIAS_NAME></INDIVIDUAL_ALIAS></INDIVIDUAL>' +
  '<ENTITY><FIRST_NAME>ACME TRADING FZE</FIRST_NAME><ENTITY_ALIAS><ALIAS_NAME>ACME FZE</ALIAS_NAME></ENTITY_ALIAS></ENTITY>');
check('parseUnXml joins name parts + collects aliases for individuals & entities',
  un.includes('Kim Jong Un') && un.includes('Kim Jong-un') && un.includes('ACME TRADING FZE') && un.includes('ACME FZE'));

/* ── UK OFSI (banner, header, Name N columns) ── */
const ofsi = parseOfsiCsv('Last Updated:,30/05/2026\nName 6,Name 1,Name 2,Group ID\nPUTIN,Vladimir,Vladimirovich,123\nROSNEFT,0,0,456\n');
check('parseOfsiCsv finds header below a banner and joins Name columns',
  ofsi.includes('Vladimir Vladimirovich PUTIN') && ofsi.includes('ROSNEFT'));

/* ── EU (semicolon, WholeName preferred) ── */
const eu = parseEuCsv('Id;NameAlias_WholeName;NameAlias_FirstName;NameAlias_LastName\n1;Vladimir Putin;Vladimir;Putin\n2;;Ivan;Ivanov\n');
check('parseEuCsv prefers WholeName, falls back to first+last',
  eu.includes('Vladimir Putin') && eu.includes('Ivan Ivanov'));

/* ── generic national XML (Canada/SECO shape) ── */
const gx = parseGenericXml('<record><GivenName>John</GivenName><LastName>Smith</LastName><Aliases>Johnny Smith/J. Smith</Aliases></record><record><Entity>BAD CORP LLC</Entity></record>');
check('parseGenericXml extracts given+last, entity, split aliases',
  gx.includes('John Smith') && gx.includes('Johnny Smith') && gx.includes('J. Smith') && gx.includes('BAD CORP LLC'));

/* ── SECO XML (nested <name>/<name-part>/<value>; individuals + entities + aliases) ── */
const seco = parseSecoXml(
  '<sanctions>' +
  '<target ssid="1"><identity main="true">' +
  '<name name-type="primary-name"><name-part name-part-type="given-name"><value>Vladimir</value></name-part>' +
  '<name-part name-part-type="family-name"><value>Putin</value></name-part></name>' +
  '<name name-type="alias"><name-part name-part-type="whole-name"><value>V. Putin</value></name-part></name>' +
  '</identity></target>' +
  '<target ssid="2"><identity><name name-type="primary-name"><name-part name-part-type="whole-name"><value>ROSNEFT OIL COMPANY</value></name-part></name></identity></target>' +
  '</sanctions>');
check('parseSecoXml joins name-parts and collects entities + aliases',
  seco.includes('Vladimir Putin') && seco.includes('V. Putin') && seco.includes('ROSNEFT OIL COMPANY'));
check('parseList routes the seco parser', parseList({ id: 'ch-seco', parser: 'seco', type: 'xml' },
  '<name><name-part><value>ACME</value></name-part><name-part><value>FZE</value></name-part></name>').join('|') === 'ACME FZE');
/* real SECO values carry attributes (lang/script) and sometimes CDATA — both
   must still be screened or a designated name is silently dropped (false negative) */
const secoAttr = parseSecoXml(
  '<name name-type="primary-name"><name-part name-part-type="given-name"><value lang="en">Vladimir</value></name-part>' +
  '<name-part name-part-type="family-name"><value lang="en">Putin</value></name-part></name>' +
  '<name name-type="alias"><name-part name-part-type="whole-name"><value><![CDATA[Al-Qaeda]]></value></name-part></name>');
check('parseSecoXml keeps attributed <value> tags and unwraps CDATA (no dropped names)',
  secoAttr.includes('Vladimir Putin') && secoAttr.includes('Al-Qaeda'));

/* ── curated list (strings + objects with aliases) ── */
const cur = parseCuratedList({ entries: ['Foo Bar', { name: 'Baz Co', aliases: ['Baz Limited'] }] });
check('parseCuratedList reads strings and {name,aliases}', cur.join('|') === 'Foo Bar|Baz Co|Baz Limited');
check('parseList dispatches by parser field', parseList({ parser: 'ofac' }, '1,ACME,entity').join() === 'ACME');

/* ── similarity ── */
check('levenshtein basic', levenshtein('kitten', 'sitting') === 3);
check('similarity 100 on identical', similarity('vladimir putin', 'vladimir putin') === 100);
check('similarity high on reordered tokens', similarity(normalizeName('Putin Vladimir'), normalizeName('Vladimir Vladimirovich Putin')) >= 85);
check('similarity low on unrelated', similarity('acme trading', 'global widgets') < 60);

/* ── end-to-end screening ── */
const index = buildIndex([
  { id: 'un', name: 'UN', names: ['Kim Jong Un', 'ACME TRADING FZE'] },
  { id: 'ofac', name: 'OFAC SDN', names: ['Vladimir Vladimirovich Putin'] }
]);
const exact = screenName('ACME TRADING FZE', index, 85);
check('screenName flags an exact list hit as critical', exact.hitCount === 1 && exact.topScore === 100 && exact.band === 'critical' && exact.recommendation === 'sanctions-match');
const fuzzy = screenName('Vladimir Putin', index, 85);
check('screenName flags a fuzzy/partial name match', fuzzy.hitCount >= 1 && fuzzy.topScore >= 85 && fuzzy.lists[0].list === 'OFAC SDN');
const clean = screenName('Helga Andersen Bakery', index, 85);
check('screenName clears an unrelated subject', clean.hitCount === 0 && clean.recommendation === 'clear' && clean.band === 'low');

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
