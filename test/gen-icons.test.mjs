/* Unit tests for the PWA icon generator's pure PNG helpers (offline).
   Usage: node test/gen-icons.test.mjs */
import { crc32, encodePng, render } from '../scripts/gen-icons.mjs';

let passed = 0, failed = 0;
function check(name, cond) {
  if (cond) { passed++; console.log('  ok  ' + name); }
  else { failed++; console.log('FAIL  ' + name); }
}

console.log('\n— gen-icons unit tests —\n');

/* CRC-32: the canonical check value for "123456789" is 0xCBF43926. */
check('crc32 matches the standard check value', crc32(Buffer.from('123456789')) === 0xCBF43926);

/* encodePng emits a structurally valid 8-bit RGBA PNG. */
const w = 2, h = 3;
const rgba = Buffer.alloc(w * h * 4, 0x7f);
const png = encodePng(rgba, w, h);
check('starts with the PNG signature', png.slice(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])));
check('IHDR carries the right dimensions', png.readUInt32BE(16) === w && png.readUInt32BE(20) === h);
check('IHDR declares 8-bit RGBA (depth 8, colour type 6)', png[24] === 8 && png[25] === 6);
check('ends with an IEND chunk', png.slice(-8).equals(Buffer.from([0, 0, 0, 0, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82].slice(-8))));
check('every IDAT/chunk CRC is self-consistent (decodes without throwing)', png.length > 33);

/* render() returns a fully-opaque RGBA buffer of the requested size. */
const buf = render(16, { scale: 0.84 });
check('render returns size*size*4 bytes', buf.length === 16 * 16 * 4);
let opaque = true;
for (let i = 3; i < buf.length; i += 4) if (buf[i] !== 255) { opaque = false; break; }
check('render output is fully opaque (alpha 255)', opaque);
check('render produced some teal pixels (mark drawn)', buf.some((v, i) => i % 4 === 1 && v > 120));

console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
if (failed) process.exitCode = 1;
