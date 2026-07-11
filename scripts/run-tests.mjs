/* Local unit-test runner — executes every test/*.test.js and test/*.test.mjs
   exactly the way ci.yml does (one `node test/<file>` process per suite, from
   the repo root, sequentially), so `npm test` and CI can never disagree on the
   set. The selection mirrors test/ci-coverage.test.mjs, which separately
   enforces that ci.yml lists every one of these suites by hand.
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

const failures = [];
for (const f of suites) {
  console.log(`\n=== node test/${f} ===`);
  const r = spawnSync(process.execPath, [join('test', f)], { cwd: ROOT, stdio: 'inherit' });
  if (r.status !== 0) failures.push(f);
}
console.log(`\n${suites.length - failures.length}/${suites.length} suites passed`);
if (failures.length) { console.log('failed: ' + failures.join(', ')); process.exit(1); }
