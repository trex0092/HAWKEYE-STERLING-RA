/* CI drift guard — every test file on disk must actually be executed by a
   workflow, so newly-added coverage can't be silently orphaned. ci.yml lists
   each unit test by hand (there is no test runner / package.json in this repo),
   so a new test/*.test.* that nobody wires into ci.yml would never run. This
   guard fails the moment that happens.

   Rules:
     - test/*.test.js  + test/*.test.mjs  → must run as `node test/<name>` in ci.yml
     - test/*.py                          → must run as `python test/<name>` in ci.yml
     - test/*.spec.mjs (Playwright)       → must be matched by a testMatch regex in
                                            one of the playwright*.config.mjs files
   Usage: node test/ci-coverage.test.mjs */
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0, failed = 0;
const check = (name, cond) => { if (cond) { passed++; console.log('  ok  ' + name); } else { failed++; console.log('FAIL  ' + name); } };
const read = (rel) => readFileSync(resolve(ROOT, rel), 'utf8');

const testFiles = readdirSync(resolve(ROOT, 'test'));
const ci = read('.github/workflows/ci.yml');

/* 1. Node unit tests → wired into ci.yml as `node test/<name>`. */
const nodeTests = testFiles.filter((f) => /\.test\.(js|mjs)$/.test(f)).sort();
check('found node unit tests to verify', nodeTests.length > 0);
for (const f of nodeTests) {
  check(`ci.yml runs node test/${f}`, ci.includes(`node test/${f}`));
}

/* 2. Python tests → wired into ci.yml as `python test/<name>`. */
const pyTests = testFiles.filter((f) => f.endsWith('.py')).sort();
check('found python tests to verify', pyTests.length > 0);
for (const f of pyTests) {
  check(`ci.yml runs python test/${f}`, ci.includes(`python test/${f}`));
}

/* 3. Playwright specs → matched by a testMatch regex in a playwright config, so
   a new *.spec.mjs is actually executed by the visual or cross-browser job. */
const specFiles = testFiles.filter((f) => f.endsWith('.spec.mjs')).sort();
const configs = readdirSync(ROOT).filter((f) => /^playwright.*\.config\.mjs$/.test(f));
check('found playwright config(s)', configs.length > 0);
const matchers = [];
for (const c of configs) {
  const m = read(c).match(/testMatch:\s*(\/[^\n]+?\/[a-z]*)\s*,?\s*$/m) || read(c).match(/testMatch:\s*(\/.+?\/[a-z]*)\s*[,}]/);
  if (m) {
    // Turn the JS regex literal /.../flags into a RegExp we can test filenames with.
    const lit = m[1];
    const body = lit.slice(1, lit.lastIndexOf('/'));
    const flags = lit.slice(lit.lastIndexOf('/') + 1);
    try { matchers.push(new RegExp(body, flags)); } catch { /* ignore unparseable */ }
  }
}
check('extracted testMatch pattern(s) from playwright configs', matchers.length > 0);
for (const f of specFiles) {
  check(`a playwright config testMatch covers ${f}`, matchers.some((re) => re.test(f)));
}

/* 4. Generated-artefact drift checks → the local runner and ci.yml must agree.
   These are ci.yml steps that are NOT test files (a script with a --check mode
   comparing a committed artefact against its regenerated form), so they were
   invisible to `npm test` until scripts/run-tests.mjs picked them up. A stale
   docs/regulatory-watch.md reached main that way on 2026-07-28. This guard
   keeps the two lists tied together in BOTH directions: a check the runner
   claims must really be a CI step, and a `--check` step in ci.yml must really
   be run locally — otherwise one side silently stops enforcing. */
const runner = read('scripts/run-tests.mjs');
const runnerChecks = [...runner.matchAll(/script:\s*'([^']+)'/g)].map((m) => m[1]).sort();
check('run-tests.mjs declares drift checks', runnerChecks.length > 0);
for (const s of runnerChecks) {
  check(`ci.yml also runs ${s} --check`, ci.includes(`node ${s} --check`));
}
const ciDriftChecks = [...ci.matchAll(/node (scripts\/[\w.-]+\.mjs) --check/g)].map((m) => m[1]).sort();
for (const s of new Set(ciDriftChecks)) {
  check(`scripts/run-tests.mjs also runs ${s} --check locally`, runnerChecks.includes(s));
}

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
