/* Static, no-network contract: production deployment failures are never
 * misreported as success and repository variables are never materialized
 * wholesale in public action logs. */
import { readFileSync } from 'node:fs';
import { discoverServedAssets } from '../scripts/site-currency.mjs';

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

/* Every runtime file that site-currency probes must trigger the production
 * build-hook workflow when it changes alone. In June/July a stale publish
 * passed health because probes and triggers covered different asset sets. */
const push = workflow.split(/\n  push:\s*\n/)[1]?.split(/\n  schedule:\s*\n/)[0] || '';
const triggers = [...push.matchAll(/^\s*-\s*'([^']+)'/gm)].map(m => m[1]);
function deployTriggeredFor(asset) {
  if (triggers.includes(asset)) return true;
  if (asset.startsWith('assets/') && triggers.includes('assets/**')) return true;
  if (asset.startsWith('netlify/') && triggers.includes('netlify/**')) return true;
  const isRoot = !asset.includes('/');
  const ext = asset.split('.').pop();
  return isRoot && ['html','js','css','webmanifest'].includes(ext)
    && triggers.includes('*.' + ext);
}
const served = discoverServedAssets();
check('every exact-byte-monitored customer-facing runtime asset triggers deploy on main',
  served.length > 15 && served.every(deployTriggeredFor));
check('privacy terms and 404 changes alone trigger a new production publish',
  ['privacy-policy.html','terms.html','404.html'].every(deployTriggeredFor));
check('country-score suggestion JSON changes alone trigger publishing, not risk-model approval',
  deployTriggeredFor('data/country-score-suggested.json'));
check('unrelated governance and transient state do not consume Netlify build minutes',
  !deployTriggeredFor('data/grc-metrics.json') &&
  !deployTriggeredFor('docs/governance/dpia-2026.md'));
check('production deploy never equates HTTP 200 with published assets',
  workflow.includes('scripts/site-currency.mjs --quiet') &&
  workflow.includes('in ~18 minutes') &&
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
