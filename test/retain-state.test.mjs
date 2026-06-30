/* Unit tests for retain-state pure helpers (offline; no filesystem writes).
   Usage: node test/retain-state.test.mjs */
import { snapshotName, sha256, nextManifest, parseManifest } from '../scripts/retain-state.mjs';

let passed = 0, failed = 0;
function check(name, cond) {
  if (cond) { passed++; console.log('  ok  ' + name); }
  else { failed++; console.log('FAIL  ' + name); }
}

console.log('\n— retain-state unit tests —\n');

// snapshotName
check('snapshotName uses the state date', snapshotName({ updated: '2026-06-25' }) === 'sanctions-state-2026-06-25.json');
check('snapshotName falls back when date missing', snapshotName({}) === 'sanctions-state-unknown.json');
check('snapshotName rejects a non-date updated', snapshotName({ updated: 'yesterday' }) === 'sanctions-state-unknown.json');

// sha256 is stable + content-addressed
check('sha256 is 64 hex chars', /^[0-9a-f]{64}$/.test(sha256('hello')));
check('sha256 is deterministic', sha256('hello') === sha256('hello'));
check('sha256 differs on different input', sha256('hello') !== sha256('hellp'));

// nextManifest: append new date
const m0 = [];
const e1 = { file: 'sanctions-state-2026-06-24.json', sha256: 'a'.repeat(64), bytes: 10, updated: '2026-06-24', recordedAt: 'x' };
const m1 = nextManifest(m0, e1);
check('nextManifest appends a new entry', m1.length === 1 && m1[0].file === e1.file);

// append a second, later date -> sorted, both kept
const e2 = { file: 'sanctions-state-2026-06-25.json', sha256: 'b'.repeat(64), bytes: 12, updated: '2026-06-25', recordedAt: 'y' };
const m2 = nextManifest(m1, e2);
check('nextManifest keeps prior dates (append-only)', m2.length === 2);
check('nextManifest stays sorted by file/date', m2[0].file < m2[1].file);

// same-day re-snapshot replaces that date's entry, does not duplicate
const e2b = { ...e2, sha256: 'c'.repeat(64), bytes: 99, recordedAt: 'z' };
const m3 = nextManifest(m2, e2b);
check('nextManifest replaces a same-day entry (no dupes)', m3.length === 2);
check('nextManifest keeps the latest hash for that date', m3.find(e => e.file === e2.file).sha256 === 'c'.repeat(64));
check('nextManifest does not mutate the input array', m2.length === 2);

// parseManifest must FAIL LOUD on a corrupt/tampered manifest (never silently
// reset the tamper-evident chain). The runner turns a throw into exit 1 + no overwrite.
check('parseManifest returns the array for valid JSON', JSON.stringify(parseManifest('[{"file":"x"}]')) === '[{"file":"x"}]');
let threwCorrupt = false; try { parseManifest('{not valid json'); } catch { threwCorrupt = true; }
check('parseManifest throws on corrupt JSON (fails loud, no silent reset)', threwCorrupt);
let threwNonArray = false; try { parseManifest('{"file":"x"}'); } catch { threwNonArray = true; }
check('parseManifest throws on a non-array', threwNonArray);

console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
if (failed) process.exitCode = 1;
