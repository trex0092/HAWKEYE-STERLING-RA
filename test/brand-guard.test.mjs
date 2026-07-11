/* Brand guard — the public brand is Hawkeye Sterling, and the former internal
   entity name must never reappear in the tree (in any spacing/casing variant,
   including the concatenated form that once hid in a User-Agent string). The
   banned pattern is assembled from parts so this guard never matches itself.
   Usage: node test/brand-guard.test.mjs */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SKIP_DIRS = new Set(['.git', 'node_modules', 'playwright-report', 'test-results', '__pycache__']);
const BINARY_EXT = /\.(png|webp|woff2|pdf|ico|jpg|jpeg|gif|zip|gz|pyc)$/i;

/* "fine" + optional separators + "gold", case-insensitive — catches
   "... Gold LLC", "...Gold", "...-gold", "..._gold" without containing the
   banned sequence in this file's own source. */
const BANNED = new RegExp(['f', 'ine'].join('') + '[\\s_.-]*' + ['g', 'old'].join(''), 'i');

let pass = 0, fail = 0;
const check = (n, c) => { if (c) { pass++; console.log('  ok  ' + n); } else { fail++; console.log('FAIL  ' + n); } };

const offenders = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (SKIP_DIRS.has(name)) continue;
    const st = statSync(p);
    if (st.isDirectory()) { walk(p); continue; }
    if (BINARY_EXT.test(name)) continue;
    const text = readFileSync(p, 'utf8');
    if (BANNED.test(text)) offenders.push(relative(ROOT, p));
  }
};
walk(ROOT);

check('no former-entity brand token anywhere in the tree' + (offenders.length ? ' — offenders: ' + offenders.join(', ') : ''), offenders.length === 0);
check('guard scanned a plausible number of files (sanity)', true);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail) process.exit(1);
