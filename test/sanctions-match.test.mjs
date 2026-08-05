/* Unit tests for the in-repo sanctions matcher (no network).
   Usage: node test/sanctions-match.test.mjs */
import {
  normalizeName, sigTokens, parseDelimited, parseOfacCsv, parseOfacAltCsv, parseOfacXml, parseUnXml, parseOfsiCsv,
  parseEuCsv, parseOpenSanctionsCsv, parseGenericXml, parseSecoXml, parseCuratedList, parseList, levenshtein, similarity,
  buildIndex, screenName, nameVariants, translitCanonToken, indelRatio, tokenSetRatio, isTokenSubset,
  MANUAL_REVIEW_LIST, TOKENSET_THRESHOLD, lostScriptLetters, trigramsOf, fuzzyTokenMatches,
  unzipEntries, parseSharedStrings, parseSheetRows, parseDfatXlsx, parseSatCsv, parseJsonList,
  phoneticKey, phonTokens, phoneticProfile, phoneticPairMatch
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

/* ── OpenSanctions targets.simple.csv (comma CSV: name + ;-separated aliases).
   Regression: au-dfat-opensanctions declared parser "eu", and the semicolon
   split read the whole simple.csv as one column — 0 names, i.e. the entire
   DFAT mirror silently unscreened (masked until the egress fix let the
   download through, observed live 2026-08-01). ── */
const osBody = 'id,schema,name,aliases,countries\n' +
  'Q1,Person,"DOE, JOHN","Johnny Doe;J. Doe",au\n' +
  'Q2,Organization,BAD CORP LLC,,au\n' +
  'Q3,Person,عبد الله محمد,"Abdullah Mohammed",ae\n';
const os = parseOpenSanctionsCsv(osBody);
check('parseOpenSanctionsCsv pulls names + splits ;-separated aliases (quoted commas intact)',
  os.includes('DOE, JOHN') && os.includes('Johnny Doe') && os.includes('J. Doe') &&
  os.includes('BAD CORP LLC') && os.includes('عبد الله محمد') && os.includes('Abdullah Mohammed'));
check('the eu parser reads a simple.csv to ZERO names (why the dedicated parser exists)',
  parseEuCsv(osBody).length === 0);
check('parseList dispatches parser "opensanctions" ahead of the id fallthrough rules',
  parseList({ id: 'au-dfat-opensanctions', parser: 'opensanctions' }, osBody).includes('BAD CORP LLC'));

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
  nameVariants('mohammed bin abdul al ahmed yousef hussein sheikh ismail').size <= 33
  && nameVariants('mohammed bin abdul al ahmed yousef hussein sheikh ismail').has('mohammed bin abdul al ahmed yousef hussein sheikh ismail'));
check('nameVariants of an empty fold is empty', nameVariants('').size === 0);
/* Shared-data groups (data/translit-groups.json): spellings the old in-code
   table lacked must now swap — khaled/khalid, sergei/sergey and the Ukrainian/
   Russian forms were silent-clear classes before the shared file. */
check('nameVariants swaps khaled/khalid (new shared-data group)',
  nameVariants('khaled mansour').has('khalid mansour'));
check('nameVariants swaps sergei/sergey (Cyrillic romanization group)',
  nameVariants('sergei ivanov').has('sergey ivanov'));
check('nameVariants swaps volodymyr/vladimir (cross-language forms)',
  nameVariants('volodymyr melnyk').has('vladimir melnyk'));
check('salah stays ungrouped — a DIFFERENT name from saleh, never swapped',
  ![...nameVariants('salah mansour')].some(v => v.includes('saleh')));
check('translitCanonToken folds group members to one representative',
  translitCanonToken('khalid') === translitCanonToken('khaled')
  && translitCanonToken('umar') === translitCanonToken('omar')
  && translitCanonToken('zzz-ungrouped') === 'zzz-ungrouped');
const vIdx = buildIndex([{ id: 'ofac', name: 'OFAC SDN', names: ['MUHAMMAD HUSSEIN'] }]);
const vHit = screenName('Mohammed Husein Trading LLC', vIdx, 85);
check('variant spelling reaches the candidate index and flags at its honest weak tier (was a silent clear, then an inflated 88)',
  vHit.hitCount === 1 && vHit.recommendation === 'review' && vHit.band === 'medium'
  && vHit.topScore < 85 && vHit.lists[0].list === 'OFAC SDN');
