/* Immediate re-screen trigger guard (TFS without-delay duty).

   The Sanctions Watch must dispatch the case-engine screen the moment a
   designation list's CONTENT changes, instead of leaving the re-screen to the
   next cron slot. These checks pin the wiring: the watch script emits a
   content-only output, the watch workflow dispatches sanctions-screen.yml
   gated on that output (never on persistent-error alerts, never in seed
   mode), holds the actions:write scope the dispatch needs, and the target
   workflow still accepts workflow_dispatch. Any of these silently dropping
   would re-open the latency gap without failing anything else.
   Usage: node test/rescreen-trigger.test.mjs */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0, failed = 0;
function check(name, cond) {
  if (cond) { passed++; console.log('  ok  ' + name); }
  else { failed++; console.log('FAIL  ' + name); }
}

console.log('\n— immediate re-screen trigger guard —\n');

const watchYml = readFileSync(join(ROOT, '.github/workflows/sanctions-watch.yml'), 'utf8');
const screenYml = readFileSync(join(ROOT, '.github/workflows/sanctions-screen.yml'), 'utf8');
const watchSrc = readFileSync(join(ROOT, 'scripts/sanctions-watch.mjs'), 'utf8');

// the script separates content changes from error alerts for the trigger
check('watch script emits a content-only changes output',
  /setOutput\('content_changes', String\(moved\.length\)\)/.test(watchSrc));

// the watch workflow dispatches the case engine on that output
const dispatchStep = watchYml.match(/- name: Trigger an immediate re-screen[\s\S]*?(?=\n {6}- name: )/);
check('watch workflow has the immediate re-screen dispatch step', !!dispatchStep);
if (dispatchStep) {
  const step = dispatchStep[0];
  check('dispatch targets the case-engine screen workflow',
    /createWorkflowDispatch/.test(step) && /workflow_id: 'sanctions-screen\.yml'/.test(step));
  check('dispatch is gated on content changes, not on error alerts',
    /content_changes != '0'/.test(step) && !/has_changes/.test(step));
  check('seed mode (baseline) never dispatches a re-screen',
    /!= 'seed'/.test(step));
  check('a failed dispatch cannot kill the watch (scheduled screen is the backstop)',
    /continue-on-error: true/.test(step));
}

// the scope the dispatch call needs is granted at job level
check('watch job holds actions:write for the dispatch',
  /actions: write/.test(watchYml));

// and the target must keep accepting manual/API dispatch
check('sanctions-screen.yml still accepts workflow_dispatch',
  /^\s*workflow_dispatch:/m.test(screenYml));

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
