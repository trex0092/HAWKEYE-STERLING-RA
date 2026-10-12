/* Offline guard: a required browser check must not hide a failing test. */
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const workflow = readFileSync(new URL('../../.github/workflows/cross-browser.yml', import.meta.url), 'utf8');
const command = 'run: npx playwright test --config=playwright.cross-browser.config.mjs';

function blockingBrowserGate(source) {
  const match = /      - name: Cross-browser smoke\n([\s\S]*?)(?=\n      - name:|$)/.exec(source);
  if (!match) return false;
  const body = match[1].split('\n').filter(line => !line.trim().startsWith('#')).join('\n');
  return body.includes(command) && !/continue-on-error\s*:/.test(body) &&
    !/\|\|\s*(?:true|:)|exit\s+0/.test(body) &&
    !/^\s*if\s*:/m.test(body) && !/^ {4}continue-on-error\s*:/m.test(source);
}

assert.ok(blockingBrowserGate(workflow), 'browser failures must block the required job');
assert.ok(!blockingBrowserGate(workflow.replace(command, 'continue-on-error: true\n        ' + command)),
  'reject a step-level failure waiver');
assert.ok(!blockingBrowserGate(workflow.replace(command, command + ' || true')),
  'reject a shell-level failure waiver');
assert.ok(!blockingBrowserGate(workflow.replace(command, 'if: false\n        ' + command)),
  'reject skipping the browser test');
assert.ok(!blockingBrowserGate(workflow.replace('  smoke:\n', '  smoke:\n    continue-on-error: true\n')),
  'reject a job-level failure waiver');
assert.ok(workflow.includes('      - name: Upload report\n        if: always()'),
  'retain failure artifacts so regressions remain diagnosable');
console.log('browser-gate: 6 offline regression checks passed');
