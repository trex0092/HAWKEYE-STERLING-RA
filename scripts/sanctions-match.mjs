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
import { readFileSync } from 'node:fs';

/* Fold a name to a stable comparison key: strip combining marks (Latin
   diacritics AND Arabic harakat), lower-case, collapse everything that is not
   a letter or digit IN ANY SCRIPT. Keeping \p{L} (not just a-z) matters: an
   Arabic- or Cyrillic-script subject must keep its letters, or it folds to the
   empty key and silently screens clear. The single source of truth —
   sanctions-screen.mjs re-exports this. */
export function normalizeName(s) {
  return String(s == null ? '' : s)
    /* BEFORE NFKD — й and ё are PRECOMPOSED (и+breve, е+diaeresis), so the
       mark-strip below turns them into и/е and the Cyrillic table then renders
       "Сергей" as "sergei" and "Ёлка" as "elka". screen.py romanizes on the
       composed form and produces "sergey"/"yelka", the spellings OFAC and the
       EU actually publish. That divergence was introduced with the Cyrillic
       fold and missed because the seven names I checked contained neither
       letter — a cross-engine key mismatch on two of the commonest Russian
       characters. Map them first, matching screen.py. */
    .replace(/[йЙ]/g, 'y').replace(/[ёЁ]/g, 'ye').replace(/[їЇ]/g, 'yi')
    .normalize('NFKD').replace(/\p{M}+/gu, '')
    .toLowerCase()
    /* Stroke letters and ligatures have no NFKD decomposition, so they survive
       here as themselves while screen.py folds them to ASCII (Ł→L, Ø→O, Đ→D…).
       The customer record usually carries the plain ASCII spelling, so without
       this fold "łukasz" never meets "lukasz". Same class as the ı and ß folds
       below, for the letters those missed. Strictly widening. */
    .replace(/ł/g, 'l').replace(/ø/g, 'o').replace(/[đð]/g, 'd')
    .replace(/þ/g, 'th').replace(/æ/g, 'ae').replace(/œ/g, 'oe')
    .replace(/ħ/g, 'h').replace(/ŧ/g, 't').replace(/ə/g, 'e').replace(/ŋ/g, 'ng')
    /* African-Latin hook letters: screen.py folds Ɖ→D and Ɔ→O, JS did not, so a
       short designation spelled with Ɔ/Ɖ (e.g. "Ɔla") keyed apart from its ASCII
       customer spelling ("Ola") and cleared — a cross-engine false negative the
       parity corpus never exercised. Lowercase forms suffice (JS folds after
       lower-casing). Strictly widening. */
    .replace(/ɖ/g, 'd').replace(/ɔ/g, 'o')
    /* Turkish dotless ı has no NFKD decomposition and is NOT folded by
       lowercasing, so "Kılıç" and "Kilic" normalized to different strings and
       an ı-spelled subject could sit a phantom 2 edits from its own name —
       measured as a silent miss on the benchmark corpus (screen.py folds it
       via its uppercase-first ASCII path; this restores parity). Fold is
       strictly widening: ı-vs-ı pairs matched before and still do. */
    .replace(/ı/g, 'i')
    /* German sharp-s: exactly the same class as the ı above, and found the same
       way — by comparing the two engines rather than by reasoning. ß has no
       NFKD decomposition and lower-casing leaves it alone, so "Weiß" and its
       universal ASCII spelling "Weiss" normalized to different strings. screen.py
       folds it (its uppercase-first path maps ß→SS, the Unicode uppercase of ß),
       so the designated "Weiß Trading" scored 100 there and 0 here — a silent
       cross-engine false negative, and lostScriptLetters returns false for ß so
       it was not even routed to MANUAL REVIEW. Longer names could survive on
       fuzzy similarity; short ones cleared outright. Strictly widening, like the
       ı fold: ß-vs-ß pairs matched before and still do. */
    .replace(/ß/g, 'ss')
    /* Cyrillic → Latin, mirroring screen.py's romanize(). Found by comparing
       the engines, like the ı and ß folds above. screen.py used to strip
       Cyrillic to "" (a designation indexed under an empty key could never
       match); it now romanizes, so a Cyrillic subject scores against a LATIN
       designation there. This engine kept Cyrillic as-is — "ХАМАС" → "хамас" —
       which matches a Cyrillic list entry but never the Latin "KHAMAS". That
       asymmetry breaks the directional parity contract the moment screen.py
       romanizes: Python hits, JS does not. Same table, same order (multi-letter
       forms first so they win over their prefixes). Strictly widening —
       Cyrillic-vs-Cyrillic pairs matched before and still do, because both
       sides romanize identically. */
    .replace(/щ/g, 'shch').replace(/ш/g, 'sh').replace(/ч/g, 'ch')
    .replace(/ц/g, 'ts').replace(/ж/g, 'zh').replace(/ю/g, 'yu').replace(/я/g, 'ya')
    .replace(/[ёє]/g, 'ye').replace(/ї/g, 'yi').replace(/[ъь]/g, '')
    .replace(/э/g, 'e').replace(/ы/g, 'y').replace(/х/g, 'kh')
    .replace(/ђ/g, 'dj').replace(/љ/g, 'lj').replace(/њ/g, 'nj')
    .replace(/ћ/g, 'c').replace(/џ/g, 'dz').replace(/ј/g, 'j')
    .replace(/а/g, 'a').replace(/б/g, 'b').replace(/в/g, 'v').replace(/[гґ]/g, 'g')
    .replace(/д/g, 'd').replace(/е/g, 'e').replace(/з/g, 'z').replace(/[иі]/g, 'i')
    .replace(/й/g, 'y').replace(/к/g, 'k').replace(/л/g, 'l').replace(/м/g, 'm')
    .replace(/н/g, 'n').replace(/о/g, 'o').replace(/п/g, 'p').replace(/р/g, 'r')
    .replace(/с/g, 's').replace(/т/g, 't').replace(/[уў]/g, 'u').replace(/ф/g, 'f')
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

/* Corporate suffixes / very common words that carry no identifying signal — kept
   out of token-set comparison and candidate generation so a shared "trading" or
   "llc" never manufactures a match. Personal-name particles (al, bin, ibn…) are
   deliberately NOT here: they help match individuals. */
/* Corporate / legal-form / sector boilerplate, loaded from the shared data file
   so BOTH engines strip exactly the same tokens (screen.py loads the same file).
   The two in-code tables this replaces had drifted to 58 tokens here and 79 in
   screen.py with only 42 in common — and the gap was not cosmetic: this engine
   kept "insaat sanayi ve ticaret sirketi" as distinctive, so two unrelated
   Turkish firms scored 89 and it raised three hard-negative false positives
   screen.py never made. Same failure mode the translit-groups file already
   exists to prevent, one table over.

   FAIL LOUD on a missing/invalid file: silently losing the list would quietly
   inflate every corporate score — a precision degrade nobody would see. */
function loadCorpStop() {
  const path = new URL('../data/corporate-stopwords.json', import.meta.url);
  const data = JSON.parse(readFileSync(path, 'utf8'));
  const toks = data && Array.isArray(data.tokens) ? data.tokens : [];
  if (!toks.length) throw new Error('corporate stopword file contains no tokens: ' + path);
  for (const t of toks) {
    if (!t || t !== String(t).toLowerCase()) throw new Error('malformed stopword token: ' + JSON.stringify(t));
  }
  return new Set(toks);
}
const CORP_STOP = loadCorpStop();

/* Significant tokens of a normalized name (drop corp/common words, very short
   tokens and pure digits). Used both for candidate lookup and token scoring.

   The ≥2 length floor is screen.py parity (core_tokens: `len(t) > 1`). It used
   to be ≥3 here, which silently dropped two-letter name tokens from the
   candidate index — so a subject whose only shared tokens were two letters long
   had NO candidate path and cleared, while screen.py hit it. Measured on a
   mixed-length transliterated name ("Yu Li Pang" vs listed "YU LI PING"): JS
   cleared, Python scored 90. Same failure shape as the Turkish-ı miss in
   normalizeName above, and the same class the phonetic layer exists to prevent:
   a silent cross-engine false negative. Restoring parity is recall-monotone —
   it only ever ADDS candidates — and moved no benchmark floor.

   NOTE this is deliberately NOT the gate for "can this name be auto-screened at
   all" — see screenableTokens below, which keeps the stricter ≥3 rule so an
   all-two-letter name still routes to MANUAL REVIEW rather than being fuzzed.

   HOT PATH: similarity()/isTokenSubset() recompute an entry's tokens for every
   (variant × candidate) pair, so results are memoized by the normalized string
   (bounded, and frozen — treat the returned array as read-only). */
const SIG_CACHE = new Map();
const SIG_CACHE_MAX = 300000;   // comfortably above the consolidated corpus; bounds adversarial callers
export function sigTokens(norm) {
  const key = String(norm);
  const hit = SIG_CACHE.get(key);
  if (hit) return hit;
  const out = [];
  for (const t of key.split(' ')) {
    if (t.length < 2) continue;
    if (/^\d+$/.test(t)) continue;
    if (CORP_STOP.has(t)) continue;
    out.push(t);
  }
  Object.freeze(out);
  if (SIG_CACHE.size < SIG_CACHE_MAX) SIG_CACHE.set(key, out);
  return out;
}

/* Tokens distinctive enough for the name to be AUTO-screenable: sigTokens minus
   the two-letter ones. A name with none of these ("Yu Li", a symbols-only
   record) has no distinctive handle for a human to trust an automated clear on,
   so screenName routes it to MANUAL REVIEW instead. Kept separate from
   sigTokens so widening candidate recall can never quietly narrow that gate. */
export function screenableTokens(norm) {
  return sigTokens(norm).filter((t) => t.length >= 3);
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

/* OFAC a.k.a. list (alt.csv): headerless CSV — ent_num, alt_num, alt_type,
   alt_name, remarks; "-0-" marks an empty field. The SDN publishes its
   weak/strong a.k.a. names in this SEPARATE file, so screening only sdn.csv's
   primary names is a false-negative gap — a party operating under an SDN alias
   would screen clear (mirrors screen.py parse_ofac_alt). The screen runner
   folds these names into the primary OFAC SDN list (source.mergeInto), so an
   alias hit reads as the SDN designation it is. */
export function parseOfacAltCsv(body) {
  const names = [];
  for (const r of parseDelimited(body, ',')) {
    const name = (r[3] || '').trim();
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

/* OpenSanctions targets.simple.csv (comma-delimited, quoted; one row per
   entity with a lowercase `name` column and a `;`-separated `aliases`
   column) — the mirror format the au-dfat-opensanctions source serves, and
   the same shape screen.py reads via parse_simple_csv. NOT the EU webgate
   CSV: that one is semicolon-delimited with WholeName columns, and reading
   a simple.csv through parseEuCsv yields exactly zero names — the DFAT
   mirror ran that way (masked by an egress block) until 2026-08-01. */
export function parseOpenSanctionsCsv(body) {
  const rows = parseDelimited(body, ',');
  if (rows.length < 2) return [];
  const header = rows[0].map(c => c.trim().toLowerCase());
  const nameIdx = header.indexOf('name'), aliasIdx = header.indexOf('aliases');
  if (nameIdx < 0) return [];
  const names = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const n = (r[nameIdx] || '').trim();
    if (n) names.push(n);
    if (aliasIdx >= 0) {
      for (const piece of String(r[aliasIdx] || '').split(';')) {
        const a = piece.trim();
        if (a) names.push(a);
      }
    }
  }
  return names;
}

/* US Trade.gov Consolidated Screening List bulk CSV (keyless download):
   comma-delimited with a header row; eleven US lists in one feed (BIS Entity
   List / Denied Persons / Unverified, State Dept nonproliferation + debarred,
   OFAC re-included). The primary name sits in a `name` column and the
   ';'-separated a.k.a. names in `alt_names` — NOT `aliases`, which is why the
   OpenSanctions simple.csv parser would silently drop every alias here. */
export function parseCslCsv(body) {
  const rows = parseDelimited(body, ',');
  if (rows.length < 2) return [];
  const header = rows[0].map(c => c.trim().toLowerCase());
  const nameIdx = header.indexOf('name');
  const altIdx = header.findIndex(c => c === 'alt_names' || c === 'alt names' || c === 'alternate_names');
  const srcIdx = header.indexOf('source');
  if (nameIdx < 0) return [];
  const names = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    /* The CSL bundles the full OFAC SDN block — already screened (with its
       alias fold) via the dedicated OFAC sources. Dropping those rows here
       keeps a hit attributed to its authoritative list, and keeps this
       source's count meaning "the eleven NON-OFAC-SDN lists". */
    if (srcIdx >= 0 && /specially designated nationals/i.test(r[srcIdx] || '')) continue;
    const n = (r[nameIdx] || '').trim();
    if (n) names.push(n);
    if (altIdx >= 0) {
      for (const piece of String(r[altIdx] || '').split(';')) {
        const a = piece.trim();
        if (a) names.push(a);
      }
    }
  }
  return names;
}

/* IDB Open Data "Dataset of Sanctioned firms and individuals" CSV (CKAN file
   endpoint, keyless; proven live 2026-08-06 probe run 31070807037). Header:
   Title,Entity,Nationality,Country,From,To,Prohibited Practice,Source,
   Tipo de sancion del BID,IDB Sanction Source,Other Name — the sanctioned
   party's name is `Title`, alternates in `Other Name`. Recall-monotone: every
   row indexes (historical debarments included, like the ADB register). */
export function parseIdbCsv(body) {
  const rows = parseDelimited(body, ',');
  if (rows.length < 2) return [];
  const header = rows[0].map(c => c.trim().toLowerCase());
  const nameIdx = header.indexOf('title');
  const altIdx = header.indexOf('other name');
  if (nameIdx < 0) return [];
  const names = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const n = (r[nameIdx] || '').trim();
    if (n) names.push(n);
    if (altIdx >= 0) {
      const a = (r[altIdx] || '').trim();
      if (a) names.push(a);
    }
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
  /* EVERY worksheet, not just sheet1: the Saudi PCCT workbook keeps
     individuals / entities / vessels on separate tabs, and reading only the
     first yielded 7 vessel names below the coverage floor (2026-08-05 probe
     evidence). Sheets without a name-bearing header contribute nothing. */
  const sheetNames = [...files.keys()].filter(k => /^xl\/worksheets\/.*\.xml$/i.test(k)).sort();
  const names = [];
  for (const sn of sheetNames) {
    const rows = parseSheetRows(bufStr(files.get(sn)), shared);
    if (!rows.length) continue;
    /* Header-row SCAN (first 8 rows), not first-non-empty: the Israel NBCTF
       sheet puts Hebrew captions on row 0 and the English header ("Name of
       Individual - English/Hebrew/Arabic") on row 1 — taking row 0 as the
       header found no name column and parsed 0 (same probe evidence). */
    let h = -1;
    for (let i = 0; i < Math.min(rows.length, 8); i++) {
      if (rows[i].some(c => /name/i.test(String(c)) && !/name\s*type/i.test(String(c)))) { h = i; break; }
    }
    if (h < 0) continue;
    const header = rows[h].map(c => String(c).toLowerCase().trim());
    const nameCols = [];
    header.forEach((c, i) => { if (/name/.test(c) && !/name\s*type/.test(c)) nameCols.push(i); });
    if (!nameCols.length) continue;
    for (let i = h + 1; i < rows.length; i++) {
      /* Skip an all-dash placeholder in any name column — the Israel NBCTF
         organisations sheet fills empty a.k.a. columns with "----" (not a bare
         "-"), which the old `!== '-'` guard let through as a bogus designated
         name (2026-08-05 probe evidence). A run of dashes is never a name. */
      for (const ci of nameCols) { const v = (rows[i][ci] || '').trim(); if (v && !/^-+$/.test(v)) names.push(v); }
    }
  }
  return names;
}

/* Mexico SAT Artículo 69-B (EFOS invoice-mill list): latin-1 comma CSV with
   two preamble rows before the header. Only LIVE statuses screen — a taxpayer
   who REBUTTED the presumption (Desvirtuado) or won in court (Sentencia
   Favorable) must never flag; Presunto/Definitivo are the operative rows.
   Tier framing lives in the registry entry: tax-integrity signal, not a
   financial-sanctions designation. */
export function parseSatCsv(body) {
  const rows = parseDelimited(body, ',');
  let h = -1, nameIdx = -1, sitIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 8); i++) {
    const cells = rows[i].map(c => c.toLowerCase());
    const n = cells.findIndex(c => /nombre del contribuyente|raz.n social/.test(c));
    if (n >= 0) { h = i; nameIdx = n; sitIdx = cells.findIndex(c => /situaci.n/.test(c)); break; }
  }
  if (h < 0) return [];
  const names = [];
  for (let i = h + 1; i < rows.length; i++) {
    const sit = sitIdx >= 0 ? String(rows[i][sitIdx] || '').toLowerCase() : '';
    if (sitIdx >= 0 && !/presunto|definitivo/.test(sit)) continue;
    const v = (rows[i][nameIdx] || '').trim();
    if (v) names.push(v);
  }
  return names;
}

