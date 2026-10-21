/* Offline guard: a required browser check must not hide a failing test. */
import { readFileSync } from 'node:fs';

const command = 'run: npx playwright test --config=playwright.cross-browser.config.mjs';
function blockingBrowserGate(source) {
  const match = /      - name: Cross-browser smoke\n([\s\S]*?)(?=\n      - name:|$)/.exec(source);
  if (!match) return false;
  const body = match[1].split('\n').filter(line => !line.trim().startsWith('#')).join('\n');
  return body.includes(command) && !/continue-on-error\s*:/.test(body) &&
    !/\|\|\s*(?:true|:)|exit\s+0/.test(body) &&
    !/^\s*if\s*:/m.test(body) && !/^ {4}continue-on-error\s*:/m.test(source);
}

// Changes to any part of the passive research surface must exercise the real
// browsers after merge, not only on pull requests.
const referencePaths = ['conflict-context.html', 'conflict-context.css',
  'legal-footer.js', 'data/conflict-context-sources.json', 'test/asset-integrity.test.mjs'];
function referencePushGate(source) {
  const push = /^  push:\n    branches: \[main\]\n    paths: \[([^\n]+)\]/m.exec(source);
  if (!push) return false;
  const paths = new Set([...push[1].matchAll(/'([^']+)'/g)].map(match => match[1]));
  return referencePaths.every(path => paths.has(path));
}

export function run(check) {
  const workflow = readFileSync(new URL('../../.github/workflows/cross-browser.yml', import.meta.url), 'utf8');
  check('browser failures block the required job', blockingBrowserGate(workflow));
  check('reject a step-level browser failure waiver', !blockingBrowserGate(
    workflow.replace(command, 'continue-on-error: true\n        ' + command)));
  check('reject a shell-level browser failure waiver', !blockingBrowserGate(
    workflow.replace(command, command + ' || true')));
  check('reject skipping the browser test', !blockingBrowserGate(
    workflow.replace(command, 'if: false\n        ' + command)));
  check('reject a job-level browser failure waiver', !blockingBrowserGate(
    workflow.replace('  smoke:\n', '  smoke:\n    continue-on-error: true\n')));
  const push = /^  push:\n    branches: \[main\]\n    paths: \[([^\n]+)\]/m.exec(workflow);
  check('changes to browser workflow, axe spec and failure gate re-run real browser tests on main',
    !!push && [
      '.github/workflows/cross-browser.yml',
      'test/api-platform/browser-gate.mjs',
      'test/axe.spec.mjs',
      'test/cross-browser.spec.mjs'
    ].every(path => push[1].includes("'" + path + "'")));
  check('conflict page, styles, navigation, policy and guards trigger main browser tests',
    referencePushGate(workflow));
  for (const path of referencePaths) {
    check('reject an unmonitored conflict research file: ' + path,
      !referencePushGate(workflow.replace("'" + path + "'", "'unrelated.fixture'")));
  }
  check('retain failure artifacts for diagnosis',
    workflow.includes('      - name: Upload report\n        if: always()'));
}