check('a variant equal to a designated name is an exact 100 hit',
  screenName('Usama Ibn Laden', buildIndex([{ id: 'o', name: 'OFAC SDN', names: ['USAMA BIN LADEN'] }]), 85).topScore === 100);
/* Decisive scoring is min(full, core) — screen.py match_score parity. The old
   min(max(lev,core,token), core) collapsed to core alone, so ANY two corporates
   sharing one distinctive token scored 100/critical (Pearl Commodities DMCC vs
   PEARL INVESTMENTS LIMITED — the single-shared-distinctive-token FP class,
   now pinned as hard negatives n086-n090). */
check('similarity no longer collapses to the shared-core score (FP-1: distinct corporates stay below threshold)',
  similarity(normalizeName('Pearl Commodities DMCC'), normalizeName('PEARL INVESTMENTS LIMITED')) < 85
  && similarity(normalizeName('Muhamad Hussein Trading LLC'), normalizeName('MUHAMMAD HUSSEIN')) < 85);
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
/* Subset-only hits are real recall (they still hit, still count as material
   matches downstream) but band review/medium at their conservative score —
   a two-token name inside a longer chain is a lead for disambiguation, not a
   designation match, and used to flood the queue as high-band alerts. */
const irgcIdx = buildIndex([{ id: 'o', name: 'OFAC SDN', names: ['ISLAMIC REVOLUTIONARY GUARD CORPS QUDS FORCE'] }]);
const quds = screenName('Quds Force', irgcIdx, 85);
check('subset gate flags the short spelling of a long designated chain (was a silent clear) at review/medium',
  quds.hitCount === 1 && quds.recommendation === 'review' && quds.band === 'medium'
  && quds.lists[0].mechanism === 'subset');
const qudsSup = screenName('Islamic Revolutionary Guard Corps Quds Force',
  buildIndex([{ id: 'o', name: 'OFAC SDN', names: ['QUDS FORCE'] }]), 85);
check('subset gate flags the superset direction too (KYC name on either side)',
  qudsSup.hitCount === 1 && qudsSup.recommendation === 'review' && qudsSup.band === 'medium');
const usama = screenName('Usama Bin Ladin', buildIndex([{ id: 'o', name: 'OFAC SDN', names: ['USAMA BIN MUHAMMAD BIN AWAD BIN LADIN'] }]), 85);
check('subset gate flags the patronymic-chain case at its conservative score',
  usama.hitCount === 1 && usama.topScore < 85 && usama.recommendation === 'review');
check('a single shared token can never subset-flag (Sberbank stays clear)',
  screenName('Sberbank', buildIndex([{ id: 'o', name: 'OFAC SDN', names: ['SBERBANK OF RUSSIA'] }]), 85).hitCount === 0);

/* Short-entry + near-exact-core gates (screen.py parity): the recall the
   min(full, core) control cannot see — a customer named after a designation
   plus boilerplate. These are STRONG identity evidence (core near-identical),
   so they keep full sanctions-match severity at the honest conservative score;
   the JS engine used to reach these shapes only through the collapse defect,
   at a dishonest 100/critical. */
const hamas = screenName('Hamas General Trading LLC',
  buildIndex([{ id: 'o', name: 'OFAC SDN', names: ['HAMAS'] }]), 85);
check('short-entry gate: designation+boilerplate flags sanctions-match/high at the conservative score',
  hamas.hitCount === 1 && hamas.recommendation === 'sanctions-match' && hamas.band === 'high'
  && hamas.topScore < 85 && hamas.lists[0].mechanism === 'short-entry' && hamas.lists[0].confidence === 'STRONG');
check('short-entry gate still refuses a fuzzy-adjacent short entry (Hummus stays clear)',
  screenName('Hummus Trading LLC', buildIndex([{ id: 'o', name: 'OFAC SDN', names: ['HAMAS'] }]), 85).hitCount === 0);
const alq = screenName('Al Qaeda General Trading',
  buildIndex([{ id: 'o', name: 'OFAC SDN', names: ['AL QAEDA'] }]), 85);
check('near-exact-core gate: single-token-core designation flags sanctions-match/high at the conservative score',
  alq.hitCount === 1 && alq.recommendation === 'sanctions-match' && alq.band === 'high'
  && alq.topScore < 85 && alq.lists[0].mechanism === 'near-exact-core' && alq.lists[0].confidence === 'STRONG');
