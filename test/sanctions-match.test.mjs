/* Unit tests for the in-repo sanctions matcher (no network).
   Usage: node test/sanctions-match.test.mjs */
import {
  normalizeName, sigTokens, parseDelimited, parseOfacCsv, parseOfacAltCsv, parseOfacXml, parseUnXml, parseOfsiCsv,
  parseEuCsv, parseGenericXml, parseSecoXml, parseCuratedList, parseList, levenshtein, similarity,
  buildIndex, screenName, nameVariants, indelRatio, tokenSetRatio, isTokenSubset,
  MANUAL_REVIEW_LIST, TOKENSET_THRESHOLD, lostScriptLetters,
  unzipEntries, parseSharedStrings, parseSheetRows, parseDfatXlsx, parseJsonList
} from '../scripts/sanctions-match.mjs';
import { deflateRawSync } from 'node:zlib';

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

/* ── OFAC alt.csv (SDN a.k.a. names — headerless, alias in col 4, -0- empties).
   Regression: screening only sdn.csv's primary names left every SDN alias
   unscreened (a party operating under an a.k.a. silently cleared). ── */
const ofacAlt = parseOfacAltCsv('36,12,"aka","AL QAIDA",-0-\n36,13,"aka","-0-",note\n37,14,"fka","THE BASE",-0-\n38,15,"aka","",x\n');
check('parseOfacAltCsv pulls col-4 alias names, skips -0- and blanks',
  ofacAlt.join('|') === 'AL QAIDA|THE BASE');
check('parseList routes parser=ofacalt to the alt.csv parser (before the generic ofac→CSV rule)',
  parseList({ id: 'ofac-sdn-alt', parser: 'ofacalt' }, '1,2,aka,USAMA BIN LADEN,-0-').join() === 'USAMA BIN LADEN');

/* ── OFAC XML (CONSOLIDATED.XML / SDN.XML: sdnEntry, individual first+last,
   entity full name in lastName, akaList aliases) ── */
const ofacXml = parseOfacXml(
  '<sdnList><sdnEntry><uid>1</uid><firstName>John</firstName><lastName>Doe</lastName><sdnType>Individual</sdnType>' +
  '<akaList><aka><firstName>Johnny</firstName><lastName>Doe</lastName></aka></akaList></sdnEntry>' +
  '<sdnEntry><uid>2</uid><lastName>ACME TRADING FZE</lastName><sdnType>Entity</sdnType></sdnEntry></sdnList>');
check('parseOfacXml reads individual first+last, entity full name, and akaList aliases',
  ofacXml.includes('John Doe') && ofacXml.includes('Johnny Doe') && ofacXml.includes('ACME TRADING FZE'));
check('parseOfacXml does not leak alias names into the primary entry name',
  !ofacXml.includes('John Johnny'));
check('parseList routes parser=ofacxml to the OFAC XML parser (not CSV)',
  parseList({ id: 'ofac-consolidated', parser: 'ofacxml', type: 'xml' },
    '<sdnList><sdnEntry><lastName>TEST ENTITY LLC</lastName><sdnType>Entity</sdnType></sdnEntry></sdnList>').includes('TEST ENTITY LLC'));

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

/* ── XLSX reader (Australia DFAT is published only as .xlsx) ── */
/* Build a real, minimal .xlsx (ZIP of DEFLATE-compressed XML parts) so the whole
   path — ZIP central-directory read → inflate → sharedStrings → worksheet →
   name-column extraction — is exercised end to end, offline. */
function makeZip(entries) {
  const fileChunks = [], cdChunks = [];
  let offset = 0;
  for (const e of entries) {
    const nameBuf = Buffer.from(e.name, 'utf8');
    const raw = Buffer.from(e.data, 'utf8');
    const comp = deflateRawSync(raw);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(8, 8);
    local.writeUInt32LE(comp.length, 18); local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    fileChunks.push(local, nameBuf, comp);
    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0); cd.writeUInt16LE(20, 4); cd.writeUInt16LE(20, 6); cd.writeUInt16LE(8, 10);
    cd.writeUInt32LE(comp.length, 20); cd.writeUInt32LE(raw.length, 24);
    cd.writeUInt16LE(nameBuf.length, 28); cd.writeUInt32LE(offset, 42);
    cdChunks.push(cd, nameBuf);
    offset += 30 + nameBuf.length + comp.length;
  }
  const fileData = Buffer.concat(fileChunks), cdData = Buffer.concat(cdChunks);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8); eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(cdData.length, 12); eocd.writeUInt32LE(fileData.length, 16);
  return Buffer.concat([fileData, cdData, eocd]);
}

const SHARED = '<sst>' +
  ['Reference', 'Name Type', 'Name', 'Type', 'Primary Name', 'Vladimir Putin',
   'alias', 'V. V. Putin', 'Rosneft Oil Company', 'Individual', 'Entity']
    .map(s => '<si><t>' + s + '</t></si>').join('') + '</sst>';
