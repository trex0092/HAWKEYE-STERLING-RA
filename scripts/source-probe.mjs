#!/usr/bin/env node
/* Source probe — dispatch-only diagnostic for screening-list endpoints.

   Five worldwide sources were disabled on 2026-08-05 live evidence (WAF
   challenges, unknown JSON field names, sheet layouts) that can only be
   inspected FROM A RUNNER — the dev sandbox's egress proxy blocks every
   government host. This instrument closes that loop: it fetches a source
   ALREADY CONFIGURED in the registry (by id — never an arbitrary URL, so a
   dispatch cannot be aimed anywhere the registry doesn't already point),
   with realistic browser headers, and reports status, headers, body size,
   a bounded body sample, and — when the body parses — the JSON key paths
   or spreadsheet header row the parser mapping needs. The output is a
   step-summary + artifact for the maintainer; nothing here screens,
   alerts, or writes state.

   Usage: node scripts/source-probe.mjs <source-id|all-disabled> */
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const REGISTRY_FILES = ['data/sanctions-sources.json', 'data/sanctions-extra.json'];

export function loadRegistry(files = REGISTRY_FILES) {
  const out = [];
  for (const f of files) {
    try {
      const d = JSON.parse(readFileSync(f, 'utf8'));
      for (const s of (d.sources || [])) if (s && s.id) out.push(s);
    } catch { /* a missing registry file just narrows the probe set */ }
  }
  return out;
}

export function probeTargets(registry, selector) {
  if (selector === 'all-disabled') {
    return registry.filter(s => s.enabled === false && typeof s.url === 'string' && /^https?:/.test(s.url));
  }
  /* One id, or several comma-separated ids — still registry ids only. */
  const ids = new Set(String(selector || '').split(',').map(x => x.trim()).filter(Boolean));
  return registry.filter(s => ids.has(s.id) && typeof s.url === 'string' && /^https?:/.test(s.url));
}

/* Bounded, printable body sample: control bytes hex-escaped so a WAF's
   binary garbage cannot mangle the report. */
export function sampleBody(buf, max = 2048) {
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(String(buf || ''));
  const head = b.subarray(0, max).toString('utf8');
  return head.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g,
    c => '\\x' + c.charCodeAt(0).toString(16).padStart(2, '0'));
}

/* JSON reconnaissance: every distinct key path (depth-limited) with a value
   sample — exactly what the generic JSON walker's field mapping needs. */
export function jsonKeyPaths(body, { maxPaths = 60, maxDepth = 5 } = {}) {
  let data;
  try { data = JSON.parse(typeof body === 'string' ? body : Buffer.from(body).toString('utf8')); }
  catch { return null; }
  const paths = new Map();
  const visit = (node, path, depth) => {
    if (paths.size >= maxPaths || depth > maxDepth || node == null) return;
    if (Array.isArray(node)) { if (node.length) visit(node[0], path + '[]', depth + 1); return; }
    if (typeof node !== 'object') {
      if (!paths.has(path)) paths.set(path, String(node).slice(0, 60));
      return;
    }
    for (const [k, v] of Object.entries(node)) visit(v, path ? path + '.' + k : k, depth + 1);
  };
  visit(data, '', 0);
  return [...paths.entries()].map(([p, v]) => p + ' = ' + v);
}

/* Link discovery: the data-file URLs a landing page or API index points at.
   Several sources publish the real file behind an HTML landing page (ZA FIC)
   or a portal API (IDB's CKAN) — the probe's body sample is too small to show
   the href, so this walks the WHOLE body for URL-shaped strings that look
   like data files and absolutizes them against the fetched URL. Diagnostic
   output only: discovered URLs go into the registry via PR, never fetched
   automatically. */
