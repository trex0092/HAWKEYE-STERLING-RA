/* Always-on repository policy and AML screening workflow integrity smoke.
 * Independent protection check for CODEOWNERS, declarative main protection,
 * browser smoke, human review and Asana source/delivery/assurance wiring.
 * No live API calls, credentials, or external package dependencies.
 *
 * Caveat: GitHub branch protection is enforced by GitHub, not this file.
 * The integration cannot read live main protection (403), so these tests
 * verify only committed policy and the required check's implementation.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { test } from 'node:test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = p => readFileSync(join(root, p), 'utf8');
const base = {
  owners: read('.github/CODEOWNERS'),
  settings: read('.github/settings.yml'),
  ci: read('.github/workflows/ci.yml'),
  smoke: read('.github/workflows/cross-browser.yml'),
  screen: read('.github/workflows/sanctions-screen.yml'),
  assurance: read('.github/workflows/screening-assurance.yml'),
};

function ownerEntries(body) {
  return body.split(/\r?\n/)
    .map(line => line.split('#')[0].trim().split(/\s+/))
    .filter(cols => cols.length >= 2 && cols[0].length && !cols[0].startsWith('#'));
}

function requiredContexts(body) {
  // Resolve only the required_status_checks context list, not arbitrary
  // YAML arrays of labels or workflows.
  const group = body.match(/^\s+required_status_checks:\s*\n([\s\S]*?)(?=^\s{6}\w|^\s{4}\w|^branches:|$(?![\s\S]))/m);
  const block = group?.[1] ?? '';
  const section = block.match(/^\s+contexts:\s*\n((?:^\s+-[^\n]*\n?)+)/m);
  return (section?.[1] ?? '').split('\n')
    .map(line => line.replace(/^\s*-\s*/, '').split(/\s+#/)[0].trim())
    .filter(Boolean);
}

function requiredPullRequestIsUnfiltered(body) {
  const start = body.match(/^  pull_request:\s*$/m);
  if (!start) return false;
  const tail = body.slice(start.index + start[0].length);
  const lines = tail.split(/\r?\n/);
  const block = [];
  for (const line of lines.slice(1)) {
    if (/^  [A-Za-z_-]+:/.test(line) || /^[A-Za-z_-]+:/.test(line)) break;
    block.push(line);
  }
  return !block.some(line => /^\s+(?:paths|paths-ignore):/.test(line));
}

function stepWithId(workflow, id) {
  const steps = workflow.split(/^      - /m);
  return steps.find(text => new RegExp('^\\s*id:\\s*' + id + '\\s*$', 'm').test(text));
}

export function policyFailures({ owners, settings, ci, smoke, screen, assurance }) {
  const errors = [];
  const demand = (ok, msg) => { if (!ok) errors.push(msg); };
  const entries = ownerEntries(owners);
  const ownedPaths = ['*', '/.github/', '/.github/CODEOWNERS',
    '/.github/settings.yml', '/.github/workflows/', '/scripts/',
    '/data/', '/screen.py', '/ai.py', '/agent_orchestrator.py', '/agents.py', '/test/'];
  for (const path of ownedPaths) {
    demand(entries.some(parts => parts[0] === path &&
      parts.includes('@trex0092')), 'CODEOWNERS missing required owner for ' + path);
  }

  const settingsMain = settings.slice(settings.indexOf('\nbranches:'));
  demand(settingsMain.includes('  - name: main'), 'main branch protection is not declared');
  demand(/required_approving_review_count:\s*[1-9]\d*\b/.test(settingsMain),
    'minimum one independent approving review required');
  for (const flag of ['dismiss_stale_reviews', 'require_code_owner_reviews',
    'required_linear_history', 'required_conversation_resolution']) {
    demand(new RegExp('^\\s*' + flag + ':\\s*true\\b', 'm').test(settingsMain),
      'branch review policy weakened: ' + flag);
  }
  demand(/strict:\s*true\b/.test(settingsMain), 'required checks must be strict');
  for (const flag of ['allow_force_pushes', 'allow_deletions']) {
    demand(new RegExp('^\\s*' + flag + ':\\s*false\\b', 'm').test(settingsMain),
      'protected main cannot allow ' + flag);
  }
  const required = requiredContexts(settings);
  for (const context of ['test', 'lint', 'smoke', 'analyze', 'semgrep',
    'gitleaks', 'size', 'Dependency Review', 'policy-guard']) {
    demand(required.includes(context), 'required status context missing: ' + context);
  }
  demand(new Set(required).size === required.length, 'duplicate required status checks');

  demand(/^  pull_request:\s*$/m.test(ci), 'CI must report for every pull request');
  demand(/^permissions:\s*\n\s+contents:\s*read\s*$/m.test(ci),
    'CI must use read-only GITHUB_TOKEN');
  demand(!/pull_request_target:|write-all|contents:\s*write/m.test(ci),
    'CI must not grant broad token privileges or unsafe PR target execution');
  const policyJob = ci.split(/^  policy-guard:\s*$/m)[1]?.split(/^  [A-Za-z_][\w-]*:\s*$/m)[0] ?? '';
  demand(policyJob.length > 100 && /name:\s*policy-guard\b/.test(policyJob),
    'always-reporting policy-guard job missing');
  for (const token of ['timeout-minutes: 10', 'step-security/harden-runner@',
    'egress-policy: block', 'persist-credentials: false',
    'node test/code-workflow-protection.test.mjs',
    'node test/protection-contexts.test.mjs',
    'node test/employee-screening-wiring.test.mjs',
    'node --test test/screening-delivery-workflow.test.mjs']) {
    demand(policyJob.includes(token), 'policy-guard missing: ' + token);
  }
  demand(!/continue-on-error:\s*true|if:\s*always\(\)/.test(policyJob),
    'policy-guard cannot suppress failures');

  demand(requiredPullRequestIsUnfiltered(smoke),
    'required cross-browser smoke is path-filtered or missing PR trigger');
  demand(/^  smoke:\s*$/m.test(smoke) &&
    /npx playwright test --config=playwright\.cross-browser\.config\.mjs/.test(smoke),
    'required cross-browser Playwright smoke absent');
  demand(!/continue-on-error:\s*true/.test(smoke),
    'browser smoke failure must not be hidden');

  for (const [field, expected] of [
    ['ASANA_CUSTOMER_PROJECT_GID', '1214107620220121'],
    ['ASANA_EMPLOYEE_PROJECT_GID', '1216239131596624'],
  ]) {
    demand(new RegExp('^\\s*' + field + ':\\s*.*\\b' + expected + '\\b', 'm').test(screen),
      'approved Asana screening source not bound: ' + field);
  }
  for (const id of ['screen', 'cases', 'assurance', 'delivery', 'persist', 'asana-failure-alert']) {
    demand(!!stepWithId(screen, id), 'missing protected screening workflow step: ' + id);
  }
  const incident = stepWithId(screen, 'asana-failure-alert') ?? '';
  demand(/if:\s*always\(\)\s*&&/.test(incident) &&
    /scripts\/asana-alert\.mjs/.test(incident) &&
    /ASANA_ALERT_REFRESH_OPEN:\s*'1'/.test(incident) &&
    !/continue-on-error:\s*true/.test(incident),
    'screening-to-Asana incident escalation disabled or silently ignored');
  demand(/SCREENING_ASSURANCE_EXPECTED_COMMIT:\s*\$/.test(assurance) &&
    /node scripts\/screening-assurance\.mjs --check/.test(assurance),
    'assurance must fail closed on stale/foreign commit evidence');
  demand(/if:\s*failure\(\)/.test(assurance) &&
    /scripts\/asana-alert\.mjs/.test(assurance),
    'failed screening assurance must escalate to Asana');
  return errors;
}

