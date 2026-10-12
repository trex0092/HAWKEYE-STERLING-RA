/* Static guardrail for the service worker (no SW runtime needed) — locks the
   fixes for: navigation cache poisoning, the incomplete offline precache, and a
   stale cache version. Usage: node test/sw.test.mjs */
import { readFileSync } from 'node:fs';

let passed = 0, failed = 0;
const check = (name, cond) => { if (cond) { passed++; console.log('  ok  ' + name); } else { failed++; console.log('FAIL  ' + name); } };

const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');

/* 1. The navigation handler must only cache a SUCCESSFUL response — never poison
   the app shell with a 404/500/maintenance page. */
check('navigation handler guards cache.put on a successful response (fresh.ok)',
  /if\s*\(\s*fresh\s*&&\s*fresh\.ok\s*\)/.test(sw));

/* 2. The offline precache (SHELL) must include the page logic + stylesheets, or
   a first-time offline visit renders unstyled and inert. */
for (const asset of ['app.js', 'console.js', 'advisor.js', 'app.css', 'console.css', 'advisor.css', 'fonts.css']) {
  check(`SHELL precaches ${asset} (offline-usable)`, sw.includes(`./${asset}`));
}

/* 3. CACHE version must have been bumped past v1 so the new shell installs. */
const cacheVer = (sw.match(/const CACHE\s*=\s*'([^']+)'/) || [])[1] || '';
check('CACHE version is bumped past v1', cacheVer !== '' && cacheVer !== 'hsra-shell-v1');

/* JavaScript reference data and browser-visible country suggestions must not
   be served from the previous release's cache while HTML/app.js are current.
   Keep offline fallback for an actual fetch failure. */
check('all same-origin JavaScript, including assets/super-data.js, is network-first',
  sw.includes("url.pathname.endsWith('.js') || url.pathname.endsWith('.mjs')"));
check('browser-fetched country suggestion JSON is network-first',
  sw.includes("url.pathname.endsWith('/data/country-score-suggested.json')"));
check('static shell cache is version-bumped for network-first asset policy',
  cacheVer === 'hsra-shell-v6');

check('successful navigation and script cache writes outlive their fetch responses',
  (sw.match(/event\.waitUntil\(cache\.put\(req, fresh\.clone\(\)\)\.catch\(\(\) => \{\}\)\)/g) || []).length === 2);
check('stale-while-revalidate keeps background revalidation alive on cache hits',
  sw.includes('if (cached) event.waitUntil(network)'));

/* The static-GET branch keeps its own res.ok guard. */
check('static-GET branch still guards on res.ok', /if\s*\(\s*res\s*&&\s*res\.ok\s*\)/.test(sw));

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