export function extractDataLinks(body, baseUrl, { max = 40 } = {}) {
  const text = typeof body === 'string' ? body : Buffer.from(body || '').toString('utf8');
  const found = new Set();
  const DATAISH = /\.(xml|csv|xlsx|xls|ods|json|zip)(\?|"|'|\\|&|\s|$)|download|filetype=|datastore|\/resource\/|\/dump\//i;
  // href/src attributes (HTML) + bare URL strings (JSON values, escaped or not)
  const patterns = [
    /(?:href|src)\s*=\s*["']([^"']+)["']/gi,
    /https?:(?:\\\/\\\/|\/\/)(?:[^\s"'<>\\]|\\\/)+/gi,
    /["']((?:\/|\.\.?\/)[^"'<>\s]*(?:\.(?:xml|csv|xlsx|xls|ods|json|zip)|[?&]fileType=[^"'<>\s]*)[^"'<>\s]*)["']/gi,
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(text)) && found.size < max * 3) {
      const raw = (m[1] || m[0]).replace(/\\\//g, '/').replace(/&amp;/g, '&');
      if (!DATAISH.test(raw)) continue;
      try { found.add(new URL(raw, baseUrl).href); } catch { /* not a resolvable URL — skip */ }
    }
  }
  return [...found].slice(0, max);
}

/* XLSX/ODS reconnaissance: the header row(s) the sheet reader would see. */
export async function sheetHeaders(buf) {
  try {
    const m = await import('./sanctions-match.mjs');
    const files = m.unzipEntries(buf);
    if (!files.size) return null;
    if (files.get('content.xml')) {
      const names = m.parseOdsContent(files.get('content.xml').toString('utf8'));
      return ['(ODS) parsed names: ' + names.length, ...names.slice(0, 5).map(n => '  e.g. ' + n)];
    }
    const shared = m.parseSharedStrings((files.get('xl/sharedStrings.xml') || '').toString());
    let sheetXml = (files.get('xl/worksheets/sheet1.xml') || '').toString();
    if (!sheetXml) for (const [k, v] of files) { if (/^xl\/worksheets\/.*\.xml$/i.test(k)) { sheetXml = v.toString(); break; } }
    const rows = m.parseSheetRows(sheetXml, shared);
    return rows.slice(0, 6).map((r, i) => 'row' + i + ': ' + r.slice(0, 12).join(' | ').slice(0, 220));
  } catch (e) {
    return ['sheet parse failed: ' + (e && e.message || e)];
  }
}

/* Parse reconnaissance: run the source's OWN registry parser over the fetched
   body (bytes for spreadsheet parsers, text otherwise — decoded with the
   source's charset when it declares one), so the probe proves the parse, not
   just the fetch. Pure given the parser; pinned in test/sanctions-screen.test.mjs. */
export async function parseSummary(s, buf) {
  try {
    const m = await import('./sanctions-match.mjs');
    const binary = /^(xlsx|dfat|ods|lbisf)$/i.test(String(s.parser || '')) || /^(xlsx|ods)$/i.test(String(s.type || ''));
    const body = binary ? buf
      : (typeof s.charset === 'string' && s.charset ? new TextDecoder(s.charset).decode(buf) : Buffer.from(buf).toString('utf8'));
    const names = m.parseList(s, body);
    const floor = Number(s.minNames) || 0;
    return ['parser ' + (s.parser || s.type || '(inferred)') + ': ' + names.length + ' names'
      + (floor ? ' (minNames ' + floor + (names.length >= floor ? ', met)' : ', NOT met)') : ''),
      ...names.slice(0, 8).map(n => '  e.g. ' + String(n).slice(0, 120))];
  } catch (e) {
    return ['parse failed: ' + String(e && e.message || e).slice(0, 160)];
  }
}

export function renderReport(results) {
  const L = ['# Source probe', ''];
  for (const r of results) {
    L.push('## ' + r.id + ' — ' + (r.name || ''), '');
    L.push('- url: ' + r.url);
    if (r.discovered) L.push('- discovered via ' + r.discovered);
    if (r.finalUrl && r.finalUrl !== r.url) L.push('- final url (after redirects): ' + r.finalUrl);
    L.push('- outcome: ' + r.outcome + (r.status ? ' (http ' + r.status + ')' : ''));
    if (r.contentType) L.push('- content-type: ' + r.contentType);
    if (r.bytes != null) L.push('- bytes: ' + r.bytes);
    if (r.server) L.push('- server: ' + r.server);
    if (r.jsonPaths && r.jsonPaths.length) { L.push('', '### JSON key paths', '```', ...r.jsonPaths, '```'); }
    if (r.links && r.links.length) { L.push('', '### Data-file links discovered', '```', ...r.links, '```'); }
    if (r.parsed && r.parsed.length) { L.push('', '### Parsed by the registry parser', '```', ...r.parsed, '```'); }
    if (r.sheet && r.sheet.length) { L.push('', '### Sheet reconnaissance', '```', ...r.sheet, '```'); }
    if (r.sample) { L.push('', '### Body sample (bounded, control bytes escaped)', '```', r.sample, '```'); }
    L.push('');
  }
  L.push('_Diagnostic only: nothing screened, no state written. Field mappings go into the parser + registry via PR._');
  return L.join('\n');
}

async function probeOne(s, timeoutMs = 90000) {
  const r = { id: s.id, name: s.name, url: s.url, outcome: 'unknown' };
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    /* A source with `discover` is resolved exactly as the screen resolves it,
       so the probe exercises the real path, not a pinned edition. */
    if (s.discover && s.discover.page) {
      const { discoverDatedLink } = await import('./sanctions-screen.mjs');
      const pr = await fetch(String(s.discover.page), { signal: ctrl.signal, redirect: 'follow' });
      const found = pr.ok ? discoverDatedLink(await pr.text(), String(s.discover.page), s.discover.fileStem, s.discover.linkMatch) : null;
      if (!found) { r.outcome = 'discovery-failed (page http ' + pr.status + ')'; return r; }
      r.url = found; r.discovered = s.discover.page;
    }
    const res = await fetch(r.url, {
      signal: ctrl.signal, redirect: 'follow',
      headers: {
        /* Realistic browser headers — several of the disabled sources sit
           behind WAFs that reject bare fetches; the probe's job is to learn
           whether headers alone are the difference. */
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,application/json;q=0.9,*/*;q=0.8',
        'accept-language': 'en-US,en;q=0.9',
      },
    });
    r.status = res.status;
    r.finalUrl = res.url || '';
    r.contentType = res.headers.get('content-type') || '';
    r.server = res.headers.get('server') || '';
    const buf = Buffer.from(await res.arrayBuffer());
    r.bytes = buf.length;
    r.outcome = res.ok ? 'fetched' : 'http-error';
    if (res.ok) r.parsed = await parseSummary(s, buf);
    if (/zip|officedocument|opendocument/.test(r.contentType) || buf.subarray(0, 2).toString() === 'PK') {
      r.sheet = await sheetHeaders(buf);
    } else {
      r.jsonPaths = jsonKeyPaths(buf);
      r.links = extractDataLinks(buf, r.url);
      r.sample = sampleBody(buf);
    }
  } catch (e) {
    r.outcome = 'fetch-failed: ' + String(e && e.message || e).slice(0, 120);
  } finally { clearTimeout(t); }
  return r;
}


/* ── Fixed diagnostic suites (no registry id; URLs are FIXED in code, never
   taken from the dispatch input) ──
   opensanctions-catalogue: which national lists the daily engine's worldwide
     net (OpenSanctions `sanctions` collection) actually carries, with each
     list's publisher country — the evidence needed before a country is
     counted as screened.
   news-feeds: whether Bing News honours a country edition (cc/setlang/mkt),
     how GDELT's DOC API rate-limits a runner, and whether GDELT's free bulk
     GKG files (every 15 min, all countries, 65 languages, no per-query
     limit) are reachable and parse as documented. Queries use a PUBLIC
     FIGURE's name only — never a customer or employee name. */
export const SUITES = ['opensanctions-catalogue', 'news-feeds', 'news-editions'];
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
async function get(url, timeoutMs = 60000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  const t0 = Date.now();
  try {
    const res = await fetch(url, { signal: ctrl.signal, redirect: 'follow', headers: { 'user-agent': UA, 'accept-language': 'en-US,en;q=0.9' } });
    const buf = Buffer.from(await res.arrayBuffer());
    return { status: res.status, ok: res.ok, buf, ms: Date.now() - t0, headers: res.headers, finalUrl: res.url };
  } catch (e) {
    return { status: 'error', ok: false, buf: Buffer.alloc(0), ms: Date.now() - t0, error: String(e && e.message || e).slice(0, 160) };
  } finally { clearTimeout(t); }
}
const cell = v => String(v == null ? '' : v).replace(/\|/g, '/').replace(/\s+/g, ' ').trim();

async function suiteOpenSanctionsCatalogue() {
  const L = ['## OpenSanctions `sanctions` collection — member lists and publisher countries', ''];
  const base = 'https://data.opensanctions.org/datasets/latest/';
  const coll = await get(base + 'sanctions/index.json');
  L.push('collection index: HTTP ' + coll.status + ', ' + coll.buf.length + ' bytes');
  let members = [];
  try {
    const j = JSON.parse(coll.buf.toString('utf8'));
    members = j.datasets || j.children || j.sources || [];
    if (!Array.isArray(members)) members = [];
    members = members.map(m => typeof m === 'string' ? m : (m && m.name)).filter(Boolean);
    if (!members.length) L.push('unexpected shape — key paths: ' + jsonKeyPaths(coll.buf).slice(0, 30).join(', '));
  } catch (e) { L.push('collection index did not parse: ' + e.message); }
  L.push('member datasets: ' + members.length, '');
  L.push('| dataset | title | publisher country | publisher | official | targets | last change | source url |');
  L.push('| --- | --- | --- | --- | --- | --- | --- | --- |');
  for (const name of members) {
    const r = await get(base + encodeURIComponent(name) + '/index.json', 30000);
    try {
      const d = JSON.parse(r.buf.toString('utf8'));
      const pub = d.publisher || {};
      const stats = d.stats || d.target_stats || {};
      const targets = d.target_count ?? (stats.targets && stats.targets.total) ?? stats.total ?? '';
      L.push('| ' + [name, d.title, pub.country || pub.country_label, pub.name, pub.official, targets, d.last_change || d.updated_at, (d.url || (d.resources && '') || '')].map(cell).join(' | ') + ' |');
    } catch {
      L.push('| ' + cell(name) + ' | (index HTTP ' + r.status + ') | | | | | | |');
    }
  }
  return L.join('\n');
}

function gkgStats(text, maxRows = 200000) {
  const rows = text.split('\n').filter(Boolean);
  const cols = {};
  let persons = 0, titles = 0, trans = 0;
  const langs = {};
  const sample = [];
  for (const line of rows.slice(0, maxRows)) {
    const f = line.split('\t');
    cols[f.length] = (cols[f.length] || 0) + 1;
    if (f[12] && f[12].trim()) persons++;
    if (f[26] && /<PAGE_TITLE>/i.test(f[26])) titles++;
    if (f[25] && f[25].trim()) { trans++; const m = /srclc:([a-z]{2,3})/i.exec(f[25]); if (m) langs[m[1]] = (langs[m[1]] || 0) + 1; }
    if (sample.length < 3 && f[12] && f[26]) {
      const t = (/<PAGE_TITLE>([\s\S]*?)<\/PAGE_TITLE>/i.exec(f[26]) || [])[1] || '';
      sample.push('source=' + cell(f[3]).slice(0, 40) + ' · persons(sample)=' + cell(f[12]).slice(0, 80) + ' · title=' + cell(t).slice(0, 90));
    }
  }
  const topLangs = Object.entries(langs).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([k, v]) => k + ':' + v).join(' ');
  return ['rows ' + rows.length + ' · column counts ' + JSON.stringify(cols) + ' · with persons ' + persons + ' · with PAGE_TITLE ' + titles
    + ' · translated ' + trans + (topLangs ? ' · source languages ' + topLangs : ''), ...sample.map(x => '  e.g. ' + x)];
}

async function suiteNewsFeeds() {
  const L = ['## News-feed reachability from the runner', ''];
  const who = '"Recep Tayyip Erdoğan"';
  const q = encodeURIComponent(who);
  const bingVariants = [
    ['bing (default)', 'https://www.bing.com/news/search?q=' + q + '&format=rss'],
    ['bing cc=TR setlang=tr', 'https://www.bing.com/news/search?q=' + q + '&format=rss&cc=TR&setlang=tr'],
    ['bing mkt=tr-TR', 'https://www.bing.com/news/search?q=' + q + '&format=rss&mkt=tr-TR'],
    ['bing cc=FR setlang=fr', 'https://www.bing.com/news/search?q=' + q + '&format=rss&cc=FR&setlang=fr'],
    ['bing mkt=ar-SA', 'https://www.bing.com/news/search?q=' + q + '&format=rss&mkt=ar-SA'],
    ['bing cc=IN', 'https://www.bing.com/news/search?q=' + q + '&format=rss&cc=IN'],
  ];
  const seen = {};
  for (const [label, url] of bingVariants) {
    const r = await get(url, 30000);
    const xml = r.buf.toString('utf8');
    const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(m => m[1]);
    const srcs = items.map(i => ((/<News:Source>([\s\S]*?)<\/News:Source>/i.exec(i) || /<source[^>]*>([\s\S]*?)<\/source>/i.exec(i) || [])[1] || '').trim());
    const titles = items.map(i => ((/<title>([\s\S]*?)<\/title>/i.exec(i) || [])[1] || '').trim());
    seen[label] = new Set(titles);
    L.push('- **' + label + '**: HTTP ' + r.status + ' · ' + r.ms + ' ms · ' + items.length + ' items · sources: ' + cell(srcs.slice(0, 8).join('; ')).slice(0, 220));
    L.push('  - first titles: ' + cell(titles.slice(0, 3).join(' || ')).slice(0, 300));
  }
  const def = seen['bing (default)'] || new Set();
  for (const [label] of bingVariants.slice(1)) {
    const s = seen[label] || new Set();
    const overlap = [...s].filter(x => def.has(x)).length;
    L.push('- overlap with default edition — ' + label + ': ' + overlap + ' of ' + s.size + ' titles shared');
  }
  L.push('');
  const gn = await get('https://news.google.com/rss/search?q=' + q + '&hl=tr&gl=TR&ceid=TR:tr', 30000);
  L.push('- google news TR:tr: HTTP ' + gn.status + ' · ' + gn.ms + ' ms · ' + (gn.buf.toString('utf8').match(/<item>/g) || []).length + ' items');
  for (let i = 1; i <= 3; i++) {
    const g = await get('https://api.gdeltproject.org/api/v2/doc/doc?query=' + q + '&mode=artlist&format=json&maxrecords=10&timespan=7d', 30000);
    L.push('- gdelt doc call ' + i + ': HTTP ' + g.status + ' · ' + g.ms + ' ms · retry-after=' + ((g.headers && g.headers.get && g.headers.get('retry-after')) || '-')
      + ' · body: ' + cell(g.buf.toString('utf8').slice(0, 140)));
    if (i < 3) await new Promise(r => setTimeout(r, 6000));
  }
  L.push('');
  for (const which of ['lastupdate.txt', 'lastupdate-translation.txt']) {
    for (const scheme of ['https', 'http']) {
      const lu = await get(scheme + '://data.gdeltproject.org/gdeltv2/' + which, 30000);
      L.push('- gdelt ' + scheme + ' ' + which + ': HTTP ' + lu.status + ' · ' + cell(lu.buf.toString('utf8')).slice(0, 400));
      if (!lu.ok) continue;
      const gkgUrl = (lu.buf.toString('utf8').split('\n').map(l => l.trim().split(/\s+/)[2]).filter(Boolean).find(u => /gkg\.csv\.zip$/.test(u)));
      if (!gkgUrl) break;
      const z = await get(gkgUrl.replace(/^https?:/, scheme + ':'), 120000);
      L.push('  - ' + gkgUrl + ': HTTP ' + z.status + ' · ' + z.buf.length + ' bytes · ' + z.ms + ' ms');
      if (z.ok) {
        try {
          const m = await import('./sanctions-match.mjs');
          const files = m.unzipEntries(z.buf);
          for (const [fname, content] of files) {
            L.push('  - entry ' + fname + ': ' + content.length + ' bytes');
            for (const line of gkgStats(content.toString('utf8'))) L.push('    - ' + line);
          }
        } catch (e) { L.push('  - unzip failed: ' + e.message); }
      }
      break;
    }
  }
  return L.join('\n');
}

/* news-editions: does a Bing country edition (cc + setlang) return that
   country's own press? Each market is queried with a PUBLIC FIGURE of that
   country (head of state / government) in the default and the local edition;
   low title overlap + local source names = a genuinely local edition. Also
   GDELT GKG theme frequencies (to choose adverse themes from observed codes,
   not memory) and the translated-stream file availability one hour back. */
const EDITION_TESTS = [
  ['AE', 'ar', 'Mohammed bin Rashid'], ['AE', 'en', 'Mohammed bin Rashid'], ['SA', 'ar', 'Mohammed bin Salman'],
  ['EG', 'ar', 'Abdel Fattah el-Sisi'], ['IQ', 'ar', 'Mohammed Shia al-Sudani'], ['LB', 'ar', 'Joseph Aoun'],
  ['IN', 'en', 'Narendra Modi'], ['IN', 'hi', 'Narendra Modi'], ['PK', 'en', 'Shehbaz Sharif'], ['PK', 'ur', 'Shehbaz Sharif'],
  ['BD', 'bn', 'Muhammad Yunus'], ['IR', 'fa', 'Masoud Pezeshkian'], ['RU', 'ru', 'Vladimir Putin'], ['DE', 'de', 'Friedrich Merz'],
  ['BR', 'pt', 'Luiz Inácio Lula da Silva'], ['MX', 'es', 'Claudia Sheinbaum'], ['CN', 'zh-hans', 'Xi Jinping'], ['NG', 'en', 'Bola Tinubu'],
  ['KE', 'en', 'William Ruto'], ['ID', 'id', 'Prabowo Subianto'],
];
function bingItems(xml) {
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(m => m[1]);
  return items.map(i => ({
    t: ((/<title>([\s\S]*?)<\/title>/i.exec(i) || [])[1] || '').trim(),
    s: ((/<News:Source>([\s\S]*?)<\/News:Source>/i.exec(i) || [])[1] || '').trim(),
  }));
}
async function suiteNewsEditions() {
  const L = ['## Bing country editions — local press or global index?', '',
    '| market | query | default items | local items | shared titles | local sources (first 6) |', '| --- | --- | --- | --- | --- | --- |'];
  const defCache = {};
  for (const [cc, lang, who] of EDITION_TESTS) {
    const q = encodeURIComponent('"' + who + '"');
    if (!defCache[who]) {
      const d = await get('https://www.bing.com/news/search?q=' + q + '&format=rss', 30000);
      defCache[who] = bingItems(d.buf.toString('utf8'));
      await new Promise(r => setTimeout(r, 700));
    }
    const r = await get('https://www.bing.com/news/search?q=' + q + '&format=rss&cc=' + cc + '&setlang=' + lang, 30000);
    const loc = bingItems(r.buf.toString('utf8'));
    const def = new Set(defCache[who].map(x => x.t));
    const shared = loc.filter(x => def.has(x.t)).length;
    L.push('| ' + [cc + ':' + lang + ' (HTTP ' + r.status + ')', who, defCache[who].length, loc.length, shared,
      loc.slice(0, 6).map(x => x.s).join('; ')].map(cell).join(' | ') + ' |');
    await new Promise(r => setTimeout(r, 700));
  }
  L.push('', '## GDELT GKG themes and translated stream', '');
  const lu = await get('https://data.gdeltproject.org/gdeltv2/lastupdate.txt', 30000);
  const enUrl = (lu.buf.toString('utf8').split('\n').map(l => l.trim().split(/\s+/)[2]).filter(Boolean).find(u => /gkg\.csv\.zip$/.test(u)) || '');
  const ts = (/(\d{14})\.gkg/.exec(enUrl) || [])[1];
  if (ts) {
    const d = new Date(Date.UTC(+ts.slice(0, 4), +ts.slice(4, 6) - 1, +ts.slice(6, 8), +ts.slice(8, 10), +ts.slice(10, 12)));
    const stamp = x => x.toISOString().replace(/[-:T]/g, '').slice(0, 12) + '00';
    const themes = {};
    for (const back of [0, 60]) {
      const t2 = stamp(new Date(d.getTime() - back * 60000));
      for (const kind of ['gkg', 'translation.gkg']) {
        const url = 'https://data.gdeltproject.org/gdeltv2/' + t2 + '.' + kind + '.csv.zip';
        const z = await get(url, 120000);
        L.push('- ' + url + ': HTTP ' + z.status + ' · ' + z.buf.length + ' bytes');
        if (!z.ok) continue;
        const m = await import('./sanctions-match.mjs');
        for (const [, content] of m.unzipEntries(z.buf)) {
          const text = content.toString('utf8');
          for (const line of gkgStats(text)) L.push('  - ' + line);
          for (const row of text.split('\n')) {
            const f = row.split('\t');
            for (const th of String(f[7] || '').split(';')) if (th) themes[th] = (themes[th] || 0) + 1;
          }
        }
      }
    }
    const top = Object.entries(themes).sort((a, b) => b[1] - a[1]);
    const adverse = top.filter(([k]) => /CRIME|CORRUPT|ARREST|TERROR|LAUNDER|FRAUD|BRIB|SANCTION|TRIAL|CONVICT|SMUGGL|TRAFFICK|EMBEZZL|TAX_EVASION|PROSECUT|INVESTIGAT|POLICE|SEIZE|EXTORT|DRUG/.test(k));
    L.push('', '- top 40 themes: ' + top.slice(0, 40).map(([k, v]) => k + ':' + v).join(' '));
    L.push('- risk-related theme codes observed (' + adverse.length + '): ' + adverse.slice(0, 120).map(([k, v]) => k + ':' + v).join(' '));
  }
  return L.join('\n');
}

async function main(argv) {
  const selector = argv[0];
  if (!selector) { console.error('usage: source-probe.mjs <source-id|all-disabled> [outdir]'); return 2; }
  if (SUITES.includes(selector)) {
    const md = selector === 'opensanctions-catalogue' ? await suiteOpenSanctionsCatalogue()
      : selector === 'news-editions' ? await suiteNewsEditions() : await suiteNewsFeeds();
    console.log(md);
    return 0;
  }
  const targets = probeTargets(loadRegistry(), selector);
  if (!targets.length) { console.error('source-probe: no probeable source matches "' + selector + '"'); return 2; }
  const results = [];
  for (const s of targets) {
    console.error('source-probe: ' + s.id + ' → ' + s.url);
    results.push(await probeOne(s));
  }
  const md = renderReport(results);
  console.log(md);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).then(c => process.exit(c)).catch(e => { console.error(e); process.exit(1); });
}
