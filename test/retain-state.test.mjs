/* Offline immutable-retention unit and isolated-runner regressions. */
import { snapshotName, sha256, nextManifest, parseManifest } from '../scripts/retain-state.mjs';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, readdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

let passed = 0, failed = 0;
function check(name, cond) {
  if (cond) { passed++; console.log('  ok  ' + name); }
  else { failed++; console.log('FAIL  ' + name); }
}
const throws = fn => { try { fn(); return false; } catch { return true; } };

console.log('\n— immutable sanctions retention regressions —\n');
const day = '2026-10-12';
const h1 = sha256('synthetic-state-A');
const h2 = sha256('synthetic-state-B');

check('legacy archive filenames are still recognized',
  snapshotName({ updated: day }) === 'sanctions-state-' + day + '.json');
check('invalid dates keep the legacy unknown naming for callers',
  snapshotName({ updated: 'yesterday' }) === 'sanctions-state-unknown.json');
check('new archive filenames include the actual content digest',
  snapshotName({ updated: day }, h1) === 'sanctions-state-' + day + '-' + h1.slice(0, 16) + '.json');
check('malformed content hashes never yield an archive filename',
  throws(() => snapshotName({ updated: day }, 'invalid')));
check('SHA-256 is stable, 64-digit hexadecimal, and content-sensitive',
  /^[a-f0-9]{64}$/.test(h1) && sha256('synthetic-state-A') === h1 && h1 !== h2);

const entry1 = { file: snapshotName({ updated: day }, h1), sha256: h1, bytes: 17,
  updated: day, recordedAt: '2026-10-12T10:00:00.000Z' };
const entry2 = { file: snapshotName({ updated: day }, h2), sha256: h2, bytes: 17,
  updated: day, recordedAt: '2026-10-12T11:00:00.000Z' };
const initial = nextManifest([], entry1);
const both = nextManifest(initial, entry2);
check('append-only manifest preserves both editions from the same date',
  both.length === 2 && both.some(e => e.file === entry1.file)
  && both.some(e => e.file === entry2.file));
check('identical repeated entries are idempotent',
  nextManifest(both, entry2) === both);
check('a conflicting digest for an existing file name is rejected',
  throws(() => nextManifest(both, { ...entry1, sha256: h2 })));
check('a retained entry filename must match its date/digest',
  throws(() => nextManifest(both, { ...entry1, file: '../../secrets' })));
check('no input manifest is mutated during an append', initial.length === 1);
check('valid manifests round-trip', parseManifest(JSON.stringify(both)).length === 2);
check('missing, invalid and duplicated manifest entries fail loudly',
  throws(() => parseManifest('{broken'))
  && throws(() => parseManifest('{"file":"wrong shape"}'))
  && throws(() => parseManifest('[{"file":"x"}]'))
  && throws(() => parseManifest(JSON.stringify([entry1, entry1]))));

// Audit the existing committed retention history as well as synthetic
// fixtures. This catches a pre-existing mismatch BEFORE the runtime starts
// using the stronger archive verification gate.
const archiveBase = fileURLToPath(new URL('../data/retention/', import.meta.url));
const committedManifest = parseManifest(readFileSync(join(archiveBase, 'manifest.json'), 'utf8'));
check('committed retention manifest has valid historical entries',
  committedManifest.length > 0);
check('every committed legacy snapshot still matches its registered size and SHA-256',
  committedManifest.every(e => {
    const file = join(archiveBase, e.file);
    if (!existsSync(file)) return false;
    const bytes = readFileSync(file);
    return bytes.length === e.bytes && sha256(bytes) === e.sha256;
  }));

// Real CLI exercised only against temporary synthetic data, never the
// repository's committed retention history or any customer data.
const root = mkdtempSync(join(tmpdir(), 'hsra-retain-state-'));
try {
  const dataDir = join(root, 'data');
  const archiveDir = join(dataDir, 'retention');
  mkdirSync(archiveDir, { recursive: true });
  const stateFile = join(dataDir, 'sanctions-state.json');
  const manifestFile = join(archiveDir, 'manifest.json');
  const script = fileURLToPath(new URL('../scripts/retain-state.mjs', import.meta.url));
  const run = () => spawnSync(process.execPath, [script], { cwd: root, encoding: 'utf8' });
  const A = JSON.stringify({ updated: day, fixture: 'synthetic-A' });
  const B = JSON.stringify({ updated: day, fixture: 'synthetic-B' });
  writeFileSync(stateFile, A);
  const a = run();
  const savedA = JSON.parse(readFileSync(manifestFile, 'utf8'));
  const archivedA = join(archiveDir, savedA[0].file);
  check('initial runner retains correct immutable content hash',
    a.status === 0 && savedA.length === 1 && savedA[0].sha256 === sha256(A)
    && readFileSync(archivedA, 'utf8') === A);
  writeFileSync(stateFile, B);
  const b = run();
  const savedB = JSON.parse(readFileSync(manifestFile, 'utf8'));
  check('two same-day changes create two archives without overwriting the first',
    b.status === 0 && savedB.length === 2
    && savedB.some(e => e.sha256 === sha256(B))
    && readFileSync(archivedA, 'utf8') === A);
  const repeat = run();
  check('exact reruns do not mutate the manifest', repeat.status === 0 &&
    JSON.stringify(JSON.parse(readFileSync(manifestFile, 'utf8'))) === JSON.stringify(savedB));
  writeFileSync(archivedA, 'tampered bytes');
  const priorFiles = readdirSync(archiveDir).sort().join('|');
  const tamper = run();
  check('tampered old archive aborts before any further evidence mutation',
    tamper.status !== 0 && readdirSync(archiveDir).sort().join('|') === priorFiles
    && JSON.stringify(JSON.parse(readFileSync(manifestFile, 'utf8'))) === JSON.stringify(savedB));
  writeFileSync(archivedA, A);
  writeFileSync(manifestFile, '{invalid');
  writeFileSync(stateFile, JSON.stringify({ updated: day, fixture: 'synthetic-C' }));
  const before = readdirSync(archiveDir).sort().join('|');
  const corrupt = run();
  check('corrupt manifest aborts BEFORE writing a new snapshot',
    corrupt.status !== 0 && readdirSync(archiveDir).sort().join('|') === before);
  check('manifest never inserts an unexpected snapshot file',
    !existsSync(join(archiveDir, 'sanctions-state-unknown.json')));
} finally {
  rmSync(root, { recursive: true, force: true });
}

console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
if (failed) process.exitCode = 1;
