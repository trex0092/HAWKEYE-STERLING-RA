/* Local unit-test runner — executes every test/*.test.js and test/*.test.mjs
   exactly the way ci.yml does (one `node test/<file>` process per suite, from
   the repo root, sequentially), so `npm test` and CI can never disagree on the
   set. The selection mirrors test/ci-coverage.test.mjs, which separately
   enforces that ci.yml lists every one of these suites by hand.

   It then runs the GENERATED-ARTEFACT DRIFT CHECKS, which are ci.yml steps that
   are not test files and were therefore invisible to `npm test`: a doc or
   snapshot generated from a data file goes stale the moment the data file
   changes without a regeneration, and CI fails on main rather than on the
   author's machine. That is exactly how a stale docs/regulatory-watch.md
   reached main (2026-07-28) after a source was added to data/reg-sources.json:
   the local suite was green because it never ran this class of check. Each
   entry below is a repo script with a --check mode that exits non-zero on
   drift; the message names the regeneration command.
   Usage: npm test   (or: node scripts/run-tests.mjs) */
import { readdirSync } from 'node:fs';
/* The one sanctioned process-spawning import in this repo: the runner's whole
   job is to execute each suite as its own `node test/<file>` process, exactly
   like ci.yml does — fixed executable (process.execPath), repo-controlled
   argv, no shell. Nothing user-supplied ever reaches the spawn. */
import { spawnSync } from 'node:child_process'; // nosemgrep: hawkeye-no-child-process
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const suites = readdirSync(join(ROOT, 'test'))
  .filter((f) => /\.test\.(js|mjs)$/.test(f))
  .sort();
if (suites.length === 0) { console.error('no unit suites found under test/'); process.exit(1); }

/* ci.yml steps that regenerate-and-compare a committed artefact. Kept in sync
   with ci.yml by test/ci-coverage.test.mjs, which ties the two lists together
   in both directions — so a drift check can never be added here and skipped in
   CI, or added to CI and missed here. Board figures are deliberately absent:
   their drift guard is a real test file (test/board-figures.test.mjs) and so
   already runs above. */
const DRIFT_CHECKS = [
  { script: 'scripts/reg-sources-doc.mjs', label: 'Regulatory Watch docs in sync with data/reg-sources.json', fix: 'node scripts/reg-sources-doc.mjs' },
  { script: 'scripts/grc-metrics.mjs', label: 'GRC metrics snapshot in sync with the assurance matrix, obligation register, third-party register and CAPA log', fix: 'node scripts/grc-metrics.mjs --write' }
];

const failures = [];
for (const f of suites) {
  console.log(`\n=== node test/${f} ===`);
  const r = spawnSync(process.execPath, [join('test', f)], { cwd: ROOT, stdio: 'inherit' });
  if (r.status !== 0) failures.push(f);
}
for (const c of DRIFT_CHECKS) {
  console.log(`\n=== node ${c.script} --check ===`);
  const r = spawnSync(process.execPath, [c.script, '--check'], { cwd: ROOT, stdio: 'inherit' });
  if (r.status !== 0) { failures.push(`${c.script} --check (${c.label}) — regenerate with: ${c.fix}`); }
}

const total = suites.length + DRIFT_CHECKS.length;
console.log(`\n${total - failures.length}/${total} checks passed (${suites.length} suites + ${DRIFT_CHECKS.length} drift checks)`);
if (failures.length) { console.log('failed:\n  ' + failures.join('\n  ')); process.exit(1); }