test('required owner, branch, screening-source, smoke and workflow protection all hold', () => {
  assert.deepEqual(policyFailures(base), []);
});
test('tests fail if CODEOWNERS loses ownership of sensitive workflow changes', () => {
  const changed = base.owners.replace(/^\/\.github\/workflows\/[^\n]*$/m, '');
  assert.ok(policyFailures({ ...base, owners: changed })
    .some(reason => reason.includes('CODEOWNERS')));
});
test('tests fail if single approval or code owner review is removed', () => {
  for (const replacement of ['required_approving_review_count: 0',
    'require_code_owner_reviews: false']) {
    const settings = replacement.startsWith('required')
      ? base.settings.replace(/required_approving_review_count:\s*1/, replacement)
      : base.settings.replace(/require_code_owner_reviews:\s*true/, replacement);
    assert.ok(policyFailures({ ...base, settings })
      .some(reason => /review/.test(reason)));
  }
});
test('tests fail if the required policy guard or browser smoke check is removed', () => {
  for (const context of ['policy-guard', 'smoke']) {
    const settings = base.settings.replace(
      new RegExp('^\\s*- ' + context + '(?:\\s+#.*)?$', 'm'), '');
    assert.ok(policyFailures({ ...base, settings })
      .some(reason => reason.includes('required status context missing: ' + context)));
  }
});
test('tests reject force pushes and relaxed required status strictness', () => {
  const weakened = base.settings.replace('allow_force_pushes: false', 'allow_force_pushes: true')
    .replace('strict: true', 'strict: false');
  const failures = policyFailures({ ...base, settings: weakened });
  assert.ok(failures.some(reason => reason.includes('allow_force_pushes')));
  assert.ok(failures.some(reason => reason.includes('strict')));
});
test('tests reject a silently bypassed policy check or path-filtered browser smoke', () => {
  const ci = base.ci.replace('run: node test/code-workflow-protection.test.mjs',
    'run: echo policy-guard bypassed');
  assert.ok(policyFailures({ ...base, ci }).some(x => x.includes('policy-guard missing')));
  const smoke = base.smoke.replace(/^  pull_request:\s*$/m,
    "  pull_request:\n    paths: ['index.html']");
  assert.ok(policyFailures({ ...base, smoke }).some(x => x.includes('path-filtered')));
});
test('tests reject any wrong source project, skipped incident alert, or stale assurance acceptance', () => {
  const screen = base.screen.replace('1216239131596624', '1234567890000000')
    .replace(/(^\s*id:\s*asana-failure-alert\b)/m, '        id: disabled-alert');
  const assurance = base.assurance.replace(
    'SCREENING_ASSURANCE_EXPECTED_COMMIT:', 'IGNORED_EXPECTED_COMMIT:');
  const failures = policyFailures({ ...base, screen, assurance });
  assert.ok(failures.some(x => x.includes('ASANA_EMPLOYEE_PROJECT_GID')));
  assert.ok(failures.some(x => x.includes('asana-failure-alert')));
  assert.ok(failures.some(x => x.includes('stale/foreign')));
});