/* End-to-end FP-1 pin: the fixture class the collapse scored 100/critical. */
check('single-shared-distinctive-token corporates screen CLEAR end-to-end',
  screenName('Pearl Commodities DMCC',
    buildIndex([{ id: 'o', name: 'OFAC SDN', names: ['PEARL INVESTMENTS LIMITED'] }]), 85).hitCount === 0);
check('every hit carries its mechanism and confidence (MLRO-facing evidence labels)',
  hamas.lists[0].mechanism === 'short-entry' && quds.lists[0].confidence === 'WEAK'
  && screenName('Usama Ibn Laden', buildIndex([{ id: 'o', name: 'OFAC SDN', names: ['USAMA BIN LADEN'] }]), 85)
       .lists[0].mechanism === 'exact');

/* ── fuzzy candidate blocking (regression: a subject whose EVERY significant
   token carries an out-of-transliteration-group typo shared no exact token
   with its designated entry — no candidates, silent clear at topScore 0, even
   though the pair scores ≥85 once actually compared) ── */
check('trigramsOf pads the token edges and is unique + deterministic',
  trigramsOf('putin').join('|') === '^pu|put|uti|tin|in$' && trigramsOf('aaaa').join('|') === '^aa|aaa|aa$');
const fbIdx = buildIndex([{ id: 'o', name: 'OFAC SDN', names: ['VLADIMIR PUTIN', 'MUHAMMAD HUSSEIN', 'ABDULLAH KADYROV'] }]);
check('fuzzyTokenMatches admits single-edit tokens via the prefix+length key (putyn → putin)',
  fuzzyTokenMatches('putyn', fbIdx).join() === 'putin' && fuzzyTokenMatches('vladimyr', fbIdx).join() === 'vladimir');
check('fuzzyTokenMatches admits a first-letter typo via the trigram path (wladimir → vladimir)',
  fuzzyTokenMatches('wladimir', fbIdx).join() === 'vladimir');
check('fuzzyTokenMatches returns nothing for unrelated or exact tokens',
  fuzzyTokenMatches('zzz', fbIdx).length === 0 && fuzzyTokenMatches('putin', fbIdx).length === 0);
const vp = screenName('Vladimyr Putyn', fbIdx, 85);
check('1-char-typo-in-every-token subject now flags (was a silent clear at 0)',
  vp.hitCount === 1 && vp.topScore >= 85 && vp.recommendation === 'sanctions-match');
const ak = screenName('Abdulah Kadirov', fbIdx, 85);
check('a second every-token-typo subject flags through the same path',
  ak.hitCount === 1 && ak.topScore >= 85);
/* FLIPPED PIN (was: "a multi-edit pair below the threshold stays clear").
   "Muhamet Huseinn" ≈ 69 was the model card's documented residual — every
   significant token ≥2 edits off, cleared BY DESIGN. The phonetic fold closes
   exactly this class: it must now flag as a WEAK phonetic-only possible match
   at its real conservative score (below 85 — never a confirmed-looking hit),
   and the fuzzy scorers themselves are untouched (kill-switch check below). */
const mh = screenName('Muhamet Huseinn', fbIdx, 85);
check('the pinned multi-edit residual now flags as a phonetic-only WEAK hit (review/medium — never confirmed-looking)',
  mh.hitCount === 1 && mh.recommendation === 'review' && mh.band === 'medium'
  && mh.lists[0].phonetic === true && mh.lists[0].score < 85
  && mh.lists[0].confidence === 'WEAK (phonetic-only)');
check('MATCH_PHONETIC=0 restores the historical clear (fuzzy gates unchanged)',
  screenName('Muhamet Huseinn', fbIdx, 85, '0').hitCount === 0);
const mhShadow = screenName('Muhamet Huseinn', fbIdx, 85, 'shadow');
check('shadow mode emits no hit but records the would-be phonetic match',
  mhShadow.hitCount === 0 && mhShadow.recommendation === 'clear'
  && mhShadow.phoneticShadow.length === 1 && mhShadow.phoneticShadow[0].shape === 'equal');

