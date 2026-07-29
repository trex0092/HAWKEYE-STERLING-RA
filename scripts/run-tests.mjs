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

/* The PYTHON suites — the screening engine's own tests. Until 2026-07-29 these
   ran ONLY in ci.yml, so `npm test` was green for a developer who had just
   changed screen.py and broken it; the engine is ~5,900 lines and the largest
   suite carries 389 assertions. test/ci-coverage.test.mjs ties this list to
   ci.yml in BOTH directions, so a Python suite can no longer be wired into one
   and forgotten in the other.

   A missing interpreter or a missing engine dependency is reported as a LOUD
   SKIP, never as a pass: the repo's own rule for the screening engine is that a
   module which cannot run reads DEGRADED rather than clear, and a test runner
   owes the same honesty. Only ModuleNotFoundError qualifies — every other
   non-zero exit is a real failure. */
const pySuites = readdirSync(join(ROOT, 'test'))
  .filter((f) => f.endsWith('.py'))
  .sort();
const PYTHON = process.env.PYTHON || 'python3';

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
const skipped = [];
for (const f of suites) {
  console.log(`\n=== node test/${f} ===`);
  const r = spawnSync(process.execPath, [join('test', f)], { cwd: ROOT, stdio: 'inherit' });
  if (r.status !== 0) failures.push(f);
}
for (const f of pySuites) {
  console.log(`\n=== ${PYTHON} test/${f} ===`);
  /* Captured, not inherited, so a ModuleNotFoundError can be told apart from a
     genuine assertion failure; the output is echoed either way. */
  const r = spawnSync(PYTHON, [join('test', f)], {
    cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, ASANA_TOKEN: process.env.ASANA_TOKEN || 'local-test-runner' },
  });
  if (r.stdout) process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);
  if (r.status === 0) continue;
  const why = String(r.stderr || '');
  const missing = why.match(/ModuleNotFoundError: No module named '([^']+)'/);
  if (r.error?.code === 'ENOENT') {
    skipped.push(`test/${f} — no '${PYTHON}' on PATH (install Python 3.11+, or set PYTHON=)`);
  } else if (missing) {
    skipped.push(`test/${f} — missing engine dependency '${missing[1]}' (pip install -r ci/requirements.txt)`);
  } else {
    failures.push(`test/${f}`);
  }
}
for (const c of DRIFT_CHECKS) {
  console.log(`\n=== node ${c.script} --check ===`);
  const r = spawnSync(process.execPath, [c.script, '--check'], { cwd: ROOT, stdio: 'inherit' });
  if (r.status !== 0) { failures.push(`${c.script} --check (${c.label}) — regenerate with: ${c.fix}`); }
}

const total = suites.length + pySuites.length + DRIFT_CHECKS.length;
const ran = total - skipped.length;
console.log(`\n${ran - failures.length}/${ran} checks passed (${suites.length} node suites + ${pySuites.length - skipped.length}/${pySuites.length} python suites + ${DRIFT_CHECKS.length} drift checks)`);
if (skipped.length) {
  /* Loud on purpose. A skipped engine suite is NOT a pass — CI runs all of
     them, so a local skip only means this machine cannot see what CI will. */
  console.log(`\n⚠ ${skipped.length} python suite(s) SKIPPED — not run, not passed:\n  ` + skipped.join('\n  '));
}
if (failures.length) { console.log('failed:\n  ' + failures.join('\n  ')); process.exit(1); }