/* ── ODS reader — for lists published ONLY as .ods (OpenDocument) ─────────────
   The Netherlands publishes its National Sanctions List Terrorism as an ODS
   spreadsheet. An .ods is a ZIP whose content.xml holds the sheet; the same
   minimal ZIP reader used for XLSX applies. parseOdsContent is the pure part
   (unit-testable without constructing a ZIP): rows of <table:table-cell>
   values, a header row located by name-bearing columns (Dutch or English),
   names joined across those columns. Best-effort like every sibling parser. */
export function parseOdsContent(xml) {
  const text = String(xml || '');
  const rows = [];
  const rowRe = /<table:table-row[^>]*>([\s\S]*?)<\/table:table-row>/g;
  const cellRe = /<table:table-cell([^>]*)(?:\/>|>([\s\S]*?)<\/table:table-cell>)/g;
  let rm;
  while ((rm = rowRe.exec(text)) && rows.length < 100000) {
    const cells = [];
    let cm;
    while ((cm = cellRe.exec(rm[1]))) {
      const attrs = cm[1] || '';
      const inner = cm[2] || '';
      const ps = [...inner.matchAll(/<text:p[^>]*>([\s\S]*?)<\/text:p>/g)].map(p => {
        /* Tag-strip to a FIXPOINT (a single pass would let "<scr<x>ipt>"
           reconstruct "<script>" — CodeQL js/incomplete-multi-character-
           sanitization), with the closing ">" optional so an unterminated
           "<script" fragment is dropped too. Then entities, with &amp;
           unescaped LAST — first would turn a literal "&amp;lt;" into "<"
           (double-unescape; same ordering discipline as batch-screen's cell()). */
        let t = p[1];
        for (let prev; prev !== t;) { prev = t; t = t.replace(/<[^>]*>?/g, ''); }
        return t.replace(/&lt;/g, '<').replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&').trim();
      });
      const v = ps.join(' ').replace(/\s+/g, ' ').trim();
      const rep = /table:number-columns-repeated="(\d+)"/.exec(attrs);
      const times = Math.min(rep ? +rep[1] : 1, 200);   // repeated blanks pad to sheet width; cap so a 16k-repeat can't balloon
      for (let i = 0; i < times; i++) cells.push(v);
    }
    if (cells.some(c => c)) rows.push(cells);
  }
  if (!rows.length) return [];
  let h = 0;
  while (h < rows.length && !rows[h].some(c => /na(?:a)?m|name/i.test(c))) h++;
  if (h >= rows.length) return [];
  const nameCols = [];
  rows[h].forEach((c, i) => { if (/na(?:a)?m|name/i.test(c) && !/type|kolom/i.test(c)) nameCols.push(i); });
  if (!nameCols.length) return [];
  const names = [];
  for (let i = h + 1; i < rows.length; i++) {
    const name = nameCols.map(ci => (rows[i][ci] || '').trim()).filter(Boolean)
      .join(' ').replace(/\s+/g, ' ').trim();
    if (name) names.push(name);
  }
  return names;
}

