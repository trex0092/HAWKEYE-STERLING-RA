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

   Usage: node scripts/source-probe.mjs <source-id|all-disabled> [outdir] */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
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
  return registry.filter(s => s.id === selector && typeof s.url === 'string' && /^https?:/.test(s.url));
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

export function renderReport(results) {
  const L = ['# Source probe', ''];
  for (const r of results) {
    L.push('## ' + r.id + ' — ' + (r.name || ''), '');
    L.push('- url: ' + r.url);
    L.push('- outcome: ' + r.outcome + (r.status ? ' (http ' + r.status + ')' : ''));
    if (r.contentType) L.push('- content-type: ' + r.contentType);
    if (r.bytes != null) L.push('- bytes: ' + r.bytes);
    if (r.server) L.push('- server: ' + r.server);
    if (r.jsonPaths && r.jsonPaths.length) { L.push('', '### JSON key paths', '```', ...r.jsonPaths, '```'); }
    if (r.links && r.links.length) { L.push('', '### Data-file links discovered', '```', ...r.links, '```'); }
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
    const res = await fetch(s.url, {
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
    r.contentType = res.headers.get('content-type') || '';
    r.server = res.headers.get('server') || '';
    const buf = Buffer.from(await res.arrayBuffer());
    r.bytes = buf.length;
    r.outcome = res.ok ? 'fetched' : 'http-error';
    if (/zip|officedocument|opendocument/.test(r.contentType) || buf.subarray(0, 2).toString() === 'PK') {
      r.sheet = await sheetHeaders(buf);
    } else {
      r.jsonPaths = jsonKeyPaths(buf);
      r.links = extractDataLinks(buf, s.url);
      r.sample = sampleBody(buf);
    }
  } catch (e) {
    r.outcome = 'fetch-failed: ' + String(e && e.message || e).slice(0, 120);
  } finally { clearTimeout(t); }
  return r;
}

async function main(argv) {
  const selector = argv[0];
  if (!selector) { console.error('usage: source-probe.mjs <source-id|all-disabled> [outdir]'); return 2; }
  const outdir = argv[1] || '.';
  const targets = probeTargets(loadRegistry(), selector);
  if (!targets.length) { console.error('source-probe: no probeable source matches "' + selector + '"'); return 2; }
  const results = [];
  for (const s of targets) {
    console.log('source-probe: ' + s.id + ' → ' + s.url);
    results.push(await probeOne(s));
  }
  mkdirSync(outdir, { recursive: true });
  const md = renderReport(results);
  writeFileSync(join(outdir, 'source-probe-report.md'), md + '\n');
  console.log(md);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).then(c => process.exit(c)).catch(e => { console.error(e); process.exit(1); });
}
