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
  { file: '.github/workflows/sanctions-runtime-assurance.yml', engine: 'JS (sanctions-runtime-assurance.mjs)', varName: 'ASANA_EMPLOYEE_PROJECT_GID' },
  { file: '.github/workflows/weekly-adverse-media.yml', engine: 'Python (screen.py)', varName: 'ASANA_EMPLOYEE_DB_GID' },
  { file: '.github/workflows/onboarding-screen.yml', engine: 'Python (screen.py, onboarding mode)', varName: 'ASANA_EMPLOYEE_DB_GID' },
];

const FORWARD_RE = (name) => new RegExp(name + ':\\s*\\$\\{\\{\\s*vars\\.' + name + '(?:\\s*\\|\\|\\s*[^}]+)?\\s*\\}\\}');

for (const wf of WORKFLOWS) {
  const text = readFileSync(wf.file, 'utf8');
  const isPython = wf.engine.startsWith('Python');
  const correct = isPython
    ? /ASANA_EMPLOYEE_DB_GID:\s*'1216239131596624'/.test(text) &&
      !/ASANA_EMPLOYEE_DB_GID:\s*\$\{\{/.test(text)
    : FORWARD_RE(wf.varName).test(text);
  check(`${wf.file}: binds the approved HR screening source for the ${wf.engine} job`,
    correct);
}

/* JS workflows retain strict fallback and source-route validation. Python
   workflows PIN the approved project GID, ignoring stale repository variables
   because the Python engine historically allowed an empty HR setting. A
   missing or redirected employee source must never create an all-clear. */
const EMPLOYEE_PROJECT_GID = '1216239131596624';
const source = readFileSync('scripts/sanctions-screen.mjs', 'utf8');
check('JS engine defaults to the same approved HR Employees GID used by all workflows',
  /: EMPLOYEE_PROJECT;/.test(source) &&
  /import \{ CUSTOMER_PROJECT, EMPLOYEE_PROJECT, MONITORING_PROJECT \}/.test(source));
check('JS engine aborts when customer, employee or results project changes',
  /requireApprovedScreeningRoute\(\);/.test(source) &&
  /return bailUnscreened\(/.test(source) &&
  /String\(employee \|\| ''\) !== EMPLOYEE_PROJECT/.test(source));

for (const wf of WORKFLOWS) {
  const text = readFileSync(wf.file, 'utf8');
  const correctSource = wf.engine.startsWith('Python')
    ? new RegExp(wf.varName + ":\\s*'" + EMPLOYEE_PROJECT_GID + "'").test(text)
    : new RegExp(wf.varName + ":\\s*\\$\\{\\{\\s*vars\\." + wf.varName + "\\s*\\|\\|\\s*'" + EMPLOYEE_PROJECT_GID + "'\\s*\\}\\}").test(text);
  check(`${wf.file}: ${wf.varName} cannot silently omit the approved HR project`,
    correctSource);
}

/* A customer-only sanctions probe can look green despite never screening
   the completed employee records. Verify BOTH production source IDs, not
   merely whether employee env keys exist in the workflow text. */
const runtimeWorkflow = readFileSync('.github/workflows/sanctions-runtime-assurance.yml', 'utf8');
check('runtime assurance explicitly defaults to the approved Customer Database',
  /ASANA_CUSTOMER_PROJECT_GID:\s*\$\{\{\s*vars\.ASANA_CUSTOMER_PROJECT_GID\s*\|\|\s*'1214107620220121'\s*\}\}/.test(runtimeWorkflow));
check('runtime assurance explicitly defaults to completed HR Employees population',
  /ASANA_EMPLOYEE_PROJECT_GID:\s*\$\{\{\s*vars\.ASANA_EMPLOYEE_PROJECT_GID\s*\|\|\s*'1216239131596624'\s*\}\}/.test(runtimeWorkflow));

/* The daily production screen must expose BOTH approved source IDs at
   the workflow boundary. Earlier runs printed an empty Customer DB env field
   even though the JS module silently supplied a fallback internally. Avoid
   source ambiguity in audit logs while preserving the in-engine strict route
   check against a stale or redirected repository variable. */
const primaryScreenWorkflow = readFileSync('.github/workflows/sanctions-screen.yml', 'utf8');
/* Runtime screening is intentionally schedule/manual-only: a code merge must
   run CI, but must not create an unscheduled screening cycle. */
check('production screening does not run automatically on code pushes', 
  !/^  push:/m.test(primaryScreenWorkflow) &&
  /group:\s*sanctions-screen-runtime/.test(primaryScreenWorkflow) &&
  /cancel-in-progress:\s*false/.test(primaryScreenWorkflow));
check('daily sanctions workflow explicitly binds approved Customer Database fallback',
  /ASANA_CUSTOMER_PROJECT_GID:\s*\$\{\{\s*vars\.ASANA_CUSTOMER_PROJECT_GID\s*\|\|\s*'1214107620220121'\s*\}\}/.test(primaryScreenWorkflow));
check('daily sanctions workflow binds the exact approved HR Employees population',
  /ASANA_EMPLOYEE_PROJECT_GID:\s*\$\{\{\s*vars\.ASANA_EMPLOYEE_PROJECT_GID\s*\|\|\s*'1216239131596624'\s*\}\}/.test(primaryScreenWorkflow));
check('JS source route refuses a redirected customer, employee, delivery or monitoring project',
  /String\(customer \|\| ''\) !== CUSTOMER_PROJECT/.test(source) &&
  /String\(employee \|\| ''\) !== EMPLOYEE_PROJECT/.test(source) &&
  /String\(results \|\| ''\) !== MONITORING_PROJECT/.test(source) &&
  /String\(monitoring \|\| ''\) !== MONITORING_PROJECT/.test(source));

/* The retired manual workflow still supports dispatch and must never
   screen only customers while claiming complete sanctions coverage. */
const manual = readFileSync('.github/workflows/daily-sanctions-screen.yml', 'utf8');
const legacySource = readFileSync('scripts/daily-screen-fetch.py', 'utf8');
check('manual sanctions workflow binds the Customer Database to its approved source',
  /CUSTOMER_DB_GID:.*1214107620220121/.test(manual));
check('manual sanctions workflow screens completed employees from the approved HR source',
  /EMPLOYEE_DB_GID:.*1216239131596624/.test(manual) &&
  /fetch_source_tasks\(token, employee, "HR Employees"\)/.test(legacySource) &&
  /APPROVED_EMPLOYEE_PROJECT = "1216239131596624"/.test(legacySource));

/* If screen.py's own env-var name for this population ever changes, every one
   of the above should change together -- catch a partial rename early rather
   than as a live 404 in production. */
check('the Python-engine workflows agree on the same employee variable name',
  WORKFLOWS.filter(w => w.engine.startsWith('Python')).every(w => w.varName === 'ASANA_EMPLOYEE_DB_GID'));

console.log(`${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