export function parseOdsList(buf) {
  const files = unzipEntries(buf);
  if (!files.size) return [];
  return parseOdsContent(bufStr(files.get('content.xml')));
}

/* Generic JSON list parser — several national registers publish JSON rather than
   CSV/XML (France DGT "gels", Ukraine NSDC register, NZ data.govt.nz datastore).
   Each has its own shape, so we walk the payload and harvest plausible designated
   names from the common name-bearing keys (and assemble first+last where a record
   splits them), plus aliases. Best-effort: returns [] if nothing recognisable, so
   the caller flags coverage degraded rather than inferring a false clear. */
const JSON_WHOLE = /^(name|fullname|full_name|wholename|whole_name|displayname|legalname|legal_name|entityname|entity_name|designation|caption|raisonsociale|raison_sociale|nomcomplet|denomination|supp_name|firm_name|nome|nomepessoa|nome_pessoa|nomecompleto|nome_completo|razaosocial|razao_social|razonsocial|razon_social|denominacion|denominacao|nombrecompleto|nombre_completo|fullnameen|fullnamear)$/i;
const JSON_FIRST = /^(firstname|first_name|prenom|prenoms|givenname|given_name|forename|nombre|nombres)$/i;
const JSON_LAST = /^(lastname|last_name|surname|familyname|family_name|nom|apellido|apellidos)$/i;
const JSON_ALIAS = /^(alias|aliases|aka|akas|othernames|other_names|alternativenames|alternative_names|alternatename|alternative_spelling|autresnoms)$/i;
export function parseJsonList(body) {
  let data;
  try { data = typeof body === 'string' ? JSON.parse(body) : body; } catch { return []; }
  const out = [];
  const visit = (node, depth) => {
    if (node == null || depth > 8) return;
    if (Array.isArray(node)) { for (const x of node) visit(x, depth + 1); return; }
    if (typeof node !== 'object') return;
    /* EVERY whole-name key on a record screens — Qatar's NCTC carries the
       designation in fullNameEn AND fullNameAr, and keeping only the first
       dropped the Arabic form the transliteration nets want (2026-08-05
       probe evidence). Multiple wholes on one record are just aliases of
       each other; the Set at the end dedupes. */
    const wholes = [];
    let first = '', last = '';
    for (const [k, v] of Object.entries(node)) {
      if (typeof v === 'string' && v.trim()) {
        if (JSON_WHOLE.test(k)) wholes.push(v.trim());
        else if (!first && JSON_FIRST.test(k)) first = v.trim();
        else if (!last && JSON_LAST.test(k)) last = v.trim();
      }
    }
    for (const w of wholes) { const t = w.replace(/\s+/g, ' ').trim(); if (t) out.push(t); }
    if (!wholes.length) {
      const assembled = [first, last].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
      if (assembled) out.push(assembled);
    }
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

/* UN-consolidated-list JSON (the shape Argentina's RePET republishes at
   /xml/personas.json and /xml/entidades.json — the same schema as the UN XML,
   in JSON). Each record carries the party name as ORDERED parts —
   FIRST_NAME / SECOND_NAME / THIRD_NAME / FOURTH_NAME / NAME — that must be
   CONCATENATED, plus designated a.k.a. names under INDIVIDUAL_ALIAS /
   ENTITY_ALIAS as {…, ALIAS_NAME}. The generic JSON walker matched only
   FIRST_NAME (JSON_FIRST) and so indexed a bare first name per individual and
   dropped every alias — a silent recall AND precision loss on a live source.
   This mirrors screen.py's parse_un name assembly exactly. Falls back to the
   generic walker when a body carries no UN-structured record, so a non-UN feed
   routed here can never parse to fewer names than the generic path would. */
export function parseUnJson(body) {
  let data;
  try { data = typeof body === 'string' ? JSON.parse(body) : body; } catch { return []; }
  const records = Array.isArray(data) ? data
    : (data && typeof data === 'object' ? (data.records || data.results || data.data || data.items || []) : []);
  const out = [];
  let structured = 0;
  for (const rec of (Array.isArray(records) ? records : [])) {
    if (!rec || typeof rec !== 'object') continue;
    let hit = false;
    const parts = [];
    for (const f of ['FIRST_NAME', 'SECOND_NAME', 'THIRD_NAME', 'FOURTH_NAME', 'NAME']) {
      const v = rec[f];
      if (typeof v === 'string' && v.trim()) parts.push(v.trim());
    }
    if (parts.length) { out.push(parts.join(' ').replace(/\s+/g, ' ').trim()); hit = true; }
    for (const ac of ['INDIVIDUAL_ALIAS', 'ENTITY_ALIAS']) {
      const arr = rec[ac];
      if (Array.isArray(arr)) for (const a of arr) {
        const an = a && typeof a === 'object' ? (a.ALIAS_NAME ?? a.alias_name ?? a.aliasName) : null;
        if (typeof an === 'string' && an.trim()) { out.push(an.trim()); hit = true; }
      }
    }
    if (hit) structured++;
  }
  /* No UN-structured record recognised → this isn't a UN-shaped feed; defer to
     the generic walker rather than return empty (degrade to the old behaviour,
     never below it). */
  if (!structured) return parseJsonList(body);
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
  if (p === 'ofacalt') return parseOfacAltCsv(body);              // OFAC alt.csv a.k.a. names (before the generic ofac→CSV rule)
  if (p === 'ofac' || /^ofac/.test(id)) return parseOfacCsv(body);
  if (p === 'un' || /^un[-_]/.test(id)) return parseUnXml(body);
  if (p === 'ofsi' || /ofsi/.test(id) || /^uk/.test(id)) return parseOfsiCsv(body);
  if (p === 'opensanctions') return parseOpenSanctionsCsv(body); // targets.simple.csv mirrors (comma CSV: name + ;-separated aliases)
  if (p === 'csl') return parseCslCsv(body);                     // Trade.gov Consolidated Screening List (comma CSV: name + ;-separated alt_names)
  if (p === 'idbcsv') return parseIdbCsv(body);                  // IDB sanctioned firms/individuals CSV (Title + Other Name columns)
  if (p === 'eu' || /^eu/.test(id)) return parseEuCsv(body);
  if (p === 'unjson') return parseUnJson(body);                 // UN-consolidated-list JSON (RePET personas/entidades: ordered name parts + ALIAS_NAME)
  if (p === 'json') return parseJsonList(body);
  if (p === 'curated' || source.type === 'curated') return parseCuratedList(body);
  if (p === 'mxsat') return parseSatCsv(body);                   // Mexico SAT 69-B (latin-1 CSV, live statuses only)
  if (p === 'dfat' || p === 'xlsx' || source.type === 'xlsx' || /dfat/.test(id)) return parseDfatXlsx(body);
  if (p === 'ods' || source.type === 'ods') return parseOdsList(body);
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
   the full strings (catches typos), the same ratio over the boilerplate-stripped
   cores (catches a typo hidden behind corp suffixes: "Muhamad Hussein Trading
   LLC" vs "MUHAMMAD HUSSEIN" — the full-string distance is dominated by the
   suffix, the core distance is not), and a token-set score (catches reordered /
   partial names like "Putin Vladimir" vs "Vladimir Vladimirovich Putin").

   That max() is then GATED BY THE CORE when both sides have one — screen.py's
   `min(full, core)` rule, which this engine did not have. The max alone is
   recall-monotone by construction and so can never reject anything: two firms
   sharing everything BUT the token that names them scored on their boilerplate
   and were flagged. "Golden Gate General Trading" vs designated "Silver Gate
   General Trading" scored 85 here and cleared in screen.py, whose min() exists
   precisely to collapse that shape.

   The gate is NOT recall-monotone — it can lower a score — so it was measured
   before being adopted rather than reasoned about: on the labelled corpus it
   moved JS hard negatives 84/85 -> 85/85 with recall unchanged at 123/125.
   Its one apparent recall cost (r085) turned out to be a missing stopword, not
   the gate: "as" (Turkish A.Ş.) was in neither engine's list, so
   "anadolu as" and "anadolu" read as different cores. Adding it to the shared
   file fixed the cause and gained screen.py a pair it had recorded as a
   residual miss. Do not re-widen this to a bare max() without re-running the
   benchmark on BOTH engines. */
export function matchScore(a, b) {
  if (!a || !b) return { score: 0, full: 0, core: 0, hasCore: false };
  if (a === b) return { score: 100, full: 100, core: 100, hasCore: true };
  const dist = levenshtein(a, b);
  const lev = (1 - dist / Math.max(a.length, b.length)) * 100;
  const ta = sigTokens(a), tb = sigTokens(b);
  const ca = ta.join(' '), cb = tb.join(' ');
  /* Both sides carry a distinctive core (boilerplate was actually stripped from
     at least one of them) → screen.py match_score parity: the decisive score is
     min(full, core) — a GENUINE min. The previous form min(max(lev,core,token),
     core) collapsed to `core` alone, and the token component was ALSO computed
     over sig tokens, so two corporates sharing one distinctive token ("Pearl
     Commodities DMCC" vs "PEARL INVESTMENTS LIMITED") scored 100/critical.
     `full` is whole-string, token-order-insensitive (max of raw Levenshtein and
     the sorted-token InDel ratio — each ≥-bounds rapidfuzz token_sort_ratio's
     components, keeping every Python hit reachable); `core` is the same over
     the stopword-stripped cores. */
  if (ca && cb && (ca !== a || cb !== b)) {
    const fullSort = indelRatio(a.split(' ').sort().join(' '), b.split(' ').sort().join(' '));
    const full = Math.max(lev, fullSort);
    const coreLev = ca === cb ? 100 : (1 - levenshtein(ca, cb) / Math.max(ca.length, cb.length)) * 100;
    const coreSort = ca === cb ? 100 : indelRatio(ta.slice().sort().join(' '), tb.slice().sort().join(' '));
    const core = Math.max(coreLev, coreSort);
    return { score: Math.min(full, core), full, core, hasCore: true };
  }
  /* No-core branch (pure person names — nothing to strip on either side, so
     the core gate stays out of the way): unchanged jaccard/coverage blend. */
  const A = new Set(ta), B = new Set(tb);
  let token = 0;
  if (A.size && B.size) {
    let inter = 0;
    for (const t of A) if (B.has(t)) inter++;
    const union = A.size + B.size - inter;
    const jac = inter / union;
    const cover = inter / Math.min(A.size, B.size);
    token = (0.4 * jac + 0.6 * cover) * 100;
  }
  const best = Math.max(lev, token);
  return { score: best, full: best, core: 0, hasCore: false };
}

export function similarity(a, b) {
  return matchScore(a, b).score;
}

/* ── Subset (patronymic / extra-middle-name) recall gate — screen.py parity ──
   The similarity() token score caps a perfect token SUBSET at 60 + 40·jaccard,
   so "QUDS FORCE" inside "ISLAMIC REVOLUTIONARY GUARD CORPS QUDS FORCE" scores
   73 and "USAMA BIN LADIN" against the full listed chain scores 84 — both
   silently cleared at the 85 threshold. screen.py flags exactly these via its
   _is_token_subset + TOKENSET_THRESHOLD gate; this ports that gate (same 88
   per-token and 93 token-set cutoffs, same InDel ratio semantics rapidfuzz
   uses, same strict shorter-inside-longer shape) so the two engines agree. */
export const TOKENSET_THRESHOLD = 93;   // token-set score an ANDed subset hit must clear (mirrors screen.py)
const SUBSET_TOKEN_SIM = 88;            // per-token similarity for "closely matches" (mirrors screen.py)
/* Near-exact bar for the short-entry and near-exact-core gates (mirrors
   screen.py SHORT_ENTRY_THRESHOLD). Both gates exist for the same recall shape
   the decisive min(full, core) cannot see: a customer named after a designation
   plus legal-form boilerplate ("Hamas General Trading LLC" vs HAMAS scores
   full 33 / core 100 → decisive 33). Until this port, the JS engine got that
   recall from the collapse-to-core scoring defect instead — at a dishonest
   100/critical; these gates keep the recall at the honest conservative score. */
export const SHORT_ENTRY_THRESHOLD = 97;

/* screen.py confidence_tier parity: the MLRO-facing strength label, from the
   distinctive-core similarity. Phonetic-only hits carry their own label. */
export function confidenceTier(core) {
  return core >= 92 ? 'STRONG' : core >= 85 ? 'MODERATE' : 'WEAK';
}

/* Normalized InDel similarity, 0-100 — rapidfuzz `ratio` semantics (a
   substitution costs 2, i.e. delete+insert), so the 88/93 cutoffs above mean
   the same thing they mean in screen.py's rapidfuzz gates. */
export function indelRatio(a, b) {
  const A = String(a == null ? '' : a), B = String(b == null ? '' : b);
  if (!A && !B) return 100;
  if (!A || !B) return 0;
  if (A === B) return 100;
  const m = A.length, n = B.length;
  let prev = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    let cur = i, diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = prev[j];
      const cost = A[i - 1] === B[j - 1] ? 0 : 2;
      cur = Math.min(prev[j] + 1, cur + 1, diag + cost);
      prev[j] = cur;
      diag = tmp;
    }
  }
  return (1 - prev[n] / (m + n)) * 100;
}

/* token_set_ratio over two normalized names: sorted-intersection vs
   intersection+each-side's-remainder (classic token-set construction) — 100
   whenever one name's tokens are a subset of the other's, tolerant of extra
   middle names / patronymic chains on either side. */
export function tokenSetRatio(a, b) {
  const ta = new Set(String(a == null ? '' : a).split(' ').filter(Boolean));
  const tb = new Set(String(b == null ? '' : b).split(' ').filter(Boolean));
  if (!ta.size || !tb.size) return 0;
  const inter = [...ta].filter(t => tb.has(t)).sort();
  const diffA = [...ta].filter(t => !tb.has(t)).sort();
  const diffB = [...tb].filter(t => !ta.has(t)).sort();
  const s0 = inter.join(' ');
  const s1 = [...inter, ...diffA].join(' ');
  const s2 = [...inter, ...diffB].join(' ');
  return Math.max(indelRatio(s0, s1), indelRatio(s0, s2), indelRatio(s1, s2));
}

/* True when EVERY distinctive token of the SHORTER of the two names closely
   matches a token in the longer one, and the longer has strictly more tokens —
   the patronymic / extra-middle-name shape. Requires ≥2 distinctive tokens so
   a single shared token ("Sberbank" vs "SBERBANK OF RUSSIA") can never
   trigger it. SYMMETRIC by ordering on token count: the KYC name may sit on
   either side (mirrors screen.py _is_token_subset, including its warning that
   fixing the argument order silently screened the superset direction clear). */
export function isTokenSubset(aNorm, bNorm) {
  let ta = sigTokens(aNorm), tb = sigTokens(bNorm);
  if (tb.length < ta.length) { const t = ta; ta = tb; tb = t; }
  if (ta.length < 2 || tb.length <= ta.length) return false;
  return ta.every(t => tb.some(u => indelRatio(t, u) >= SUBSET_TOKEN_SIM));
}

/* ── Transliteration variants (Arabic/Cyrillic/Turkish spelling equivalents) ─
   Loaded from data/translit-groups.json — the single source of truth BOTH
   engines read (ai.py loads the same file), replacing the duplicated in-code
   tables that had already drifted once. Without variants the exact-token
   candidate index is blind to a subject spelled "Mohammed …" against a list
   entry spelled "Muhammad …": no shared token, no candidates, silent clear.
   FAIL LOUD on a missing/invalid file: a silently-empty group list would be a
   quiet recall degrade — better no run than an unknowingly weaker one. */
function loadTranslitGroups() {
  const path = new URL('../data/translit-groups.json', import.meta.url);
  const data = JSON.parse(readFileSync(path, 'utf8'));
  const groups = data && Array.isArray(data.groups) ? data.groups : [];
  if (!groups.length) throw new Error('translit groups file contains no groups: ' + path);
  for (const g of groups) {
    if (!Array.isArray(g) || g.length < 2 || g.some(m => !m || m !== String(m).toLowerCase())) {
      throw new Error('malformed translit group: ' + JSON.stringify(g));
    }
  }
  return groups;
}
const TRANSLIT_GROUPS = loadTranslitGroups();

/* Canonical representative per single-word member (first single-word member of
   the group in sorted order — same rule as ai.py translit_canon_token), so the
   phonetic layer keys "khalid"/"khaled" or "omar"/"umar" to one token. Multi-
   word members ("abd al") are swap-only and never canonicalise a token. */
const TRANSLIT_CANON = new Map();
for (const g of TRANSLIT_GROUPS) {
  const singles = g.filter(m => !m.includes(' ')).sort();
  if (singles.length) for (const m of singles) TRANSLIT_CANON.set(m, singles[0]);
}
export function translitCanonToken(tok) {
  return TRANSLIT_CANON.get(tok) || tok;
}

/* ── Phonetic fold (romanization-drift recall) — screen.py parity ───────────
   A name whose EVERY significant token sits ≥2 edits off the listed spelling
   ("Muhamet Huseinn" vs "MUHAMMAD HUSSEIN" ≈ 69) scores below every gate and
   used to clear BY DESIGN (the model card pinned it as a residual). Each token
   folds to a romanization-robust consonantal key; a pair whose token key-lists
   agree exactly — or form the strict patronymic-subset shape — flags as a WEAK
   phonetic-only possible match at its real (conservative) similarity score.
   Spec notes (identical in screen.py phonetic_key): digraphs fold BEFORE
   run-collapse (else "kayoom" loses oo→u); the first vowel is kept but only up
   to the Arabic-real distinctions ({e,i} and {o,u} merge, a stays apart so
   hassan/hussein never collide); a trailing vowel is preserved so gender/nisba
   suffixes (hana/hani, qassem/qasemi) stay distinct; keys are computed on
   transliteration-CANONICAL tokens with abu/abd merged into their successor. */
/* Phonetic-fold tables — loaded from the shared data file so BOTH engines fold
   identically (screen.py loads the same file). These were duplicated in code; a
   duplicated table in this repo has drifted twice already (transliteration
   groups, then the corporate stopwords, the latter costing three hard-negative
   false positives). Verified before extraction that dropping one digraph from
   THIS copy broke no test, so the drift would have been silent.

   ORDER MATTERS: digraphs are applied in sequence as plain substring
   replacements, so longer forms must precede their own prefixes (shch before
   sch before sh; tch before ch). File order is preserved and asserted by
   test/phonetic-tables.test.mjs.

   FAIL LOUD on a missing/invalid file: a silently-empty fold table would key
   every name differently from the list it is screened against. */
function loadPhoneticTables() {
  const path = new URL('../data/phonetic-tables.json', import.meta.url);
  const d = JSON.parse(readFileSync(path, 'utf8'));
  const digraphs = Array.isArray(d.digraphs) ? d.digraphs : [];
  if (!digraphs.length) throw new Error('phonetic tables file has no digraphs: ' + path);
  for (const g of digraphs) {
    if (!Array.isArray(g) || g.length !== 2 || !g[0] || g[0] !== String(g[0]).toLowerCase()) {
      throw new Error('malformed digraph: ' + JSON.stringify(g));
    }
  }
  if (!d.vowelClass || !d.charMap || !Array.isArray(d.particles) || !d.particles.length) {
    throw new Error('phonetic tables file is missing a required table: ' + path);
  }
  return { digraphs, vowelClass: d.vowelClass, charMap: d.charMap, particles: new Set(d.particles) };
}
const PHON_TABLES = loadPhoneticTables();
const PHON_DIGRAPHS = PHON_TABLES.digraphs;
const PHON_VOWEL_CLASS = PHON_TABLES.vowelClass;
const PHON_CHAR_MAP = PHON_TABLES.charMap;
const PHON_PARTICLES = PHON_TABLES.particles;
const PHON_KEY_CACHE = new Map();
const PHON_KEY_CACHE_MAX = 300000;

export function phoneticKey(token) {
  const raw = String(token == null ? '' : token);
  if (raw.length < 3) return raw;
  const hit = PHON_KEY_CACHE.get(raw);
  if (hit !== undefined) return hit;
  let t = raw;
  for (const [pat, rep] of PHON_DIGRAPHS) t = t.split(pat).join(rep);
  t = t.replace(/(.)\1+/g, '$1');
  t = t.replace(/y/g, 'i');
  t = t.replace(/[qcgwpdz]/g, ch => PHON_CHAR_MAP[ch]);
  if (t.length > 3 && t.endsWith('e')) t = t.slice(0, -1);
  const first = t[0];
  let fv = '';
  for (let i = 1; i < t.length; i++) {
    if ('aeiou'.includes(t[i])) { fv = PHON_VOWEL_CLASS[t[i]]; break; }
  }
  let rest = '';
  for (let i = 1; i < t.length; i++) {
    const c = t[i];
    if (!'aeiou'.includes(c) && c !== 'h') rest += c;
  }
  const last = t[t.length - 1];
  const tail = t.length > 1 && 'aeiou'.includes(last) ? PHON_VOWEL_CLASS[last] : '';
  const key = (first + fv + rest + tail).replace(/(.)\1+/g, '$1');
  if (PHON_KEY_CACHE.size < PHON_KEY_CACHE_MAX) PHON_KEY_CACHE.set(raw, key);
  return key;
}

/* Significant tokens, particle-merged, folded to canonical spellings — the
   token stream the phonetic keys are computed over. */
export function phonTokens(norm) {
  const toks = sigTokens(norm);
  const merged = [];
  for (let i = 0; i < toks.length; i++) {
    if (PHON_PARTICLES.has(toks[i]) && i + 1 < toks.length) {
      merged.push(toks[i] + toks[i + 1]); i++;
    } else {
      merged.push(toks[i]);
    }
  }
  return merged.map(translitCanonToken);
}

/* Sorted [key, tokenLength] pairs, or null when the name has fewer than two
   significant tokens — a single common token must never carry a phonetic-only
   hit. Memoized by normalized string (list entries fold once per process). */
const PHON_PROFILE_CACHE = new Map();
export function phoneticProfile(norm) {
  const key = String(norm == null ? '' : norm);
  if (PHON_PROFILE_CACHE.has(key)) return PHON_PROFILE_CACHE.get(key);
  const toks = phonTokens(key);
  let prof = null;
  if (toks.length >= 2) {
    prof = toks.map(t => [phoneticKey(t), t.length])
      .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] - b[1]));
    Object.freeze(prof);
  }
  if (PHON_PROFILE_CACHE.size < PHON_KEY_CACHE_MAX) PHON_PROFILE_CACHE.set(key, prof);
  return prof;
}

