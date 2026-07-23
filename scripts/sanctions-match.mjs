/* Sanctions matcher — the screening engine that USED to live in the external
   Hawkeye Sterling service is now done here, in-repo, with zero dependencies.

   It takes the consolidated designation lists this repo already fetches daily
   (OFAC SDN + non-SDN, UN, EU, UK OFSI, plus any extra free list or a curated
   local list such as the UAE EOCN Local Terrorist List) and matches the active
   Asana customer base against them. No external engine, no API key.

   This module is PURE (no network) so test/sanctions-match.test.mjs runs fully
   offline: list parsers (CSV/XML/curated) → a name index → fuzzy name matching.
   The network fetch lives in sanctions-screen.mjs.

   Output is the SAME per-subject shape the old engine returned —
     { name, topScore (0-100), band, recommendation, hitCount, lists[] }
   so the existing normalise/diff/alert pipeline consumes it unchanged. */

import { inflateRawSync } from 'node:zlib';

/* Fold a name to a stable comparison key: strip combining marks (Latin
   diacritics AND Arabic harakat), lower-case, collapse everything that is not
   a letter or digit IN ANY SCRIPT. Keeping \p{L} (not just a-z) matters: an
   Arabic- or Cyrillic-script subject must keep its letters, or it folds to the
   empty key and silently screens clear. The single source of truth —
   sanctions-screen.mjs re-exports this. */
export function normalizeName(s) {
  return String(s == null ? '' : s)
    .normalize('NFKD').replace(/\p{M}+/gu, '')
    .toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

/* Corporate suffixes / very common words that carry no identifying signal — kept
   out of token-set comparison and candidate generation so a shared "trading" or
   "llc" never manufactures a match. Personal-name particles (al, bin, ibn…) are
   deliberately NOT here: they help match individuals. */
const CORP_STOP = new Set([
  'llc', 'ltd', 'limited', 'inc', 'incorporated', 'co', 'company', 'corp',
  'corporation', 'group', 'holding', 'holdings', 'trading', 'general', 'gen',
  'international', 'intl', 'est', 'establishment', 'enterprise', 'enterprises',
  'industries', 'industrial', 'services', 'service', 'global', 'national',
  'fz', 'fze', 'fzc', 'fzco', 'fzllc', 'dmcc', 'jlt', 'llp', 'plc', 'sa', 'sal',
  'ag', 'gmbh', 'bv', 'nv', 'pte', 'pvt', 'srl', 'spa', 'sarl', 'ojsc', 'pjsc',
  'jsc', 'ooo', 'oao', 'zao', 'the', 'and', 'of', 'for', 'a', 's'
]);

/* Significant tokens of a normalized name (drop corp/common words, very short
   tokens and pure digits). Used both for candidate lookup and token scoring. */
export function sigTokens(norm) {
  const out = [];
  for (const t of String(norm).split(' ')) {
    if (t.length < 3) continue;
    if (/^\d+$/.test(t)) continue;
    if (CORP_STOP.has(t)) continue;
    out.push(t);
  }
  return out;
}

/* ── Delimited / structured list parsers ──────────────────────────────────── */

/* RFC4180-ish parser: quotes, escaped "" quotes, custom delimiter (',' or ';'),
   CRLF/LF. Returns an array of rows (each an array of string fields). */
export function parseDelimited(text, delim = ',') {
  const s = String(text == null ? '' : text);
  const rows = [];
  let row = [], field = '', inQ = false, started = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    started = true;
    if (inQ) {
      if (c === '"') {
        if (s[i + 1] === '"') { field += '"'; i++; } else { inQ = false; }
      } else field += c;
      continue;
    }
    if (c === '"') { inQ = true; continue; }
    if (c === delim) { row.push(field); field = ''; continue; }
    if (c === '\r') continue;
    if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; continue; }
    field += c;
  }
  if (started && (field.length || row.length)) { row.push(field); rows.push(row); }
  return rows;
}

/* OFAC SDN (sdn.csv) and OFAC Consolidated (cons_prim.csv): no header row, the
   designated name is the second column; "-0-" marks an empty field. */
