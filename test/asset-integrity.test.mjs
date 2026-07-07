/* Static guardrail for the three screens' asset graph — every local reference
   must resolve to a file that ships. Catches a renamed/moved/deleted asset (or a
   forgotten sw.js precache update) before it 404s in production, which the
   browser-smoke tests can't see because the shell still boots without an
   optional icon/font. Pure fs, no browser. Usage: node test/asset-integrity.test.mjs */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0, failed = 0;
const check = (name, cond) => { if (cond) { passed++; console.log('  ok  ' + name); } else { failed++; console.log('FAIL  ' + name); } };
const read = (rel) => readFileSync(resolve(ROOT, rel), 'utf8');
const localExists = (rel) => existsSync(resolve(ROOT, rel));

/* A reference is "local" when it is not an external URL, data: URI, anchor,
   mailto:, tel:, or protocol-relative link — i.e. a same-repo relative path. */
const isLocal = (u) => u && !/^(https?:|data:|mailto:|tel:|#|\/\/)/i.test(u);
const clean = (u) => u.split('#')[0].split('?')[0].replace(/^\.\//, '');

const PAGES = ['index.html', 'console.html', 'advisor.html'];

/* 1. Every href/src in each page resolves to a shipped file. */
for (const page of PAGES) {
  const html = read(page);
  const refs = [...html.matchAll(/(?:href|src)\s*=\s*"([^"]+)"/gi)]
    .map((m) => m[1]).filter(isLocal).map(clean);
  const unique = [...new Set(refs)];
  check(`${page}: has local asset references to verify`, unique.length > 0);
  for (const r of unique) {
    check(`${page}: href/src "${r}" exists`, localExists(r));
  }
}

/* 2. manifest.webmanifest — every icon src, start_url, scope and shortcut url
   resolves (scope/start_url may be a directory like "./"). */
const manifest = JSON.parse(read('manifest.webmanifest'));
for (const icon of manifest.icons || []) {
  check(`manifest: icon "${icon.src}" exists`, localExists(clean(icon.src)));
}
for (const sc of manifest.shortcuts || []) {
  if (isLocal(sc.url)) check(`manifest: shortcut "${sc.url}" exists`, localExists(clean(sc.url)));
}
for (const key of ['start_url', 'scope']) {
  const v = manifest[key];
  if (v && isLocal(v)) {
    const p = clean(v);
    check(`manifest: ${key} "${v}" exists`, p === '' || localExists(p));
  }
}

/* 3. sw.js SHELL precache — every entry resolves (a stale entry would 404 on
   install; cache.add rejects and the offline shell is silently incomplete). */
const sw = read('sw.js');
const shellBlock = (sw.match(/const SHELL\s*=\s*\[([\s\S]*?)\]/) || [])[1] || '';
const shell = [...shellBlock.matchAll(/["']([^"']+)["']/g)].map((m) => m[1]);
check('sw.js: SHELL precache list found', shell.length > 0);
for (const entry of shell) {
  const p = clean(entry);
  // './' is the site root (index.html served at /) — always valid.
  check(`sw.js: precache "${entry}" exists`, p === '' || localExists(p));
}

/* 4. fonts.css @font-face url() sources — every self-hosted woff2 resolves. */
const fonts = read('fonts.css');
const fontUrls = [...fonts.matchAll(/url\(\s*['"]?([^)'"]+)['"]?\s*\)/gi)]
  .map((m) => m[1]).filter(isLocal).map(clean);
check('fonts.css: has @font-face url() sources', fontUrls.length > 0);
for (const u of [...new Set(fontUrls)]) {
  check(`fonts.css: font "${u}" exists`, localExists(u));
}

/* 5. Page stylesheets — any url() background/asset (non-data) resolves. */
for (const css of ['app.css', 'console.css', 'advisor.css']) {
  const txt = read(css);
  const urls = [...txt.matchAll(/url\(\s*['"]?([^)'"]+)['"]?\s*\)/gi)]
    .map((m) => m[1]).filter(isLocal).map(clean);
  for (const u of [...new Set(urls)]) {
    check(`${css}: url("${u}") exists`, localExists(u));
  }
}

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