const SHEET = '<worksheet><sheetData>' +
  '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c><c r="D1" t="s"><v>3</v></c></row>' +
  '<row r="2"><c r="A2"><v>1</v></c><c r="B2" t="s"><v>4</v></c><c r="C2" t="s"><v>5</v></c><c r="D2" t="s"><v>9</v></c></row>' +
  '<row r="3"><c r="A3"><v>1</v></c><c r="B3" t="s"><v>6</v></c><c r="C3" t="s"><v>7</v></c><c r="D3" t="s"><v>9</v></c></row>' +
  '<row r="4"><c r="A4"><v>2</v></c><c r="B4" t="s"><v>4</v></c><c r="C4" t="s"><v>8</v></c><c r="D4" t="s"><v>10</v></c></row>' +
  '</sheetData></worksheet>';
const xlsx = makeZip([
  { name: 'xl/sharedStrings.xml', data: SHARED },
  { name: 'xl/worksheets/sheet1.xml', data: SHEET },
]);

const zentries = unzipEntries(xlsx);
check('unzipEntries reads the ZIP central directory + inflates parts',
  zentriesHas(zentries, 'xl/sharedStrings.xml') && zentriesHas(zentries, 'xl/worksheets/sheet1.xml'));
function zentriesHas(map, k) { return map.has(k) && map.get(k).length > 0; }
check('parseSharedStrings indexes shared strings by id',
  parseSharedStrings(SHARED)[5] === 'Vladimir Putin');
check('parseSheetRows resolves shared-string cells at the right columns',
  parseSheetRows(SHEET, parseSharedStrings(SHARED))[1][2] === 'Vladimir Putin');
const dfat = parseDfatXlsx(xlsx);
check('parseDfatXlsx pulls the Name column (primary + alias rows), skips "Name Type"',
  dfat.length === 3 && dfat.includes('Vladimir Putin') && dfat.includes('V. V. Putin') && dfat.includes('Rosneft Oil Company'));
check('parseList routes the dfat/xlsx parser on a Buffer body',
  parseList({ id: 'au-dfat', parser: 'dfat', type: 'xlsx' }, xlsx).length === 3);
check('unzipEntries tolerates a non-zip buffer (degrades to empty, never throws)',
  unzipEntries(Buffer.from('not a zip')).size === 0 && parseDfatXlsx(Buffer.from('xx')).length === 0);

/* ── JSON list parser (national registers that publish JSON: France DGT, NZ, Ukraine) ── */
/* France DGT "Registre national des gels" shape: nested Publications →
   PublicationDetail[], individuals split Nom/Prenom, entities carry Nom, plus aliases. */
const frJson = JSON.stringify({
  Publications: {
    PublicationDetail: [
      { Nature: 'Personne physique', Nom: 'PUTIN', Prenom: 'Vladimir', Alias: ['Poutine'] },
      { Nature: 'Personne morale', Nom: 'ROSNEFT OIL COMPANY' },
    ],
  },
});
const fr = parseJsonList(frJson);
check('parseJsonList assembles Prenom+Nom for individuals and Nom for entities (France DGT)',
  fr.includes('Vladimir PUTIN') && fr.includes('ROSNEFT OIL COMPANY'));
check('parseJsonList collects string aliases', fr.includes('Poutine'));
/* CKAN datastore shape (data.govt.nz): { result: { records: [ { Name: ... } ] } } */
const nz = parseJsonList({ result: { records: [{ Name: 'Some Entity' }, { fullName: 'A Person' }] } });
check('parseJsonList walks nested result.records and common name keys', nz.includes('Some Entity') && nz.includes('A Person'));
check('parseJsonList does not invent names from a nameless payload', parseJsonList({ meta: { count: 0 }, data: [] }).length === 0);
check('parseJsonList tolerates a bare array of {name} and dedups', JSON.stringify(parseJsonList([{ name: 'X' }, { name: 'X' }, { name: 'Y' }])) === JSON.stringify(['X', 'Y']));
check('parseList routes the json parser', parseList({ id: 'fr-dgt', parser: 'json' }, frJson).includes('ROSNEFT OIL COMPANY'));
check('parseJsonList tolerates malformed JSON (returns [])', parseJsonList('{not json').length === 0);

/* ── curated list (strings + objects with aliases) ── */
const cur = parseCuratedList({ entries: ['Foo Bar', { name: 'Baz Co', aliases: ['Baz Limited'] }] });
check('parseCuratedList reads strings and {name,aliases}', cur.join('|') === 'Foo Bar|Baz Co|Baz Limited');
check('parseList dispatches by parser field', parseList({ parser: 'ofac' }, '1,ACME,entity').join() === 'ACME');
/* A malformed curated/local list must degrade to [] (best-effort), never throw and
   abort the whole daily screen — matches every sibling parser's contract. */