export function parseOfacCsv(body) {
  const names = [];
  for (const r of parseDelimited(body, ',')) {
    const name = (r[1] || '').trim();
    if (name && name !== '-0-') names.push(name);
  }
  return names;
}

/* OFAC SDN.XML / CONSOLIDATED.XML: <sdnEntry> blocks. Individuals carry
   <firstName> + <lastName>; entities/vessels carry the full name in <lastName>.
   Every <aka> in <akaList> is an alias (its own firstName/lastName). OFAC does
   NOT publish a single consolidated CSV (only the multi-part CONS_PRIM.CSV …),
   so the consolidated (non-SDN) list is ingested from CONSOLIDATED.XML. */
export function parseOfacXml(body) {
  const s = String(body), names = [];
  const re = /<sdnEntry\b[^>]*>([\s\S]*?)<\/sdnEntry>/gi;
  let m;
  while ((m = re.exec(s))) {
    const block = m[1];
    // Primary name from the entry-level tags only (strip akaList first so the
    // alias first/last names aren't mistaken for the primary).
    const primaryBlock = block.replace(/<akaList>[\s\S]*?<\/akaList>/i, '');
    const primary = [firstTag(primaryBlock, 'firstName'), firstTag(primaryBlock, 'lastName')]
      .filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
    if (primary) names.push(primary);
    const akaList = /<akaList>([\s\S]*?)<\/akaList>/i.exec(block);
    if (akaList) {
      for (const aka of (akaList[1].match(/<aka\b[^>]*>([\s\S]*?)<\/aka>/gi) || [])) {
        const an = [firstTag(aka, 'firstName'), firstTag(aka, 'lastName')]
          .filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
        if (an) names.push(an);
      }
    }
  }
  return [...new Set(names.filter(Boolean))];
}

const XML_ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
function decodeXml(x) {
  const cp = n => { try { return String.fromCodePoint(n); } catch { return ''; } };
  return String(x).replace(/&(amp|lt|gt|quot|apos);/g, (_, n) => XML_ENT[n])
    .replace(/&#(\d+);/g, (_, d) => cp(+d))                       // fromCodePoint: handles astral planes (>U+FFFF), not just the BMP
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => cp(parseInt(h, 16)));
}
function firstTag(block, name) {
  const m = new RegExp('<' + name + '>([\\s\\S]*?)<\\/' + name + '>').exec(block);
  return m ? decodeXml(m[1]).replace(/\s+/g, ' ').trim() : '';
}
function allTags(block, name) {
  const out = [], re = new RegExp('<' + name + '>([\\s\\S]*?)<\\/' + name + '>', 'g');
  let m;
  while ((m = re.exec(block))) { const v = decodeXml(m[1]).replace(/\s+/g, ' ').trim(); if (v) out.push(v); }
  return out;
}

/* UN Security Council consolidated XML: <INDIVIDUAL>/<ENTITY> blocks. The primary
   name is FIRST..FOURTH_NAME joined; every ALIAS_NAME is added too (recall). */
export function parseUnXml(body) {
  const s = String(body), names = [];
  for (const re of [/<INDIVIDUAL>([\s\S]*?)<\/INDIVIDUAL>/g, /<ENTITY>([\s\S]*?)<\/ENTITY>/g]) {
    let m;
    while ((m = re.exec(s))) {
      const block = m[1];
      const primary = ['FIRST_NAME', 'SECOND_NAME', 'THIRD_NAME', 'FOURTH_NAME']
        .map(t => firstTag(block, t)).filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
      if (primary) names.push(primary);
      for (const a of allTags(block, 'ALIAS_NAME')) names.push(a);
    }
  }
  return names;
}

/* UK OFSI consolidated CSV: a banner precedes the header. Find the header row
   (has "Name 1"/"Name 6"/"Group ID"), join the "Name N" columns per row — that
   covers both primary names and AKA rows. */
