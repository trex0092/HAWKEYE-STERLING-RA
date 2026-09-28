/* Runtime state must never enter normal PR history.
   This test runs in CI on every push/PR. */
import { existsSync, readFileSync } from 'node:fs';

let failed = 0;
function check(name, cond) {
  if (cond) console.log('  ok  ' + name);
  else { failed++; console.log('FAIL  ' + name); }
}

const head = process.env.GITHUB_HEAD_REF || '';
check('runtime state branches cannot be PR heads',
  !/^(screen-state|screen-delta-state)$/.test(head));

let cases = null;
try { cases = JSON.parse(readFileSync('data/screening-cases-state.json', 'utf8')); }
catch {}
check('main-line plaintext screening case state is an empty object',
  cases && typeof cases === 'object' && !Array.isArray(cases) && Object.keys(cases).length === 0);

let sanctionsState = null;
try { sanctionsState = JSON.parse(readFileSync('data/sanctions-screen-state.json', 'utf8')); }
catch {}
check('main-line sanctions subject registry contains no live subjects',
  sanctionsState && sanctionsState.subjects && Object.keys(sanctionsState.subjects).length === 0);

for (const path of [
  'data/screening-assurance.json',
  'data/badges/sanctions-operational.svg',
  'data/badges/adverse-media-operational.svg',
  'data/badges/pep-operational.svg',
]) {
  check(path + ' remains runtime-only and absent from normal source history', !existsSync(path));
}

console.log('\n' + (failed ? failed + ' failed' : 'state branch isolation passed'));
process.exit(failed ? 1 : 0);