/* 'equal' when both sorted key-lists agree exactly and every paired token's
   raw lengths differ by ≤3 (same key but 4+ letters apart is a different name
   wearing the same consonant skeleton); 'subset' when the SHORTER side (≥2
   tokens, each ≥4 chars) is wholly contained in the strictly longer side's
   key multiset — the patronymic shape the 88-per-token fuzzy subset gate
   misses once spellings drift. null otherwise. Strictly additive. */
export function phoneticPairMatch(aProf, bProf) {
  if (!aProf || !bProf) return null;
  if (aProf.length === bProf.length) {
    for (let i = 0; i < aProf.length; i++) {
      if (aProf[i][0] !== bProf[i][0] || Math.abs(aProf[i][1] - bProf[i][1]) > 3) return null;
    }
    return 'equal';
  }
  const [short, long] = aProf.length < bProf.length ? [aProf, bProf] : [bProf, aProf];
  if (short.length < 2) return null;
  let big = 0;
  for (const p of short) if (p[1] >= 4) big++;
  if (big < 2) return null;
  const pool = long.map(p => p[0]);
  for (const [k] of short) {
    const at = pool.indexOf(k);
    if (at < 0) return null;
    pool.splice(at, 1);
  }
  return 'subset';
}

const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/* Variant spellings of a NORMALIZED name (including itself). Whole-word/phrase
   swaps only — a bare replace would rewrite the particle inside unrelated
   tokens ("al" inside "salah") and waste the cap on corrupted spellings.
   Deterministic cap: sorted before truncating (never set-iteration order), and
   the base spelling is always retained — same semantics as ai.py. */
