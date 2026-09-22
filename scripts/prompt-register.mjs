/* Prompt register — fingerprint helper for data/prompt-assets.json.

   The register pins every governed prompt to a SHA-256 of the exact source
   region that defines it. That is the change-control mechanism: editing a
   prompt without re-approving its row fails test/prompt-register.test.mjs, so
   an instruction set cannot drift in production without a recorded review.

   Usage:
     node scripts/prompt-register.mjs            # report current vs recorded
     node scripts/prompt-register.mjs --update   # re-pin after an approved edit

   --update rewrites the sha256 of every changed row and bumps its version. It
   does NOT record the review: set `approved_by` / `approved_on` on the rows it
   reports, in the same pull request as the prompt edit. Pure helpers are
   exported and exercised offline by the test. */
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const REGISTER_FILE = 'data/prompt-assets.json';

export function loadRegister(root = ROOT) {
  return JSON.parse(readFileSync(resolve(root, REGISTER_FILE), 'utf8'));
}

/* Slice the source region a row points at. Anchors are literal substrings, not
   regexes: `from` is the first occurrence of the declaration, `to` the first
   occurrence of the terminator after it, and both are included in the slice —
   so the fingerprint covers the whole declaration exactly as it reads on disk. */
export function extractRegion(src, region) {
  if (!region || !region.from || !region.to) return { ok: false, reason: 'row has no region anchors' };
  /* Git may materialise a CRLF worktree on Windows even though the tracked
     blobs and the register's literal anchors use LF. Resolve anchors against a
     canonical representation, just as fingerprint() already does, otherwise
     an LF anchor such as "\n\n" reports a false missing prompt region. */
  const canonical = String(src).replace(/\r\n/g, '\n');
  const start = canonical.indexOf(region.from);
  if (start === -1) return { ok: false, reason: 'start anchor not found: ' + JSON.stringify(region.from) };
  const end = canonical.indexOf(region.to, start + region.from.length);
  if (end === -1) return { ok: false, reason: 'end anchor not found after start: ' + JSON.stringify(region.to) };
  return { ok: true, text: canonical.slice(start, end + region.to.length) };
}

/* Line endings are normalised so a checkout on a different platform cannot
   report a false prompt change. */
export function fingerprint(text) {
  return createHash('sha256').update(String(text).replace(/\r\n/g, '\n'), 'utf8').digest('hex');
}

/* One row per registered prompt: { id, status, ... }.
     ok        — recorded fingerprint matches the source
     baseline  — row has no fingerprint yet (needs --update)
     changed   — source no longer matches the approved text
     missing   — the surface file or an anchor could not be resolved */
export function auditRegister(root = ROOT) {
  const reg = loadRegister(root);
  return (reg.prompts || []).map((p) => {
    let src;
    try { src = readFileSync(resolve(root, p.surface_file), 'utf8'); }
    catch { return { id: p.id, status: 'missing', reason: 'surface_file unreadable: ' + p.surface_file }; }
    const got = extractRegion(src, p.region);
    if (!got.ok) return { id: p.id, status: 'missing', reason: got.reason };
    const actual = fingerprint(got.text);
    const bytes = got.text.length;
    if (!p.sha256) return { id: p.id, status: 'baseline', actual, bytes };
    if (p.sha256 !== actual) return { id: p.id, status: 'changed', actual, recorded: p.sha256, bytes };
    return { id: p.id, status: 'ok', actual, bytes };
  });
}

if (process.argv[1] && process.argv[1].endsWith('prompt-register.mjs')) {
  const rows = auditRegister();
  const update = process.argv.includes('--update');
  for (const r of rows) {
    const detail = r.status === 'missing' ? r.reason : r.actual.slice(0, 16) + '…  (' + r.bytes + ' bytes)';
    console.log('  ' + r.status.padEnd(9) + r.id.padEnd(28) + detail);
  }
  if (update) {
    const reg = loadRegister();
    const touched = [];
    for (const p of reg.prompts) {
      const r = rows.find((x) => x.id === p.id);
      if (!r || r.status === 'ok' || r.status === 'missing') continue;
      if (r.status === 'changed') p.version = Number(p.version || 0) + 1;
      p.sha256 = r.actual;
      touched.push(p.id + ' → v' + p.version);
    }
    writeFileSync(resolve(ROOT, REGISTER_FILE), JSON.stringify(reg, null, 2) + '\n');
    console.log(touched.length
      ? '\nre-pinned: ' + touched.join(', ') + '\nNow record approved_by / approved_on on those rows.'
      : '\nnothing to re-pin.');
  } else if (rows.some((r) => r.status !== 'ok')) {
    console.log('\nrun: node scripts/prompt-register.mjs --update  (after the change is reviewed)');
  }
}
