/* Static, no-network contract: production deployment failures are never
 * misreported as success and repository variables are never materialized
 * wholesale in public action logs. */
import { readFileSync } from 'node:fs';

let passed = 0, failed = 0;
function check(name, predicate) {
  if (predicate) { passed++; console.log('  ok  ' + name); }
  else { failed++; console.error('FAIL ' + name); }
}
const workflow = readFileSync(
  new URL('../.github/workflows/netlify-production-deploy.yml', import.meta.url), 'utf8');
const runbook = readFileSync(
  new URL('../docs/runbooks/netlify-production-recovery.md', import.meta.url), 'utf8');
check('production build hook remains repository-secret scoped and branch pinned',
  workflow.includes('secrets.NETLIFY_BUILD_HOOK_URL') &&
  workflow.includes('trigger_branch=main') &&
  workflow.includes('Netlify build hook POST for branch main'));
check('workflow never serializes all GitHub variables to env/logs',
  !/toJSON\s*\(\s*vars\s*\)/i.test(workflow) &&
  !/\bVARS_JSON\b/.test(workflow));
check('production deploy never equates HTTP 200 with published assets',
  workflow.includes('scripts/site-currency.mjs --quiet') &&
  workflow.includes('after ~18 minutes') &&
  workflow.includes('Build hook returned HTTP success, but production did not publish'));
check('operational runbook distinguishes build activation from publish locks',
  runbook.includes('Active builds') &&
  runbook.includes('locked') &&
  runbook.includes('Site Currency') &&
  runbook.includes('HTTP 200') &&
  runbook.includes('2026-11-01'));
check('no known real credential or hook URL is included in runbook',
  !/https:\/\/api\.netlify\.com\/build_hooks\/[a-f0-9]{10,}/i.test(runbook) &&
  !/sk-ant-[A-Za-z0-9-]+/.test(runbook));

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