export function nameVariants(norm, cap = 32) {
  const base = String(norm == null ? '' : norm);
  if (!base) return new Set();
  const variants = new Set([base]);
  for (const grp of TRANSLIT_GROUPS) {
    for (const canonical of grp) {
      const rx = new RegExp('\\b' + escapeRe(canonical) + '\\b', 'g');
      if (rx.test(base)) {
        rx.lastIndex = 0;
        for (const alt of grp) {
          if (alt !== canonical) variants.add(base.replace(rx, alt));
        }
      }
    }
  }
  const out = new Set([...variants].sort().slice(0, cap));
  out.add(base);
  return out;
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
  /* ── Fuzzy-blocking keys over the UNIQUE significant tokens ────────────────
     The exact-token candidate index above is blind to a subject whose every
     token carries an out-of-transliteration-group typo ("Vladimyr Putyn" vs
     VLADIMIR PUTIN shares no exact token → no candidates → silent clear).
     Two cheap, complementary posting-list indexes close that: padded character
     TRIGRAMS (robust to a typo anywhere but the first chars) and a PREFIX +
     length key (robust to a typo the trigram share-count misses in short
     tokens). Built once per index over unique tokens — bounded memory, and the
     no-typo query path never touches them (see fuzzyTokenMatches). */
  const tokens = [...token.keys()];               // unique sig tokens, id = position (deterministic)
  const gram = new Map();                         // trigram -> tokenId[]
  const pfx = new Map();                          // first2 + '|' + length -> tokenId[]
  for (let id = 0; id < tokens.length; id++) {
    const t = tokens[id];
    for (const g of trigramsOf(t)) {
      let arr = gram.get(g);
      if (!arr) gram.set(g, arr = []);
      arr.push(id);
    }
    const k = t.slice(0, 2) + '|' + t.length;
    let arr = pfx.get(k);
    if (!arr) pfx.set(k, arr = []);
    arr.push(id);
  }
  /* ── Phonetic posting lists — keeps candidate generation recall-complete for
     the phonetic branch. The trigram/prefix blocking above verifies near-
     tokens at lev ≤ 1 / InDel ≥ 88, so a phonetic-only pair (every token ≥2
     edits off) would never even be scored: index each entry under its distinct
     phonetic keys instead. Candidates need ≥2 shared keys (or all, when the
     subject has fewer than 2 distinct keys), which covers the equal shape and
     both subset directions. */
  const phon = new Map();                         // phonetic key -> entryIdx[]
  const phonProfiles = new Array(entries.length).fill(null);
  for (let i = 0; i < entries.length; i++) {
    const prof = phoneticProfile(entries[i].norm);
    if (!prof) continue;
    phonProfiles[i] = prof;
    for (const k of new Set(prof.map(p => p[0]))) {
      let arr = phon.get(k);
      if (!arr) phon.set(k, arr = []);
      arr.push(i);
    }
  }
  return { exact, token, entries, tokens, gram, pfx, phon, phonProfiles, size: entries.length };
}

