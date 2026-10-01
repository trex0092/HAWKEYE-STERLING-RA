import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
const source = readFileSync(new URL('../.github/workflows/sanctions-screen.yml', import.meta.url), 'utf8');
const steps = source.split(/^      - /m);
const step = id => steps.find(text => text.includes('        id: ' + id + '\n'));

test('daily runtime schedule and provider pacing are preserved', () => {
  assert.match(source, /cron: '17 0 \* \* \*'/);
  assert.match(step('screen'), /SCREEN_ENRICH_BUDGET_MS: '6000000'/);
  assert.doesNotMatch(step('screen'), /SCREEN_CONCURRENCY:/);
  assert.match(source, /timeout-minutes: 120/);
});
test('coverage evidence and delivery survive a case failure, but not a failed or cancelled screen', () => {
  for (const id of ['assurance', 'delivery']) {
    const content = step(id);
    assert.ok(content);
    assert.match(content, /if: always\(\) && !cancelled\(\) && steps\.screen\.outcome == 'success' && steps\.screen\.outputs\.screen_error != 'true'/);
    assert.doesNotMatch(content, /continue-on-error/);
    assert.doesNotMatch(content, /steps\.cases\.outcome == 'success'/);
  }
});
test('delivery executes after assurance and before encrypted state persistence', () => {
  assert.ok(source.indexOf('id: assurance') < source.indexOf('id: delivery'));
  assert.ok(source.indexOf('id: delivery') < source.indexOf('id: persist'));
  assert.match(step('delivery'), /run: node scripts\/screening-delivery\.mjs/);
  assert.match(step('delivery'), /timeout-minutes: 10/);
  assert.match(step('delivery'), /ASANA_ACCESS_TOKEN: \$\{\{ secrets\.ASANA_ACCESS_TOKEN \}\}/);
  assert.doesNotMatch(step('delivery'), /steps\.assurance\.outcome == 'success'/);
});