export function parseOfsiCsv(body) {
  const rows = parseDelimited(body, ',');
  let h = -1;
  for (let i = 0; i < rows.length; i++) {
    const cells = rows[i].map(c => c.trim().toLowerCase());
    if (cells.includes('name 6') || cells.includes('name 1') || cells.includes('group id')) { h = i; break; }
  }
  if (h < 0) return [];
  const nameCols = [];
  rows[h].forEach((c, idx) => { const m = /^name\s*(\d+)$/i.exec(c.trim()); if (m) nameCols.push({ idx, n: +m[1] }); });
  nameCols.sort((a, b) => a.n - b.n);
  if (!nameCols.length) return [];
  const names = [];
  for (let i = h + 1; i < rows.length; i++) {
    const r = rows[i];
    const name = nameCols.map(nc => (r[nc.idx] || '').trim()).filter(v => v && v !== '0')
      .join(' ').replace(/\s+/g, ' ').trim();
    if (name) names.push(name);
  }
  return names;
}

/* EU consolidated financial sanctions CSV: semicolon-delimited, one row per
   name-alias. Prefer a *WholeName* column, else join first/middle/last. */
export function parseEuCsv(body) {
  const rows = parseDelimited(body, ';');
  if (rows.length < 2) return [];
  const header = rows[0].map(c => c.trim());
  const col = re => header.findIndex(c => re.test(c));
  const whole = col(/wholename/i), first = col(/firstname/i), middle = col(/middlename/i), last = col(/lastname/i);
  const names = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    let name = whole >= 0 ? (r[whole] || '').trim() : '';
    if (!name) name = [first, middle, last].filter(x => x >= 0).map(x => (r[x] || '').trim()).filter(Boolean).join(' ');
    name = name.replace(/\s+/g, ' ').trim();
    if (name) names.push(name);
  }
  return names;
}

/* Best-effort generic sanctions XML (Canada SEMA, Switzerland SECO and similar):
   join given/last name tags, take whole/entity name tags, and split alias tags.
   Returns [] if nothing recognisable is found (caller flags coverage degraded). */
export function parseGenericXml(body) {
  const s = String(body), names = [];
  const recordRe = /<(record|entry|sanctionEntity|sanctionentity|individual|entity|target)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let m, matched = false;
  while ((m = recordRe.exec(s))) {
    matched = true;
    const block = m[2];
    const given = firstTag(block, 'GivenName') || firstTag(block, 'givenName') || firstTag(block, 'FirstName') || firstTag(block, 'firstName');
    const last = firstTag(block, 'LastName') || firstTag(block, 'lastName') || firstTag(block, 'Surname');
    const whole = firstTag(block, 'Entity') || firstTag(block, 'entity') || firstTag(block, 'WholeName')
      || firstTag(block, 'wholeName') || firstTag(block, 'Name') || firstTag(block, 'name');
    const combined = [given, last].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
    if (combined) names.push(combined);
    if (whole && whole !== combined) names.push(whole);
    for (const t of ['Aliases', 'aliases', 'Alias', 'alias', 'AKA', 'aka']) {
      for (const a of allTags(block, t)) for (const piece of a.split(/[\/;|]/)) { const v = piece.trim(); if (v) names.push(v); }
    }
  }
  return matched ? names.filter(Boolean) : [];
}

/* Switzerland SECO "Gesamtliste" XML: <target> blocks whose <identity> carries
   one or more <name> blocks, each assembled from nested <name-part><value>
   elements (whole-name for entities; given-name + family-name for individuals).
   Every <name> block — primary name and aliases — yields one screenable name.
   The generic XML parser assumes flat <Name>text</Name> tags, so SECO needs
   this dedicated extractor. */
