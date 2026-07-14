/* Screening state + egress drift guard — two failure classes from the 09–12 Jul
   incident (issue #222) can never silently return:

   1. STATE-BRANCH SPLIT-BRAIN — the engine persists its run state (metrics,
      delta, coverage) on the screen-delta-state branch because main is
      push-protected. Any workflow that CONSUMES that state must overlay it from
      the same branch: anomaly-watch once read main's frozen copy and escalated
      a false "dead pipeline" while the daily sweep was green.
   2. REFUSED LIST REDIRECTS — OFAC and UN serve their files via 302 to
      presigned storage URLs (S3 / Azure blob). An egress-blocked runner that
      allowlists only the primary domain refuses the redirect at connect time,
      and the core list silently screens EMPTY (sanctions DEGRADED every run).
      Every workflow that allowlists a primary must allowlist its storage host.

   Pure Node built-ins, line-scanning over the repo's own layout (no YAML dep),
   matching the other drift guards. Usage: node test/screening-state.test.mjs */
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0, failed = 0;
const check = (name, cond) => { if (cond) { passed++; console.log('  ok  ' + name); } else { failed++; console.log('FAIL  ' + name); } };
const wf = (name) => readFileSync(join(ROOT, '.github/workflows', name), 'utf8');

/* 1. The state consumers and producers all point at the same branch. */
const STATE_BRANCH = 'screen-delta-state';

const anomaly = wf('anomaly-watch.yml');
check('anomaly-watch fetches the state branch before detecting',
  anomaly.includes(`git fetch origin ${STATE_BRANCH}`));
check('anomaly-watch overlays data/run-metrics.json from the state branch',
  anomaly.includes('git checkout FETCH_HEAD -- data/run-metrics.json'));
check('anomaly-watch still feeds run-metrics.json to the detector',
  anomaly.includes('monitoring.py escalate data/run-metrics.json'));

for (const producer of ['weekly-adverse-media.yml', 'onboarding-screen.yml']) {
  const y = wf(producer);
  check(`${producer} overlays state from ${STATE_BRANCH}`,
    y.includes(`git fetch origin ${STATE_BRANCH}`));
  check(`${producer} persists state back to ${STATE_BRANCH}`,
    y.includes(`refs/heads/${STATE_BRANCH}`));
}

/* 1b. SINGLE WRITER — both state producers force-push the same branch (each
   rebuilds it as <main> + one data commit), so they must share one concurrency
   group or an overlap drops the other's just-persisted run-metrics/delta files
   (the exact inputs anomaly-watch reads). */
const groupOf = (y) => (y.match(/concurrency:\s*\n\s*group:\s*([^\s#]+)/) || [])[1];
const gDaily = groupOf(wf('weekly-adverse-media.yml'));
const gOnb = groupOf(wf('onboarding-screen.yml'));
check('both screen-delta-state writers declare a concurrency group', Boolean(gDaily) && Boolean(gOnb));
check('the two state writers share ONE concurrency group (serialised force-pushes)',
  Boolean(gDaily) && gDaily === gOnb);

/* 1c. CLOSE THE LOOP — the escalation issue must clear itself when the anomaly
   is gone, and the link-check tracking issue when every link resolves; an
   alert that never clears trains people to ignore it. */
check('anomaly-watch has a clear path when escalate == false',
  anomaly.includes("escalate == 'false'"));
check('anomaly-watch closes the escalation issue on clear',
  anomaly.includes("state: 'closed'"));
const linkcheck = wf('link-check.yml');
check('link-check has a close-on-recovery path when has_dead == false',
  linkcheck.includes("has_dead == 'false'"));
check('link-check closes the tracking issue on recovery',
  linkcheck.includes("state: 'closed'"));

/* 2. Primary list host ⇒ its redirect/storage host, in every allowlist. */
const REDIRECT_PAIRS = [
  ['sanctionslistservice.ofac.treas.gov', 'wc2h-sls-prod-public-published.s3.us-gov-west-1.amazonaws.com:443'],
  ['scsanctions.un.org', 'unsolprodfiles.blob.core.windows.net:443'],
];
const workflows = readdirSync(join(ROOT, '.github/workflows')).filter((f) => /\.ya?ml$/.test(f)).sort();
let pairChecks = 0;
for (const f of workflows) {
  const y = wf(f);
  for (const [primary, storage] of REDIRECT_PAIRS) {
    // Key on the ALLOWLIST entry (host:443), not any mention — report prose and
    // comments cite these hosts without the job ever fetching them.
    if (!y.includes(`${primary}:443`)) continue;
    pairChecks++;
    check(`${f} allowlists ${primary}'s presigned storage host`, y.includes(storage));
  }
}
check('found workflows fetching OFAC/UN to verify', pairChecks >= 6);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