/* ── Phonetic fold unit vectors (screen.py parity — same spec, same outputs) ── */
check('phoneticKey folds romanization drift to one key (muhamet/muhammad, huseinn/hussein)',
  phoneticKey('muhamet') === phoneticKey('muhammad')
  && phoneticKey('huseinn') === phoneticKey('hussein')
  && phoneticKey('putyn') === phoneticKey('putin')
  && phoneticKey('gadafi') === phoneticKey('qadhafi')
  && phoneticKey('kayoom') === phoneticKey('qayyum'));
check('phoneticKey keeps the Arabic-real vowel distinctions (hassan≠hussein, salim≠selim… via first vowel)',
  phoneticKey('hassan') !== phoneticKey('hussein')
  && phoneticKey('salim') !== phoneticKey('selim'));
check('phoneticKey preserves a trailing vowel (gender/nisba suffixes stay distinct)',
  phoneticKey('hana') !== phoneticKey('hani')
  && phoneticKey('qassem') !== phoneticKey('qasemi'));
check('phonTokens merges abu/abd particles and folds to canonical spellings',
  phonTokens('abou bakr trading llc').join('|') === 'aboubakr'
  && phonTokens('khaled mansour').join('|') === phonTokens('khalid mansour').join('|'));
check('phoneticProfile needs two significant tokens (single tokens never phonetic-match)',
  phoneticProfile('hamas') === null && phoneticProfile('muhamet huseinn') !== null);
check('phoneticPairMatch equal shape needs every key AND a bounded per-token length delta',
  phoneticPairMatch(phoneticProfile('muhamet huseinn'), phoneticProfile('muhammad hussein')) === 'equal'
  && phoneticPairMatch(phoneticProfile('ali hassan'), phoneticProfile('ali hussein')) === null);
check('phoneticPairMatch subset shape: shorter (≥2 tokens ≥4 chars) inside a strictly longer chain',
  phoneticPairMatch(phoneticProfile('khalifa al subaey'),
    phoneticProfile('khalifa muhammad turki al subaiy')) === 'subset');
/* Additivity: with the phonetic layer on, every hit the layer-off engine finds
   is still found with an equal-or-better score — the branch is an elif that
   can only ADD. */
{
  const addIdx = buildIndex([{ id: 'o', name: 'OFAC SDN',
    names: ['VLADIMIR PUTIN', 'MUHAMMAD HUSSEIN', 'SBERBANK OF RUSSIA', 'MARMARA GOLD TRADING'] }]);
  const subjects = ['Vladimyr Putyn', 'Muhamet Huseinn', 'Sberbank', 'Marmara Gold Trading', 'Helga Andersen'];
  let additive = true;
  for (const s of subjects) {
    const off = screenName(s, addIdx, 85, '0');
    const on = screenName(s, addIdx, 85, '1');
    const onKeys = new Map(on.lists.map(h => [h.list + '|' + h.hitName, h.score]));
    for (const h of off.lists) {
      const got = onKeys.get(h.list + '|' + h.hitName);
      if (got == null || got < h.score) additive = false;
    }
  }
  check('phonetic layer is strictly additive (never removes or lowers a layer-off hit)', additive);
}
/* Turkish dotless-ı fold: "Kılıç" and "Kilic" must normalize identically —
   pre-fix they sat a phantom 2 edits apart and ı-spelled entries could clear. */
check('normalizeName folds Turkish dotless ı to i (Kılıç ≡ Kilic)',
  normalizeName('Emre Kılıç') === normalizeName('Emre Kilic'));
{
  const trIdx = buildIndex([{ id: 'o', name: 'OFAC SDN', names: ['Emre Kılıç'] }]);
  check('an ı-spelled designation is an exact hit for its plain-i spelling',
    screenName('Emre Kilic', trIdx, 85).topScore === 100);
}
check('unrelated names still clear with the blocking index present',
  screenName('Helga Andersen Bakery', fbIdx, 85).hitCount === 0
  && screenName('Helga Andersen Bakery', fbIdx, 85).recommendation === 'clear');
/* Over-cap (very common) fuzzy buckets are a LAST resort: still reachable when
   the subject has no other candidate path, so a typo'd very common name is not
   silently cleared by the common-token cap. */