/* Unique padded character trigrams of a token ('^' and '$' mark the edges so
   boundary typos still share most grams). Deterministic order. */
export function trigramsOf(token) {
  const s = '^' + String(token == null ? '' : token) + '$';
  const out = new Set();
  for (let i = 0; i + 3 <= s.length; i++) out.add(s.slice(i, i + 3));
  return [...out];
}

/* Fuzzy-blocking lookup: index tokens plausibly one typo away from `token`.
   Candidate token ids come from (a) sharing at least half of the token's
   trigrams and (b) the prefix+length keys at length−1/len/len+1; each is then
   VERIFIED with an edit-distance gate before being returned. The gate is
   `levenshtein ≤ 1 OR indelRatio ≥ 88`: the indelRatio-only rule the subset
   gate uses would reject the very class this exists for (one SUBSTITUTION
   costs 2 under InDel, so putyn/putin scores 80 and vladimyr/vladimir 87.5 —
   both under 88); the lev≤1 arm admits exactly the single-edit tokens, the
   indel arm keeps longer near-matches. Deterministic (sorted); returns [] on
   an index without blocking keys (defensive). */
export function fuzzyTokenMatches(token, index) {
  const t = String(token == null ? '' : token);
  if (t.length < 3 || !index || !index.gram || !index.pfx || !index.tokens) return [];
  const grams = trigramsOf(t);
  const tally = new Map();                        // tokenId -> shared trigram count
  for (const g of grams) {
    for (const id of (index.gram.get(g) || [])) tally.set(id, (tally.get(id) || 0) + 1);
  }
  const need = Math.ceil(grams.length / 2);
  const candIds = new Set();
  for (const [id, n] of tally) if (n >= need) candIds.add(id);
  const p = t.slice(0, 2);
  for (const L of [t.length - 1, t.length, t.length + 1]) {
    for (const id of (index.pfx.get(p + '|' + L) || [])) candIds.add(id);
  }
  const out = [];
  for (const id of candIds) {
    const u = index.tokens[id];
    if (u === t) continue;                        // exact tokens go through the main bucket path
    if (levenshtein(t, u) <= 1 || indelRatio(t, u) >= 88) out.push(u);
  }
  return out.sort();
}

