/* Retain State — immutable, dated retention snapshots of the sanctions list
   fingerprint state, with a SHA-256 integrity manifest (append-only).

   The live data/sanctions-state.json is overwritten in place on every change,
   so the record of "which list version did we screen against on date X" is only
   recoverable from git history. UAE AML record-keeping requires that evidence be
   retained (FDL 10/2025) for years. This writes a per-date copy into
   data/retention/ and records its SHA-256 in data/retention/manifest.json, so
   each day's sanctions state is preserved as a tamper-evident, independently
   verifiable artifact alongside the git history.

   NOTE: this provides integrity (a hash chain you can verify), not authenticity
   — cryptographic commit/file SIGNING additionally requires a GPG/SSH signing
   key provisioned as a repository secret, which is an ops/settings step.

   Pure helpers (snapshotName, sha256, nextManifest) are offline-tested; the
   runner block reads/writes the filesystem. Usage: node scripts/retain-state.mjs */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

export const STATE_FILE     = 'data/sanctions-state.json';
export const RETENTION_DIR  = 'data/retention';
export const MANIFEST_FILE  = 'data/retention/manifest.json';

export function sha256(buf) {
  return createHash('sha256').update(buf).digest('hex');
}

/* Snapshot file name for a given state object — one immutable file per state
   date (the date screening used that list version). */
export function snapshotName(state) {
  const day = (state && typeof state.updated === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(state.updated))
    ? state.updated
    : 'unknown';
  return `sanctions-state-${day}.json`;
}

/* Append-only manifest update: add the entry, or replace the existing entry for
   the same file (a same-day re-snapshot). Never removes prior dates. Returns a
   new array sorted by file name (i.e. by date). entry: { file, sha256, bytes,
   updated, recordedAt }. */
export function nextManifest(manifest, entry) {
  const base = Array.isArray(manifest) ? manifest : [];
  const kept = base.filter(e => e.file !== entry.file);
  return [...kept, entry].sort((a, b) => String(a.file).localeCompare(String(b.file)));
}

/* Parse the existing manifest, THROWING on anything that isn't a JSON array.
   The manifest is an append-only tamper-evident SHA-256 chain — a corrupt or
   tampered file must fail loud, never be silently reset to [] and overwritten
   (which would erase the audit history). */
export function parseManifest(text) {
  const m = JSON.parse(text);            // throws on invalid JSON → caller fails loud
  if (!Array.isArray(m)) throw new Error('manifest is not a JSON array');
  return m;
}

function main() {
  if (!existsSync(STATE_FILE)) {
    console.error(`retain-state: ${STATE_FILE} not found — nothing to retain`);
    return;
  }
  const raw = readFileSync(STATE_FILE);
  let state;
  try { state = JSON.parse(raw.toString('utf8')); }
  catch (e) { console.error(`retain-state: ${STATE_FILE} is not valid JSON — ${e.message}`); process.exitCode = 1; return; }

  if (!existsSync(RETENTION_DIR)) mkdirSync(RETENTION_DIR, { recursive: true });

  const file = snapshotName(state);
  const hash = sha256(raw);
  writeFileSync(`${RETENTION_DIR}/${file}`, raw);

  let manifest = [];
  if (existsSync(MANIFEST_FILE)) {
    // FAIL LOUD on a corrupt/tampered manifest — never silently reset the
    // append-only tamper-evident hash chain (that would erase audit history).
    try {
      manifest = parseManifest(readFileSync(MANIFEST_FILE, 'utf8'));
    } catch (e) {
      console.error(`retain-state: ${MANIFEST_FILE} is corrupt (${e.message}) — refusing to overwrite the retention hash chain. Restore or investigate before re-running.`);
      process.exitCode = 1;
      return;
    }
  }
  const entry = {
    file,
    sha256: hash,
    bytes: raw.length,
    updated: state.updated || 'unknown',
    recordedAt: new Date().toISOString(),
  };
  const updated = nextManifest(manifest, entry);
  writeFileSync(MANIFEST_FILE, JSON.stringify(updated, null, 2) + '\n');
  console.log(`retain-state: snapshot ${RETENTION_DIR}/${file} (sha256 ${hash.slice(0, 12)}…, ${raw.length} bytes); manifest now ${updated.length} entr${updated.length === 1 ? 'y' : 'ies'}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main();
}
