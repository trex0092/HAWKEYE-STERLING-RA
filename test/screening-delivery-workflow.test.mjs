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
test('failed screening and unconfirmed case/report synchronization escalate directly to Asana', () => {
  const alert = step('asana-failure-alert');
  assert.ok(alert);
  assert.match(alert, /if: always\(\)/);
  for (const source of [
    "steps.screen.outcome == 'failure'", "steps.screen.outputs.screen_error == 'true'",
    "steps.cases.outcome == 'failure'", "steps.delivery.outcome == 'failure'",
    "steps.assurance.outcome == 'failure'", "steps.persist.outcome == 'failure'",
    "steps.refresh_assurance.outcome == 'failure'"
  ]) assert.ok(alert.includes(source), 'missing escalation condition: ' + source);
  assert.match(alert, /run: \|[\s\S]*node scripts\/asana-alert\.mjs/);
  assert.match(alert, /ASANA_ALERT_REFRESH_OPEN: '1'/);
  assert.match(alert, /ASANA_ACCESS_TOKEN: \$\{\{ secrets\.ASANA_ACCESS_TOKEN \}\}/);
  assert.match(alert, /ASANA_SECTION_GID: '1218451960830318'/);
  assert.match(alert, /timeout-minutes: 3/);
  assert.match(alert, /Do NOT infer clearance/);
  assert.match(alert, /NOT been remotely verified/);
  assert.ok(source.indexOf('id: delivery') < source.indexOf('id: asana-failure-alert'));
  assert.doesNotMatch(alert, /steps\.screen\.outputs\.title|sanctions-screen-report\.md|\.subjects\[/);
  assert.doesNotMatch(alert, /continue-on-error/);
});

test('failed encrypted-state persistence and missing watchdog dispatch cannot silently bypass MLRO escalation', () => {
  const alert = step('asana-failure-alert');
  const watcher = step('refresh_assurance');
  const persist = step('persist');
  assert.ok(alert && watcher && persist);
  assert.match(watcher, /id: refresh_assurance/);
  assert.match(watcher, /steps\.persist\.outcome == 'success'/);
  assert.match(alert, /PERSIST_FAILED: \$\{\{ steps\.persist\.outcome \}\}/);
  assert.match(alert, /REFRESH_ASSURANCE_FAILED: \$\{\{ steps\.refresh_assurance\.outcome \}\}/);
  assert.match(alert, /ASSURANCE_FAILED: \$\{\{ steps\.assurance\.outcome \}\}/);
  assert.match(alert, /SCREENING EVIDENCE INTEGRITY FAILED/);
  assert.match(alert, /do NOT infer clearance/);
  assert.match(alert, /MLRO must reconcile case state/);
  assert.match(alert, /node scripts\/asana-alert\.mjs/);
  assert.doesNotMatch(alert, /continue-on-error|subjects\[|sanctions-screen-report\.md/);
});

test('screening API cost dashboard uses complete verified inputs or reports INCOMPLETE', () => {
  const budget = steps.find(text => text.includes('name: API cost summary (metadata only)'));
  assert.ok(budget, 'screening cost step exists');
  assert.match(budget, /API_USD_RATES_JSON:\s*\$\{\{\s*vars\.API_USD_RATES_JSON\s*\}\}/);
  assert.match(budget, /if \[ ! -s api-cost-ledger\.jsonl \] \|\| \[ -z/);
  assert.match(budget, /INCOMPLETE: No verified pricing table and sanitized paid-usage receipts/);
  assert.match(budget, /Missing evidence is not zero spending/);
  assert.match(budget, /umask 077/);
  assert.match(budget, /PRICE_FILE="\$\{RUNNER_TEMP\}\/hawkeye-screen-verified-prices\.json"/);
  assert.match(budget, /trap 'rm -f "\$PRICE_FILE"' EXIT/);
  assert.match(budget, /node scripts\/api-cost-dashboard\.mjs --ledger api-cost-ledger\.jsonl --prices "\$PRICE_FILE"/);
  assert.doesNotMatch(budget, /run: node scripts\/api-cost-dashboard\.mjs\s*(?:\n|$)/,
    'dashboard without its required arguments always fails with exit code 2');
  assert.doesNotMatch(budget, /\$0\.00|estimated_usd: 0|status: priced_estimate/);
  assert.match(budget, /continue-on-error: true/,
    'cost observability cannot block the sanctions/PEP report delivery');
});

test('public issue fallback handles assurance failures without exposing screening identities', () => {
  const issue = steps.find(text => text.includes('Open a GitHub issue when screening or coverage needs human attention'));
  assert.ok(issue);
  assert.match(issue, /steps\.screen\.outputs\.screen_error == 'true'/);
  assert.match(issue, /steps\.assurance\.outcome == 'failure'/);
  assert.match(issue, /steps\.persist\.outcome == 'failure'/);
  assert.match(issue, /steps\.refresh_assurance\.outcome == 'failure'/);
  assert.match(issue, /state persistence or assurance dispatch requires review/);
  assert.match(issue, /steps\.cases\.outcome != 'success'/);
  assert.doesNotMatch(issue, /sanctions-screen-report\.md/);
  assert.doesNotMatch(issue, /body:\s*\(report/);
  assert.match(issue, /customer, principal, employee, and case identifiers/);
  assert.match(issue, /human MLRO review/);
});