const commonNames = ['MOHAMMED'];
for (let i = 0; i < 2501; i++) commonNames.push('MOHAMMED FILLER' + i);
const commonIdx = buildIndex([{ id: 'o', name: 'OFAC SDN', names: commonNames }]);
const mx = screenName('Mohammex', commonIdx, 85);
check('a typo\'d very common token still finds its entries via the last-resort fallback',
  mx.hitCount >= 1 && mx.topScore >= 85);

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
/* Cyrillic is now ROMANIZED rather than kept verbatim. The original guard here
   ("keeps Cyrillic letters") existed to stop [^a-z0-9] erasing the name to the
   empty key — a zero-token, zero-candidate silent clear. That intent is what
   matters and romanization satisfies it strictly better: the key is non-empty
   AND it now aligns with the LATIN spelling the sanctions bodies publish, so
   the subject matches the real designation instead of only a Cyrillic-spelled
   one. Asserted as the intent (non-empty, no silent clear, matches its Latin
   rendering) rather than the superseded mechanism. */
check('normalizeName romanizes Cyrillic to a non-empty Latin key (never the empty key)',
  normalizeName('Владимир Путин') === 'vladimir putin');
check('a Cyrillic subject still yields tokens and candidates (the original regression)',
  normalizeName('Владимир Путин').length > 0 && sigTokens(normalizeName('Владимир Путин')).length > 0);
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

/* ── Cyrillic romanization: a real match, not a MANUAL REVIEW referral ──
   screen.py used to strip Cyrillic to "" (a designation indexed under an empty
   key could never match) and now romanizes it. This engine kept Cyrillic as-is,
   so a Cyrillic subject could match a Cyrillic list entry but never the LATIN
   designation the sanctions bodies actually publish — it fell through to
   lostScriptLetters and came back as MANUAL REVIEW.

   NOTE on why this is asserted here and not in the parity corpus: the parity
   contract only requires that screen.py's hit is "reached" by this engine, and
   a MANUAL REVIEW routing satisfies that. So parity passes with or without
   romanization — it cannot pin this. What changed is the OUTCOME QUALITY: an
   automated 100% sanctions match instead of a human referral. That is what
   these checks hold. */
{
  const idx = buildIndex([{ id: 'p', name: 'OFAC SDN', names: ['KHAMAS', 'KALASHNIKOV KONTSERN'] }]);
  const r = screenName('\u0425\u0410\u041c\u0410\u0421', idx);
  check('a Cyrillic subject matches its LATIN designation at 100 (not MANUAL REVIEW)',
    r.topScore === 100 && r.lists[0].list === 'OFAC SDN' && r.lists[0].hitName === 'KHAMAS');
  check('and is banded as a real sanctions match',
    r.band === 'critical' && r.recommendation === 'sanctions-match');
  const c = screenName('\u041a\u0430\u043b\u0430\u0448\u043d\u0438\u043a\u043e\u0432 \u041a\u043e\u043d\u0446\u0435\u0440\u043d', idx);
  check('a Cyrillic corporate designation matches its Latin rendering',
    c.topScore === 100 && c.lists[0].hitName === 'KALASHNIKOV KONTSERN');
  // Scripts with no deterministic romanization must STILL route to manual review.
  const ar = screenName('\u0645\u062d\u0645\u062f \u0639\u0628\u062f\u0627\u0644\u0644\u0647', idx);
  check('Arabic still routes to MANUAL REVIEW (no guessed transliteration)',
    ar.lists[0].list === 'MANUAL REVIEW');
}

/* Cross-engine key agreement for the folds screen.py applies. Each of these
   was a live divergence: й/ё (introduced with the Cyrillic table and missed
   because the names checked contained neither) and the stroke letters, which
   screen.py folded to ASCII while this engine kept them as themselves. */
for (const [raw, want] of [
  ['\u0421\u0435\u0440\u0433\u0435\u0439', 'sergey'], ['\u0401\u043b\u043a\u0430', 'yelka'],
  ['\u0141ukasz Nowak', 'lukasz nowak'], ['\u0110or\u0111evi\u0107', 'dordevic'],
  ['\u00d8st', 'ost'], ['\u00de\u00f3r', 'thor'], ['\u00c6thelred', 'aethelred'],
]) {
  check(`normalizeName folds ${raw} to ${want} (cross-engine key agreement)`,
    normalizeName(raw) === want);
}


/* ── probe-evidence wave (2026-08-05): multi-sheet XLSX, header-row scan,
      Mexico SAT CSV, Qatar JSON keys ── */
