/* Retain immutable sanctions-list fingerprint snapshots.

   New editions use the state's updated date PLUS a truncated SHA-256 digest,
   preserving distinct changes on the same date. Before accepting a new state,
   verify every pre-existing manifest entry against the archived bytes. This
   catches local corruption and accidental replacement; SHA-256 alone is NOT a
   digital signature, an independent immutable archive or a hash chain.
   Signed commits/external evidence anchoring require separate configuration.
*/
import {
  readFileSync, writeFileSync, existsSync, mkdirSync,
  renameSync, unlinkSync, lstatSync,
} from 'node:fs';
import { createHash, randomBytes } from 'node:crypto';
import { pathToFileURL } from 'node:url';

export const STATE_FILE = 'data/sanctions-state.json';
export const RETENTION_DIR = 'data/retention';
export const MANIFEST_FILE = 'data/retention/manifest.json';

const HASH_RE = /^[a-f0-9]{64}$/;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function sha256(buf) {
  return createHash('sha256').update(buf).digest('hex');
}

function dayOrUnknown(state) {
  const s = state && state.updated;
  return typeof s === 'string' && DAY_RE.test(s) ? s : 'unknown';
}

/* Retain the one-argument legacy naming behavior for existing consumers,
   but include the content digest for every NEW written archive. */
export function snapshotName(state, digest = '') {
  const day = dayOrUnknown(state);
  if (digest && (typeof digest !== 'string' || !HASH_RE.test(digest))) {
    throw new Error('snapshot content digest is invalid');
  }
  return 'sanctions-state-' + day + (digest ? '-' + digest.slice(0, 16) : '') + '.json';
}

function validEntry(e) {
  if (!e || typeof e !== 'object' || Array.isArray(e)) return false;
  if (Object.keys(e).sort().join('|') !==
      ['file', 'sha256', 'bytes', 'updated', 'recordedAt'].sort().join('|')) return false;
  if (typeof e.sha256 !== 'string' || !HASH_RE.test(e.sha256) ||
      !Number.isSafeInteger(e.bytes) || e.bytes <= 0 ||
      typeof e.updated !== 'string' || typeof e.recordedAt !== 'string' ||
      !Number.isFinite(Date.parse(e.recordedAt))) return false;
  // Only date-based filenames created by our own naming algorithm, with
  // either the legacy date format or a matching digest prefix, are allowed.
  if (e.updated !== 'unknown' && !DAY_RE.test(e.updated)) return false;
  return e.file === snapshotName({ updated: e.updated }) ||
    e.file === snapshotName({ updated: e.updated }, e.sha256);
}

/* Append-only. Identical reruns are idempotent; changing an entry under an
   existing filename is an explicit failure. No historical record is removed. */
export function nextManifest(manifest, entry) {
  if (!Array.isArray(manifest) || !validEntry(entry)) {
    throw new Error('invalid retention manifest entry');
  }
  const previous = manifest.find(e => e.file === entry.file);
  if (previous) {
    if (previous.sha256 !== entry.sha256 || previous.bytes !== entry.bytes) {
      throw new Error('refusing to replace previously archived sanctions evidence');
    }
    return manifest;
  }
  return [...manifest, entry].sort((a, b) => a.file.localeCompare(b.file));
}

export function parseManifest(text) {
  const items = JSON.parse(text);
  if (!Array.isArray(items) || !items.every(validEntry)) {
    throw new Error('retention manifest has invalid entries');
  }
  if (new Set(items.map(e => e.file)).size !== items.length) {
    throw new Error('retention manifest has duplicate snapshot names');
  }
  return items;
}

function verifyArchives(items) {
  for (const entry of items) {
    const file = RETENTION_DIR + '/' + entry.file;
    if (!existsSync(file)) throw new Error('snapshot missing: ' + entry.file);
    const stat = lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink()) {
      throw new Error('snapshot is not an ordinary file: ' + entry.file);
    }
    const bytes = readFileSync(file);
    if (bytes.length !== entry.bytes || sha256(bytes) !== entry.sha256) {
      throw new Error('snapshot digest mismatch: ' + entry.file);
    }
  }
}

function writeManifestAtomically(value) {
  const temp = MANIFEST_FILE + '.tmp-' + process.pid + '-' + randomBytes(8).toString('hex');
  try {
    writeFileSync(temp, value, { flag: 'wx', mode: 0o600 });
    renameSync(temp, MANIFEST_FILE);
  } finally {
    if (existsSync(temp)) unlinkSync(temp);
  }
}

function main() {
  if (!existsSync(STATE_FILE)) {
    console.error('retain-state: missing sanctions fingerprint state');
    process.exitCode = 1;
    return;
  }
  let raw, state;
  try {
    raw = readFileSync(STATE_FILE);
    state = JSON.parse(raw.toString('utf8'));
  } catch {
    console.error('retain-state: unreadable or invalid sanctions fingerprint state');
    process.exitCode = 1;
    return;
  }
  if (dayOrUnknown(state) === 'unknown') {
    console.error('retain-state: missing or malformed state update date');
    process.exitCode = 1;
    return;
  }

  // Check historical evidence FIRST. A failed manifest read or hash check
  // must never overwrite today's earlier retained edition.
  let manifest = [];
  try {
    if (existsSync(MANIFEST_FILE)) {
      manifest = parseManifest(readFileSync(MANIFEST_FILE, 'utf8'));
      verifyArchives(manifest);
    }
  } catch (e) {
    console.error('retain-state: refusing to alter existing retention evidence (' + e.message + ')');
    process.exitCode = 1;
    return;
  }

  const hash = sha256(raw);
  const file = snapshotName(state, hash);
  const archive = RETENTION_DIR + '/' + file;
  try {
    mkdirSync(RETENTION_DIR, { recursive: true });
    if (existsSync(archive)) {
      const current = readFileSync(archive);
      if (current.length !== raw.length || sha256(current) !== hash) {
        throw new Error('content-addressed archive collision or tamper: ' + file);
      }
    } else {
      writeFileSync(archive, raw, { flag: 'wx', mode: 0o600 });
    }
    const entry = {
      file,
      sha256: hash,
      bytes: raw.length,
      updated: state.updated,
      recordedAt: new Date().toISOString(),
    };
    const updated = nextManifest(manifest, entry);
    if (updated !== manifest) writeManifestAtomically(JSON.stringify(updated, null, 2) + '\n');
    console.log('retain-state: retained ' + file + ' (' + raw.length + ' bytes); total editions ' + updated.length);
  } catch (e) {
    console.error('retain-state: archive/manifest write refused (' + e.message + ')');
    process.exitCode = 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) main();