export function parseSecoXml(body) {
  const s = String(body), names = [];
  const nameRe = /<name\b[^>]*>([\s\S]*?)<\/name>/gi;
  let m;
  while ((m = nameRe.exec(s))) {
    /* <value> tags may carry attributes (e.g. <value lang="en">) and may wrap
       the text in CDATA — both occur in the real SECO feed. Missing either
       would silently drop a designated name (a false negative). */
    const parts = [], valRe = /<value\b[^>]*>([\s\S]*?)<\/value>/gi;
    let v;
    while ((v = valRe.exec(m[1]))) {
      const raw = v[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
      const t = decodeXml(raw).replace(/\s+/g, ' ').trim();
      if (t) parts.push(t);
    }
    const full = parts.join(' ').replace(/\s+/g, ' ').trim();
    if (full) names.push(full);
  }
  return names;
}

/* ── XLSX reader — for lists published ONLY as .xlsx ──────────────────────────
   An .xlsx file is a ZIP of XML parts. Australia's DFAT Consolidated List
   (regulation8_consolidated.xlsx) has no CSV/XML feed, so — with zero deps, the
   same node:zlib already used for the PNG icon rasteriser — we read the ZIP
   central directory, inflate the two parts we need (sharedStrings + the first
   worksheet) and walk the cells. Best-effort like SECO/Canada: if the file or
   layout ever changes the parse yields fewer (or zero) names and the screen
   degrades VISIBLY — it never fabricates a clean result. */

function bufStr(b) { return b ? (Buffer.isBuffer(b) ? b.toString('utf8') : String(b)) : ''; }

/* Spreadsheet column letters → 0-based index ("A"→0, "AB"→27). */
function colToIndex(letters) {
  let n = 0;
  for (const ch of String(letters)) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

/* Minimal ZIP reader → Map(entryName → decompressed Buffer). Reads the central
   directory (authoritative on sizes even when a local header streams with a data
   descriptor) and supports STORED (0) + DEFLATE (8); a corrupt entry is skipped,
   never silently substituted. Pure (node:zlib only), so it stays unit-testable. */
export function unzipEntries(buf) {
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf || []);
  const out = new Map();
  let eocd = -1;
  for (let i = b.length - 22; i >= 0; i--) { if (b.readUInt32LE(i) === 0x06054b50) { eocd = i; break; } }
  if (eocd < 0) return out;
  const count = b.readUInt16LE(eocd + 10);
  let p = b.readUInt32LE(eocd + 16);
  for (let n = 0; n < count && p + 46 <= b.length; n++) {
    if (b.readUInt32LE(p) !== 0x02014b50) break;
    const method = b.readUInt16LE(p + 10);
    const compSize = b.readUInt32LE(p + 20);
    const nameLen = b.readUInt16LE(p + 28);
    const extraLen = b.readUInt16LE(p + 30);
    const commentLen = b.readUInt16LE(p + 32);
    const localOff = b.readUInt32LE(p + 42);
    const name = b.toString('utf8', p + 46, p + 46 + nameLen);
    try {
      // The local-header offset comes from the archive; bound-check it before
      // reading so a truncated/garbage file degrades to fewer names, never throws.
      if (localOff + 30 <= b.length && b.readUInt32LE(localOff) === 0x04034b50) {
        const dataStart = localOff + 30 + b.readUInt16LE(localOff + 26) + b.readUInt16LE(localOff + 28);
        const comp = b.subarray(dataStart, dataStart + compSize);
        out.set(name, method === 8 ? inflateRawSync(comp) : Buffer.from(comp));
      }
    } catch { /* skip a corrupt entry; a short read degrades coverage, never an all-clear */ }
    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

/* sharedStrings.xml → string[] indexed by shared-string id. A <si> may hold
   several <t> runs (rich text) which concatenate into one string. */
export function parseSharedStrings(xml) {
  const out = [];
  const siRe = /<si\b[^>]*>([\s\S]*?)<\/si>/gi;
  let m;
  while ((m = siRe.exec(String(xml || '')))) {
    const tRe = /<t\b[^>]*>([\s\S]*?)<\/t>/gi;
    let t, s = '';
    while ((t = tRe.exec(m[1]))) s += decodeXml(t[1]);
    out.push(s.replace(/\s+/g, ' ').trim());
  }
  return out;
}

/* worksheet XML → rows (each an array of cell strings), resolving shared-string
   ('s') and inline-string ('inlineStr') cells. The column letter in each cell's
   r="A1" ref places the value at its true column so blank cells never shift the
   row. */
export function parseSheetRows(xml, shared = []) {
  const rows = [];
  const rowRe = /<row\b[^>]*>([\s\S]*?)<\/row>/gi;
  let rm;
  while ((rm = rowRe.exec(String(xml || '')))) {
    const cells = [];
    const cRe = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/gi;
    let cm;
    while ((cm = cRe.exec(rm[1]))) {
      const attrs = cm[1] || '';
      const inner = cm[2] || '';
      const refM = /r="([A-Z]+)\d+"/.exec(attrs);
      const col = refM ? colToIndex(refM[1]) : cells.length;
      const typeM = /t="([^"]+)"/.exec(attrs);
      const type = typeM ? typeM[1] : '';
      const vM = /<v\b[^>]*>([\s\S]*?)<\/v>/i.exec(inner);
      let val = '';
      if (type === 's') val = vM ? (shared[+vM[1]] || '') : '';
      else if (type === 'inlineStr') { const tM = /<t\b[^>]*>([\s\S]*?)<\/t>/i.exec(inner); val = tM ? decodeXml(tM[1]) : ''; }
      else val = vM ? decodeXml(vM[1]) : '';
      cells[col] = String(val).replace(/\s+/g, ' ').trim();
    }
    for (let i = 0; i < cells.length; i++) if (cells[i] == null) cells[i] = '';
    rows.push(cells);
  }
  return rows;
}

/* Australia DFAT Consolidated List (regulation8_consolidated.xlsx). Reads the
   first worksheet, locates the header row, and collects every value in the
   name-bearing columns (the primary "Name of Individual or Entity"/"Name" and any
   original-script name column), skipping the "Name Type" metadata column. Each
   alias is its own row in the DFAT layout, so this captures primary names and
   aliases alike. Accepts a Buffer (the .xlsx bytes). */
export function parseDfatXlsx(buf) {
  const files = unzipEntries(buf);
  if (!files.size) return [];
  const shared = parseSharedStrings(bufStr(files.get('xl/sharedStrings.xml')));
  let sheetXml = bufStr(files.get('xl/worksheets/sheet1.xml'));
  if (!sheetXml) for (const [k, v] of files) { if (/^xl\/worksheets\/.*\.xml$/i.test(k)) { sheetXml = bufStr(v); break; } }
  const rows = parseSheetRows(sheetXml, shared);
  if (!rows.length) return [];
  let h = 0;
  while (h < rows.length && !rows[h].some(c => c && c.trim())) h++;
  const header = (rows[h] || []).map(c => String(c).toLowerCase().trim());
  const nameCols = [];
  header.forEach((c, i) => { if (/name/.test(c) && !/name\s*type/.test(c)) nameCols.push(i); });
  if (!nameCols.length) header.forEach((c, i) => { if (c === 'name') nameCols.push(i); });
  if (!nameCols.length) return [];
  const names = [];
  for (let i = h + 1; i < rows.length; i++) {
    for (const ci of nameCols) { const v = (rows[i][ci] || '').trim(); if (v) names.push(v); }
  }
  return names;
}

/* Generic JSON list parser — several national registers publish JSON rather than
   CSV/XML (France DGT "gels", Ukraine NSDC register, NZ data.govt.nz datastore).
   Each has its own shape, so we walk the payload and harvest plausible designated
   names from the common name-bearing keys (and assemble first+last where a record
   splits them), plus aliases. Best-effort: returns [] if nothing recognisable, so
   the caller flags coverage degraded rather than inferring a false clear. */
const JSON_WHOLE = /^(name|fullname|full_name|wholename|whole_name|displayname|legalname|legal_name|entityname|entity_name|designation|caption|raisonsociale|raison_sociale|nomcomplet|denomination|supp_name|firm_name)$/i;
const JSON_FIRST = /^(firstname|first_name|prenom|prenoms|givenname|given_name|forename)$/i;
const JSON_LAST = /^(lastname|last_name|surname|familyname|family_name|nom)$/i;
const JSON_ALIAS = /^(alias|aliases|aka|akas|othernames|other_names|alternativenames|alternative_names|alternatename|alternative_spelling|autresnoms)$/i;
export function parseJsonList(body) {
  let data;
  try { data = typeof body === 'string' ? JSON.parse(body) : body; } catch { return []; }
  const out = [];
  const visit = (node, depth) => {
    if (node == null || depth > 8) return;
    if (Array.isArray(node)) { for (const x of node) visit(x, depth + 1); return; }
    if (typeof node !== 'object') return;
    let whole = '', first = '', last = '';
    for (const [k, v] of Object.entries(node)) {
      if (typeof v === 'string' && v.trim()) {
        if (!whole && JSON_WHOLE.test(k)) whole = v.trim();
        else if (!first && JSON_FIRST.test(k)) first = v.trim();
        else if (!last && JSON_LAST.test(k)) last = v.trim();
      }
    }
    const assembled = (whole || [first, last].filter(Boolean).join(' ')).replace(/\s+/g, ' ').trim();
    if (assembled) out.push(assembled);
    for (const [k, v] of Object.entries(node)) {
      if (JSON_ALIAS.test(k)) {
        if (typeof v === 'string') for (const piece of v.split(/[;/|]/)) { const t = piece.trim(); if (t) out.push(t); }
        else if (Array.isArray(v)) for (const a of v) {
          if (typeof a === 'string' && a.trim()) out.push(a.trim());
          else if (a && typeof a === 'object') { const n = a.name || a.alias || a.wholeName || a.value; if (typeof n === 'string' && n.trim()) out.push(n.trim()); }
        }
      } else if (v && typeof v === 'object' && !JSON_WHOLE.test(k)) {
        visit(v, depth + 1);   // recurse into nested containers (results/data/items/publications)
      }
    }
  };
  visit(data, 0);
  return [...new Set(out.filter(Boolean))];
}

/* A curated / local list (e.g. the UAE EOCN Local Terrorist List kept in-repo).
   Accepts an array of strings, an array of {name, aliases[]} objects, or
   {entries:[…]} / {names:[…]}. */
export function parseCuratedList(json) {
  // Best-effort like every sibling parser: a malformed/truncated curated file
  // (e.g. the in-repo EOCN local list) must degrade that one list's coverage,
  // never throw and abort the whole daily screen.
  let data;
  try { data = typeof json === 'string' ? JSON.parse(json) : json; } catch { return []; }
  if (!data || typeof data !== 'object') return [];
  const list = Array.isArray(data) ? data : (data.entries || data.names || []);
  const out = [];
  for (const e of list) {
    if (typeof e === 'string') { if (e.trim()) out.push(e.trim()); }
    else if (e && typeof e === 'object') {
      if (e.name) out.push(String(e.name).trim());
      for (const a of (e.aliases || [])) if (a) out.push(String(a).trim());
    }
  }
  return out.filter(Boolean);
}

/* Dispatch a source body to the right parser. `source.parser` wins; otherwise
   infer from id/type. Unknown formats fall back to generic XML then CSV col 0. */
export function parseList(source, body) {
  const id = (source.id || '').toLowerCase();
  const p = (source.parser || '').toLowerCase();
  if (p === 'ofacxml') return parseOfacXml(body);                 // OFAC SDN/CONSOLIDATED .XML (before the generic ofac→CSV rule)
  if (p === 'ofac' || /^ofac/.test(id)) return parseOfacCsv(body);
  if (p === 'un' || /^un[-_]/.test(id)) return parseUnXml(body);
  if (p === 'ofsi' || /ofsi/.test(id) || /^uk/.test(id)) return parseOfsiCsv(body);
  if (p === 'eu' || /^eu/.test(id)) return parseEuCsv(body);
  if (p === 'json') return parseJsonList(body);
  if (p === 'curated' || source.type === 'curated') return parseCuratedList(body);
  if (p === 'dfat' || p === 'xlsx' || source.type === 'xlsx' || /dfat/.test(id)) return parseDfatXlsx(body);
  if (p === 'seco' || /seco/.test(id)) return parseSecoXml(body);
  if (p === 'xml' || source.type === 'xml') return parseGenericXml(body);
  const xml = parseGenericXml(body);
  if (xml.length) return xml;
  return parseDelimited(body, ',').map(r => (r[0] || '').trim()).filter(Boolean);
}

/* ── Fuzzy name matching ──────────────────────────────────────────────────── */

/* Levenshtein edit distance (iterative, two-row). Names are short. */
export function levenshtein(a, b) {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    let cur = i, diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = prev[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur = Math.min(prev[j] + 1, cur + 1, diag + cost);
      prev[j] = cur;
      diag = tmp;
    }
  }
  return prev[n];
}