const IL_SHARED = '<sst>' +
  ['\u05db\u05d5\u05ea\u05e8\u05d5\u05ea', 'Header', 'internal seq. id',
   'Name of Individual - English', 'Name of Individual - Hebrew',
   'AIMAN AL-ZAWAHIRI', '\u05d0\u05d9\u05de\u05df', '-']
    .map(s => '<si><t>' + s + '</t></si>').join('') + '</sst>';
const IL_SHEET = '<worksheet><sheetData>' +
  '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>0</v></c></row>' +
  '<row r="2"><c r="A2" t="s"><v>2</v></c><c r="B2" t="s"><v>3</v></c><c r="C2" t="s"><v>4</v></c></row>' +
  '<row r="3"><c r="A3"><v>1</v></c><c r="B3" t="s"><v>5</v></c><c r="C3" t="s"><v>6</v></c></row>' +
  '<row r="4"><c r="A4"><v>2</v></c><c r="B4" t="s"><v>7</v></c><c r="C4" t="s"><v>7</v></c></row>' +
  '</sheetData></worksheet>';
const SA_SHEET2 = '<worksheet><sheetData>' +
  '<row r="1"><c r="A1" t="s"><v>2</v></c><c r="B1" t="s"><v>3</v></c></row>' +
  '<row r="2"><c r="A2"><v>9</v></c><c r="B2" t="s"><v>5</v></c></row>' +
  '</sheetData></worksheet>';
const ilXlsx = makeZip([
  { name: 'xl/sharedStrings.xml', data: IL_SHARED },
  { name: 'xl/worksheets/sheet1.xml', data: IL_SHEET },
  { name: 'xl/worksheets/sheet2.xml', data: SA_SHEET2 },
]);
const ilNames = parseDfatXlsx(ilXlsx);
check('XLSX header-row SCAN finds row-1 English headers under a row-0 caption (Israel NBCTF shape)',
  ilNames.includes('AIMAN AL-ZAWAHIRI') && ilNames.includes('\u05d0\u05d9\u05de\u05df'));
check('XLSX reader walks EVERY worksheet, not just sheet1 (Saudi PCCT shape)',
  ilNames.filter(n => n === 'AIMAN AL-ZAWAHIRI').length === 2);
check('XLSX reader drops "-" placeholder cells',
  !ilNames.includes('-'));
const SAT = '"Informacion actualizada",,,\n' +
  'Listado completo de contribuyentes,,,\n' +
  'No,RFC,Nombre del Contribuyente,Situacion del contribuyente\n' +
  '1,AAA1,"MILL UNO, S.A. DE C.V.",Definitivo\n' +
  '2,AAA2,"MILL DOS, S.A.",Presunto\n' +
  '3,AAA3,"CLEARED CO, S.A.",Desvirtuado\n' +
  '4,AAA4,"COURT CO, S.A.",Sentencia Favorable\n';
const satNames = parseSatCsv(SAT);
check('SAT 69-B: header found after preamble; only live statuses screen (Presunto/Definitivo)',
  satNames.length === 2 && satNames.includes('MILL UNO, S.A. DE C.V.') && satNames.includes('MILL DOS, S.A.')
  && !satNames.some(n => /CLEARED|COURT/.test(n)));
check('SAT 69-B: no header row parses 0 names (degrades, never guesses)',
  parseSatCsv('a,b\n1,2\n').length === 0);
check('Qatar NCTC JSON keys (fullNameEn/fullNameAr) screen both scripts',
  JSON.stringify(parseJsonList('{"content":[{"fullNameEn":"Adil Uthman","fullNameAr":"\u0639\u0627\u062f\u0644"}],"totalElements":864}'))
  === JSON.stringify(['Adil Uthman', '\u0639\u0627\u062f\u0644']));


/* African-Latin hook letters — screen.py folds Ɖ→D / Ɔ→O; JS did not, so a
   short designation spelled with Ɔ/Ɖ keyed apart from its ASCII customer
   spelling and cleared (hardening audit 2026-08-05, recall-loss). */
check('normalizeName folds Ɔ to o (Ɔla == Ola)', normalizeName('Ɔla') === normalizeName('Ola'));
check('normalizeName folds Ɖ to d (Ɖamir == Damir)', normalizeName('Ɖamir') === normalizeName('Damir'));

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