check('parseCuratedList returns [] on truncated JSON (no throw)', Array.isArray(parseCuratedList('{bad json')) && parseCuratedList('{bad json').length === 0);
check('parseCuratedList returns [] on a JSON scalar/null body', parseCuratedList('null').length === 0 && parseCuratedList('42').length === 0);
check('parseList(curated) on a corrupt body degrades to [] instead of crashing', parseList({ type: 'curated' }, '{').length === 0);
/* Astral-plane (>U+FFFF) numeric XML refs decode to the real glyph, not a NUL. */
const astral = parseUnXml('<INDIVIDUAL><FIRST_NAME>Test &#131072; Name</FIRST_NAME></INDIVIDUAL>');
check('XML numeric entity above the BMP decodes via fromCodePoint (no NUL truncation)',
  astral.length === 1 && astral[0].includes('\u{20000}') && !astral[0].includes(' '));

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

/* ── transliteration variants (regression: the exact-token candidate index was
   blind to a subject spelled "Mohammed …" against a listed "MUHAMMAD …" — no
   shared token, no candidates, silent clear at topScore 0) ── */
const nv = nameVariants('mohammed husein trading llc');
check('nameVariants keeps the base spelling and adds whole-word group swaps',
  nv.has('mohammed husein trading llc') && nv.has('muhammad husein trading llc') && nv.has('mohammed hussein trading llc'));
check('nameVariants swaps whole words only (no corruption inside "salah")',
  [...nameVariants('salah co')].join('|') === 'salah co');
check('nameVariants is deterministically capped with the base always retained',
  nameVariants('mohammed bin abdul al ahmed yousef hussein sheikh ismail').size <= 13
  && nameVariants('mohammed bin abdul al ahmed yousef hussein sheikh ismail').has('mohammed bin abdul al ahmed yousef hussein sheikh ismail'));
check('nameVariants of an empty fold is empty', nameVariants('').size === 0);
const vIdx = buildIndex([{ id: 'ofac', name: 'OFAC SDN', names: ['MUHAMMAD HUSSEIN'] }]);
const vHit = screenName('Mohammed Husein Trading LLC', vIdx, 85);
check('variant spelling reaches the candidate index and flags (was a silent clear)',
  vHit.hitCount === 1 && vHit.topScore >= 85 && vHit.recommendation === 'sanctions-match');
check('a variant equal to a designated name is an exact 100 hit',
  screenName('Usama Ibn Laden', buildIndex([{ id: 'o', name: 'OFAC SDN', names: ['USAMA BIN LADEN'] }]), 85).topScore === 100);
/* Core-vs-core scoring: corp boilerplate must not hide a one-letter typo. */
check('similarity scores the stopword-stripped cores too (typo behind a corp suffix)',
  similarity(normalizeName('Muhamad Hussein Trading LLC'), normalizeName('MUHAMMAD HUSSEIN')) >= 85);
check('similarity is still low on unrelated names with distinct cores',
  similarity(normalizeName('Falcon Star Metals LLC'), normalizeName('Northern Route Logistics')) < 60);

/* ── subset / patronymic recall gate (screen.py _is_token_subset parity;
   regression: "Quds Force" scored 73 vs the full IRGC chain and "Usama Bin
   Ladin" 84 vs the full listed chain — both silently cleared at 85) ── */
check('indelRatio matches rapidfuzz ratio semantics (hussein/husein ≥ 88, ladin/laden < 88)',
  indelRatio('hussein', 'husein') >= 88 && indelRatio('ladin', 'laden') < 88 && indelRatio('a', 'a') === 100);
check('tokenSetRatio is 100 for a token subset and low for unrelated names',
  tokenSetRatio('quds force', 'islamic revolutionary guard corps quds force') === 100
  && tokenSetRatio('acme trading', 'global widgets') < TOKENSET_THRESHOLD);
check('isTokenSubset is symmetric by token count and needs ≥2 distinctive tokens',
  isTokenSubset('quds force', 'islamic revolutionary guard corps quds force')
  && isTokenSubset('islamic revolutionary guard corps quds force', 'quds force')
  && !isTokenSubset('sberbank', 'sberbank of russia'));
const irgcIdx = buildIndex([{ id: 'o', name: 'OFAC SDN', names: ['ISLAMIC REVOLUTIONARY GUARD CORPS QUDS FORCE'] }]);
const quds = screenName('Quds Force', irgcIdx, 85);
check('subset gate flags the short spelling of a long designated chain (was a silent clear)',
  quds.hitCount === 1 && quds.recommendation === 'sanctions-match');
const qudsSup = screenName('Islamic Revolutionary Guard Corps Quds Force',
  buildIndex([{ id: 'o', name: 'OFAC SDN', names: ['QUDS FORCE'] }]), 85);