/* Similarity of two normalized names, 0-100. Max of an edit-distance ratio over
   the full strings (catches typos) and a token-set score (catches reordered /
   partial names like "Putin Vladimir" vs "Vladimir Vladimirovich Putin"). */
export function similarity(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 100;
  const dist = levenshtein(a, b);
  const lev = (1 - dist / Math.max(a.length, b.length)) * 100;
  const A = new Set(sigTokens(a)), B = new Set(sigTokens(b));
  let token = 0;
  if (A.size && B.size) {
    let inter = 0;
    for (const t of A) if (B.has(t)) inter++;
    const union = A.size + B.size - inter;
    const jac = inter / union;
    const cover = inter / Math.min(A.size, B.size);
    token = (0.4 * jac + 0.6 * cover) * 100;
  }
  return Math.max(lev, token);
}

/* Build a name index over the parsed lists for fast candidate lookup.
   lists: [{ id, name, names: [string] }] */
export function buildIndex(lists) {
  const exact = new Map();   // normName -> [{ list, hitName }]
  const token = new Map();   // sigToken -> number[] (entry indices)
  const entries = [];        // { norm, hitName, list }
  for (const L of (lists || [])) {
    for (const raw of (L.names || [])) {
      const norm = normalizeName(raw);
      if (!norm) continue;
      const idx = entries.length;
      entries.push({ norm, hitName: raw, list: L.name });
      let ex = exact.get(norm);
      if (!ex) exact.set(norm, ex = []);
      ex.push({ list: L.name, hitName: raw });
      for (const t of sigTokens(norm)) {
        let arr = token.get(t);
        if (!arr) token.set(t, arr = []);
        arr.push(idx);
      }
    }
  }
  return { exact, token, entries, size: entries.length };
}