/* Tokens shared by huge numbers of entries (very common given names) are poor
   discriminators; skip them for candidate generation unless the subject has no
   other significant token. Bounds work on common-name subjects. */
const COMMON_TOKEN_CAP = 2500;

/* Pseudo-list name for a subject the matcher cannot auto-screen (mirrors
   screen.py's MANUAL REVIEW routing) — consumed by the screen runner, which
   must surface it as a reviewable finding, never a clear. */
export const MANUAL_REVIEW_LIST = 'MANUAL REVIEW';

/* True when a name cannot be auto-screened against Latin-indexed lists. Mirrors
   screen.py's _lost_script_letters exactly — keep the two in step, the parity
   test compares them.

   Two tests, because there are two distinct ways a name resists screening:

     (a) normalizeName()'s OUTPUT still carries non-A-Z letters — the script was
         preserved (Arabic, CJK), so there is no Latin key to compare at all.
     (b) the INPUT carried non-Latin-script letters (Cyrillic, Greek). Those ARE
         romanised into a Latin key, but romanisation is one convention among
         several, so a designation spelled another way can still be missed.

   Diacritic Latin (Müller), Turkish dotless ı, and stroke Latin (Łukasz,
   Đorđević, Þór) all reduce deterministically to A-Z and are NOT flagged. The
   older input-side test flagged the stroke letters, which was right only while
   the normaliser DELETED them; once they were given a real fold it raised a
   manual-review card for every Polish/Scandinavian/Balkan/Vietnamese name the
   fold had just made screenable. */
export function lostScriptLetters(name) {
  /* normalizeName() emits lower case; the A-Z test is on the letter, not its case. */
  for (const c of normalizeName(name).toUpperCase()) {
    if (/\p{M}/u.test(c)) continue;
    if (/\p{L}/u.test(c) && (c < 'A' || c > 'Z')) return true;
  }
  /* Latin-script letters fold deterministically; anything else was romanised. */
  return [...String(name == null ? '' : name)]
    .some(c => /\p{L}/u.test(c) && !/\p{Script=Latin}/u.test(c));
}

/* Screen one subject name against the index. Returns a raw engine-shaped row
   { name, topScore, band, recommendation, hitCount, lists[] }; recommendation
   is 'sanctions-match' (hits), 'review' (not auto-screenable) or 'clear'. */