check('subset gate flags the superset direction too (KYC name on either side)',
  qudsSup.hitCount === 1 && qudsSup.recommendation === 'sanctions-match');
const usama = screenName('Usama Bin Ladin', buildIndex([{ id: 'o', name: 'OFAC SDN', names: ['USAMA BIN MUHAMMAD BIN AWAD BIN LADIN'] }]), 85);
check('subset gate flags the patronymic-chain case at its conservative score',
  usama.hitCount === 1 && usama.topScore < 85 && usama.recommendation === 'sanctions-match');
check('a single shared token can never subset-flag (Sberbank stays clear)',
  screenName('Sberbank', buildIndex([{ id: 'o', name: 'OFAC SDN', names: ['SBERBANK OF RUSSIA'] }]), 85).hitCount === 0);

/* ── manual-review routing (screen.py _unscreenable parity; regression: a name
   with no distinctive tokens had no candidate path and silently cleared) ── */
const mrIdx = buildIndex([{ id: 'o', name: 'OFAC SDN', names: ['SOME ENTITY LLC'] }]);
const yuLi = screenName('Yu Li', mrIdx, 85);
check('all-short-token name routes to MANUAL REVIEW, never a silent clear',
  yuLi.recommendation === 'review' && yuLi.hitCount === 1 && yuLi.lists[0].list === MANUAL_REVIEW_LIST && yuLi.topScore === 0);
check('symbols-only name routes to MANUAL REVIEW',
  screenName('☠ ☠', mrIdx, 85).recommendation === 'review');
check('an exact designated-name match beats the manual-review routing',
  screenName('Yu Li', buildIndex([{ id: 'o', name: 'OFAC SDN', names: ['YU LI'] }]), 85).topScore === 100);
check('an empty subject name stays clear (nothing to review)',
  screenName('', mrIdx, 85).recommendation === 'clear');

/* ── non-Latin scripts (regression: [^a-z0-9] erased Arabic/Cyrillic names,
   folding them to the empty key — zero tokens, zero candidates, silent clear) ── */
check('normalizeName keeps Arabic letters (harakat stripped)',
  normalizeName('مُحَمَّد صَالِح') === normalizeName('محمد صالح') && normalizeName('محمد صالح').length > 0);
check('normalizeName keeps Cyrillic letters',
  normalizeName('Владимир Путин') === 'владимир путин');
const arIndex = buildIndex([{ id: 'un', name: 'UN Consolidated', names: ['محمد صالح الحوثي'] }]);
const arHit = screenName('محمد صالح الحوثي', arIndex, 85);
check('Arabic-script subject matches an Arabic-script designation (not a silent clear)',
  arHit.hitCount === 1 && arHit.topScore === 100);
const cyIndex = buildIndex([{ id: 'ofac', name: 'OFAC SDN', names: ['Владимир Владимирович Путин'] }]);
const cyHit = screenName('Владимир Путин', cyIndex, 85);
check('Cyrillic-script subject fuzzy-matches a Cyrillic designation',
  cyHit.hitCount >= 1 && cyHit.topScore >= 85);

/* ── lost-script routing (screen.py _lost_script_letters parity; regression:
   a non-Latin-script subject vs the LATIN-published lists kept its any-script
   tokens, found no bucket, and silently cleared at 0 — the exact class the
   engine audit named, and the shipped lists ARE Latin) ── */
check('Arabic letters count as lost by the Latin fold', lostScriptLetters('محمد صالح TRADING LLC'));
check('diacritic Latin folds cleanly — not flagged', !lostScriptLetters('Müller İnönü Trading'));
check('Turkish dotless ı folds cleanly — not flagged', !lostScriptLetters('yatırım holding'));
check('pure ASCII is not flagged', !lostScriptLetters('Acme General Trading LLC'));
const latinIdx = buildIndex([{ id: 'un', name: 'UN Consolidated', names: ['MOHAMED SALAH AL ZAWARI'] }]);
const arVsLatin = screenName('محمد صالح الزواري', latinIdx, 85);
check('Arabic-script subject vs Latin-published lists routes to MANUAL REVIEW, never a silent clear',
  arVsLatin.recommendation === 'review' && arVsLatin.lists[0].list === MANUAL_REVIEW_LIST);
const mixVsLatin = screenName('محمد صالح TRADING LLC', latinIdx, 85);
check('mixed-script subject with only boilerplate residue also routes to MANUAL REVIEW',
  mixVsLatin.recommendation === 'review');
check('same-script curated match still beats the lost-script routing',
  screenName('محمد صالح الحوثي', arIndex, 85).recommendation === 'sanctions-match');
check('a Latin subject that clears is untouched by the lost-script routing',
  screenName('Totally Unrelated Firm', latinIdx, 85).recommendation === 'clear');

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