/* Tokens shared by huge numbers of entries (very common given names) are poor
   discriminators; skip them for candidate generation unless the subject has no
   other significant token. Bounds work on common-name subjects. */
const COMMON_TOKEN_CAP = 2500;

/* Screen one subject name against the index. Returns a raw engine-shaped row
   { name, topScore, band, recommendation, hitCount, lists[] }. */
export function screenName(name, index, threshold = 85) {
  const norm = normalizeName(name);
  const empty = { name, topScore: 0, band: 'low', recommendation: 'clear', hitCount: 0, lists: [] };
  if (!norm || !index || !index.entries.length) return empty;

  const byNorm = new Map();   // matched designated norm -> { list, hitName, score }
  const addHit = (list, hitName, score, key) => {
    const prev = byNorm.get(key);
    if (!prev || score > prev.score) byNorm.set(key, { list, hitName, score: Math.round(score) });
  };

  /* exact designated-name match → 100 */
  const ex = index.exact.get(norm);
  if (ex) for (const h of ex) addHit(h.list, h.hitName, 100, h.hitName + '|' + h.list);

  /* fuzzy over candidates that share a significant token */
  const toks = sigTokens(norm);
  const rare = toks.filter(t => (index.token.get(t) || []).length <= COMMON_TOKEN_CAP);
  const useToks = rare.length ? rare : toks;
  const seen = new Set();
  let best = ex ? 100 : 0;
  for (const t of useToks) {
    for (const i of (index.token.get(t) || [])) {
      if (seen.has(i)) continue;
      seen.add(i);
      const e = index.entries[i];
      const sc = similarity(norm, e.norm);
      if (sc > best) best = sc;
      if (sc >= threshold) addHit(e.list, e.hitName, sc, e.hitName + '|' + e.list);
    }
  }

  const lists = [...byNorm.values()].sort((a, b) => b.score - a.score).slice(0, 12);
  if (!lists.length) return { name, topScore: Math.round(best), band: 'low', recommendation: 'clear', hitCount: 0, lists: [] };
  const topScore = lists[0].score;
  const band = topScore >= 98 ? 'critical' : 'high';
  return { name, topScore, band, recommendation: 'sanctions-match', hitCount: lists.length, lists };
}

/* Screen a batch of subjects → raw engine-shaped rows (one per subject), keyed
   by subject.name so the existing normaliser maps them back to jurisdiction/gid. */
export function screenSubjects(subjects, index, threshold = 85) {
  return (subjects || []).map(s => screenName(s.name, index, threshold));
}