export function screenName(name, index, threshold = 85, phonetic = '1') {
  const rawName = String(name == null ? '' : name).trim();
  const norm = normalizeName(name);
  const empty = { name, topScore: 0, band: 'low', recommendation: 'clear', hitCount: 0, lists: [] };
  if (!rawName || !index || !index.entries.length) return empty;

  const byNorm = new Map();   // matched designated norm -> { list, hitName, score, mechanism, confidence }
  const addHit = (list, hitName, score, key, meta = {}) => {
    const prev = byNorm.get(key);
    if (!prev || score > prev.score) {
      const h = { list, hitName, score: Math.round(score),
        mechanism: meta.mechanism || 'fuzzy',
        confidence: meta.confidence || 'WEAK' };
      if (meta.phoneticShape) { h.phonetic = true; h.phoneticShape = meta.phoneticShape; }
      byNorm.set(key, h);
    }
  };
  const phonMode = phonetic === '0' || phonetic === 'shadow' ? phonetic : '1';
  const phoneticShadow = [];   // shadow-mode would-be hits (never real hits)

  /* Transliteration-aware recall (screen.py parity): also screen the subject's
     spelling variants (Mohammed/Muhammad, bin/ibn …). Usually just the base;
     a handful only when a name carries a known particle, so cost stays bounded. */
  const variants = nameVariants(norm);

  /* exact designated-name match → 100 (a variant equal to a designated name IS
     that designation under an equivalent spelling) */
  let exactAny = false;
  for (const v of variants) {
    const ex = index.exact.get(v);
    if (ex) {
      exactAny = true;
      for (const h of ex) addHit(h.list, h.hitName, 100, h.hitName + '|' + h.list,
        { mechanism: 'exact', confidence: 'STRONG' });
    }
  }

  /* A name that folds to nothing, or to no significant token (all tokens
     short/stopword/numeric — e.g. "Yu Li", or a symbols-only record), has no
     candidate path: returning "clear" would be a silent sanctions false
     negative. Route it to MANUAL REVIEW instead (screen.py _unscreenable /
     _manual_review_hit parity). An exact designated-name match still wins. */
  const toks = screenableTokens(norm);
  if (!exactAny && (!norm || !toks.length)) {
    return {
      name, topScore: 0, band: 'medium', recommendation: 'review', hitCount: 1,
      lists: [{ list: MANUAL_REVIEW_LIST, score: 0,
        hitName: 'name not auto-screenable (no distinctive name tokens after normalization) — screen this subject manually against all lists' }]
    };
  }

  /* fuzzy over candidates that share a significant token with ANY variant */
  const candIdx = new Set();
  for (const v of variants) {
    const vToks = sigTokens(v);
    const rare = vToks.filter(t => (index.token.get(t) || []).length <= COMMON_TOKEN_CAP);
    for (const t of (rare.length ? rare : vToks)) {
      for (const i of (index.token.get(t) || [])) candIdx.add(i);
    }
  }
  /* Fuzzy-blocking fallback — ONLY for a BASE token with NO exact bucket at
     all (an out-of-group typo: "vladimyr", "putyn"): the no-typo hot path
     never probes, and variant-generated spellings are deliberately excluded —
     probing a swapped spelling that is simply absent from the corpus would
     re-import the very common-token buckets the rare-preference above skipped
     (measured +25% on the no-typo path) without adding recall the base
     spelling's own bucket does not already provide. Admitted near-tokens
     contribute their buckets; over-cap (very common) buckets are held back
     and used only when the subject otherwise has NO candidates at all — the
     same "rarer evidence first, common only as a last resort" rule the exact
     path applies. Candidates then score through the normal path, so this is
     recall-monotone: it can only ADD candidates, never lower a score. */
  const fuzzyCommon = new Set();
  for (const t of new Set(toks)) {
    if (index.token.has(t)) continue;
    for (const u of fuzzyTokenMatches(t, index)) {
      const bucket = index.token.get(u) || [];
      if (bucket.length <= COMMON_TOKEN_CAP) for (const i of bucket) candIdx.add(i);
      else fuzzyCommon.add(u);
    }
  }
  if (!candIdx.size) {
    for (const u of fuzzyCommon) for (const i of (index.token.get(u) || [])) candIdx.add(i);
  }
  /* Phonetic candidates: entries sharing ≥2 of a variant's distinct phonetic
     keys (or all of them for a low-key-count variant). Unioned in BEFORE
     scoring so the phonetic branch below sees every entry it could flag —
     without this the trigram blocking's lev≤1/InDel≥88 verification would
     leave the branch silently unreachable (the exact defect class the
     blocking-equivalence tests exist to catch). */
  const subjProfiles = phonMode !== '0'
    ? [...variants].map(phoneticProfile).filter(Boolean) : [];
  if (subjProfiles.length && index.phon) {
    for (const prof of subjProfiles) {
      const keys = new Set(prof.map(p => p[0]));
      const need = Math.min(2, keys.size);
      const counts = new Map();
      for (const k of keys) {
        for (const i of (index.phon.get(k) || [])) counts.set(i, (counts.get(i) || 0) + 1);
      }
      for (const [i, c] of counts) if (c >= need) candIdx.add(i);
    }
  }
  /* Deterministic variant order + (score, core, full) tie-break — screen.py
     parity: on a score tie between transliteration variants the recorded core
     (and therefore which gates fire) must not depend on iteration order. */
  const sortedVariants = [...variants].sort();
  let best = exactAny ? 100 : 0;
  for (const i of candIdx) {
    const e = index.entries[i];
    /* Best (score, core, full) across variants; subset/tset accumulate. The
       token-set ratio is probed only while below the fuzzy bar AND only when it
       could decide a gate (a subset was found, or the cores are near-exact) —
       the ANDed gates can only ADD hits (screen.py parity). */
    let sc = 0, coreBest = 0, fullBest = 0, subset = false, tset = 0;
    for (const v of sortedVariants) {
      const m = matchScore(v, e.norm);
      if (m.score > sc
          || (m.score === sc && (m.core > coreBest || (m.core === coreBest && m.full > fullBest)))) {
        sc = m.score; coreBest = m.core; fullBest = m.full;
      }
      if (sc < threshold && tset < TOKENSET_THRESHOLD) {
        if (!subset && isTokenSubset(v, e.norm)) subset = true;
        if (subset || m.core >= SHORT_ENTRY_THRESHOLD) {
          const r = tokenSetRatio(v, e.norm);
          if (r > tset) tset = r;
        }
      }
    }
    if (sc > best) best = sc;
    const key = e.hitName + '|' + e.list;
    /* Short designated names (HAMAS, IRISL, ANO …): fuzzy-matching a <6-char
       string invites false positives, so require a NEAR-EXACT match on either
       the decisive score or the distinctive core (the customer named after the
       designation + boilerplate), recorded at the conservative decisive score
       (screen.py short-entry gate parity). */
    if (e.norm.length < 6) {
      if (sc >= SHORT_ENTRY_THRESHOLD || coreBest >= SHORT_ENTRY_THRESHOLD) {
        addHit(e.list, e.hitName, sc, key,
          { mechanism: 'short-entry', confidence: confidenceTier(coreBest) });
      }
      continue;
    }
    if (sc >= threshold) {
      addHit(e.list, e.hitName, sc, key,
        { mechanism: 'fuzzy', confidence: confidenceTier(coreBest) });
    }
    /* NEAR-EXACT CORE (screen.py third-gate parity): the distinctive cores are
       near-identical and only boilerplate differs — the strongest identity
       signal short of string equality ("Al Qaeda General Trading" vs AL QAEDA),
       recorded at the conservative decisive score. */
    else if (coreBest >= SHORT_ENTRY_THRESHOLD && tset >= TOKENSET_THRESHOLD) {
      addHit(e.list, e.hitName, sc, key,
        { mechanism: 'near-exact-core', confidence: confidenceTier(coreBest) });
    }
    /* Additive recall gate: a true token SUBSET (patronymic chain / extra
       middle names) with a high token-set score flags too — recorded at the
       conservative similarity score so it reads as a POSSIBLE match for MLRO
       disambiguation, never confirmed (mirrors screen.py's ANDed gate). */
    else if (subset && tset >= TOKENSET_THRESHOLD) {
      addHit(e.list, e.hitName, sc, key,
        { mechanism: 'subset', confidence: confidenceTier(coreBest) });
    }
    /* Phonetic-only branch (screen.py parity): strictly additive — an elif
       that can never replace, lower or suppress a fuzzy or subset hit.
       Recorded at the conservative similarity score, tier WEAK. */
    else if (subjProfiles.length) {
      const eProf = index.phonProfiles ? index.phonProfiles[i] : phoneticProfile(e.norm);
      if (eProf) {
        let pm = null;
        for (const prof of subjProfiles) {
          pm = phoneticPairMatch(prof, eProf);
          if (pm) break;
        }
        if (pm) {
          if (phonMode === 'shadow') {
            phoneticShadow.push({ list: e.list, hitName: e.hitName, score: Math.round(sc), shape: pm });
          } else {
            addHit(e.list, e.hitName, sc, key,
              { mechanism: 'phonetic', confidence: 'WEAK (phonetic-only)', phoneticShape: pm });
          }
        }
      }
    }
  }

  const lists = [...byNorm.values()].sort((a, b) => b.score - a.score).slice(0, 12);
  /* A subject carrying letters OUTSIDE the Latin A-Z fold (Arabic/Cyrillic/CJK
     script — normalizeName keeps them, but the published lists are indexed in
     Latin, so those tokens can never bucket-match anything) must not silently
     clear at 0: mirror screen.py's _unscreenable and route it to MANUAL
     REVIEW. Only when NOTHING hit — an exact match against a curated
     same-script entry, a Latin-residue fuzzy hit or a subset hit still wins
     (this branch is strictly recall-monotone). */
  if (!lists.length && lostScriptLetters(rawName)) {
    return {
      name, topScore: 0, band: 'medium', recommendation: 'review', hitCount: 1,
      lists: [{ list: MANUAL_REVIEW_LIST, score: 0,
        hitName: 'name not auto-screenable (non-Latin script — its letters cannot be matched against the Latin-published lists) — screen this subject manually against all lists' }]
    };
  }
  if (!lists.length) {
    const out = { name, topScore: Math.round(best), band: 'low', recommendation: 'clear', hitCount: 0, lists: [] };
    if (phoneticShadow.length) out.phoneticShadow = phoneticShadow;
    return out;
  }
  const topScore = lists[0].score;
  /* Mechanism-aware banding. Subset and phonetic-only are RECALL gates that
     fire at low real similarity ("Ahmed Hassan" inside every longer chain
     sharing those two given names, "Karim Aziz" ~ "Kareem Azeez …") — real
     leads for disambiguation, not designation matches. When they are ALL a
     subject has, the row reads review/medium so the MLRO queue is not flooded
     with critical/high alerts for weak evidence. Nothing is suppressed: the
     hits, scores and mechanisms are all recorded, the row still counts as a
     material match downstream, and any exact/fuzzy/short-entry/near-exact-core
     hit keeps the full sanctions-match severity. */
  const weakOnly = lists.every(h => h.mechanism === 'subset' || h.mechanism === 'phonetic');
  if (weakOnly) {
    const out = { name, topScore, band: 'medium', recommendation: 'review', hitCount: lists.length, lists };
    if (phoneticShadow.length) out.phoneticShadow = phoneticShadow;
    return out;
  }
  const band = topScore >= 98 ? 'critical' : 'high';
  const out = { name, topScore, band, recommendation: 'sanctions-match', hitCount: lists.length, lists };
  if (phoneticShadow.length) out.phoneticShadow = phoneticShadow;
  return out;
}

/* Screen a batch of subjects → raw engine-shaped rows (one per subject), keyed
   by subject.name so the existing normaliser maps them back to jurisdiction/gid. */
export function screenSubjects(subjects, index, threshold = 85) {
  return (subjects || []).map(s => screenName(s.name, index, threshold));
}
