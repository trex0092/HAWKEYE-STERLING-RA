/* Regression guard for the employee-population wiring gap found and fixed on
   2026-09-19 (PR #549, #550, #552): three separate workflows invoke the
   screening engine (screen.py / sanctions-screen.mjs) without forwarding the
   env var that controls the "HR - Employees" screening population, so the
   engine always fell back to its own hardcoded default GID -- which did not
   exist in Asana -- and its FATAL guard aborted the run before any customer
   OR employee ever got screened that day.

   This is a line-based text check over the workflow YAML (no YAML dep, same
   zero-dependency doctrine as workflow-hardening.test.mjs): it asserts each
   of the three workflows forwards the correct variable name for its engine.
   It does not (and cannot, without a live run) verify the variable's VALUE
   resolves to a real Asana object -- that is what proved the original bug,
   and no offline test can replace a live check. This test only prevents the
   specific regression of the forwarding line being silently dropped again.

   Usage: node test/employee-screening-wiring.test.mjs */
import { readFileSync } from 'node:fs';

let passed = 0, failed = 0;
function check(name, cond) {
  if (cond) { passed++; console.log('  ok  ' + name); }
  else { failed++; console.error('  FAIL ' + name); }
}

const WORKFLOWS = [
  { file: '.github/workflows/sanctions-screen.yml', engine: 'JS (sanctions-screen.mjs)', varName: 'ASANA_EMPLOYEE_PROJECT_GID' },
  { file: '.github/workflows/weekly-adverse-media.yml', engine: 'Python (screen.py)', varName: 'ASANA_EMPLOYEE_DB_GID' },
  { file: '.github/workflows/onboarding-screen.yml', engine: 'Python (screen.py, onboarding mode)', varName: 'ASANA_EMPLOYEE_DB_GID' },
];

const FORWARD_RE = (name) => new RegExp(name + ':\\s*\\$\\{\\{\\s*vars\\.' + name + '\\s*\\}\\}');

for (const wf of WORKFLOWS) {
  const text = readFileSync(wf.file, 'utf8');
  check(`${wf.file}: forwards ${wf.varName} into the ${wf.engine} job env (regression: 2026-09-19 employee-GID FATAL, PRs #549/#550/#552)`,
    FORWARD_RE(wf.varName).test(text));
}

/* If screen.py's own env-var name for this population ever changes, every one
   of the above should change together -- catch a partial rename early rather
   than as a live 404 in production. */
check('the Python-engine workflows agree on the same employee variable name',
  WORKFLOWS.filter(w => w.engine.startsWith('Python')).every(w => w.varName === 'ASANA_EMPLOYEE_DB_GID'));

console.log(`${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
