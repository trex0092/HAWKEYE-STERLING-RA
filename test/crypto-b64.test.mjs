/* Regression guard for the base64 helpers in app.js.

   _b64 must not use String.fromCharCode.apply() on a single large array — that
   overflows the call stack at ~125 KB and silently broke at-rest persistence of
   the (unbounded) audit log / register. This test extracts the real _b64/_ub64
   from app.js source and round-trips a 256 KB payload (well past the limit).

   Usage: node test/crypto-b64.test.mjs */
import { readFileSync, writeFileSync, rmSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

let pass = 0, fail = 0;
const check = (name, cond) => { if (cond) { pass++; console.log('  ok  ' + name); } else { fail++; console.log('FAIL  ' + name); } };

const src = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
// Slice the two helper definitions out of the source and load them as a module.
const start = src.indexOf('const _b64 =');
const endMarker = 'const _ub64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));';
const end = src.indexOf(endMarker);
check('found _b64 and _ub64 definitions in app.js', start !== -1 && end !== -1);
const block = src.slice(start, end + endMarker.length);
check('_b64 does not call fromCharCode.apply on the whole array (chunked)',
  !/String\.fromCharCode\.apply\(null,\s*new Uint8Array\(u\)\)/.test(block));

// Load the real source (btoa/atob are Node globals >=16) via a temp ES module —
// no eval / new Function (keeps eslint no-new-func happy).
const dir = mkdtempSync(join(tmpdir(), 'b64-'));
const modPath = join(dir, 'b64.mjs');
writeFileSync(modPath, block + '\nexport { _b64, _ub64 };\n');
let _b64, _ub64;
try {
  ({ _b64, _ub64 } = await import(pathToFileURL(modPath).href));
} finally {
  rmSync(dir, { recursive: true, force: true });
}

// Round-trip a 256 KB payload — would throw RangeError with the old apply().
const big = new Uint8Array(256 * 1024);
for (let i = 0; i < big.length; i++) big[i] = (i * 7 + 13) & 0xff;
let b64, round, threw = false;
try { b64 = _b64(big); round = _ub64(b64); } catch { threw = true; }
check('_b64 encodes a 256 KB buffer without throwing', !threw && typeof b64 === 'string');
check('matches Node Buffer base64 (correctness)', b64 === Buffer.from(big).toString('base64'));
check('_ub64 round-trips the payload byte-for-byte',
  round && round.length === big.length && round.every((v, i) => v === big[i]));

// Small inputs still work (no regression).
const small = new Uint8Array([1, 2, 3, 250, 0, 255]);
check('small buffer round-trips', _ub64(_b64(small)).every((v, i) => v === small[i]));

console.log('\n' + pass + ' passed, ' + fail + ' failed\n');
if (fail) process.exit(1);
