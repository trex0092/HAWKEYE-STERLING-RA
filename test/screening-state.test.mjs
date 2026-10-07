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
  check(`${producer} persists state back to ${STATE_BRANCH} via the workflow-safe helper`,
    y.includes(`scripts/push-state-branch.sh ${STATE_BRANCH}`));
}

/* 1a. AMNESIA GUARD — `git fetch <branch>` exits 128 for BOTH "no such branch"
   and "could not reach origin", so `if git fetch ...; then overlay; else cold
   start; fi` reads a transient network flake as a first run: the job then
   diffs against main's frozen copy AND force-pushes <main> + one commit,
   permanently discarding every prior run's delivered-finding history (and the
   OTHER writer's, since both share this branch). `git ls-remote --exit-code`
   is the discriminator — 2 means the ref is genuinely absent, anything else is
   a transport error. anomaly-watch (a state READER) already guarded this; the
   two WRITERS did not. Every job that overlays the branch must.

   Asserted form-agnostically: anomaly-watch discriminates with `ls-remote
   --heads` + `||` on the exit status, the writers with `--exit-code` and rc==2.
   Both are correct. What must never come back is deciding "cold start" from a
   FETCH that failed. */
for (const consumer of ['weekly-adverse-media.yml', 'onboarding-screen.yml', 'anomaly-watch.yml']) {
  const y = wf(consumer);
  check(`${consumer} probes ${STATE_BRANCH} with ls-remote before deciding it is a cold start`,
    new RegExp(`git ls-remote[^\\n]*origin ${STATE_BRANCH}`).test(y));
  check(`${consumer} never branches on a bare fetch (exit 128 == missing branch == unreachable origin)`,
    !new RegExp(`if\\s+git fetch origin ${STATE_BRANCH}`).test(y));
  check(`${consumer} fails loud rather than falling back to stale state`,
    /::error::[^\n]*refusing to/.test(y));
  // set -e TRAP: GitHub runs `run:` blocks as `bash -e`, where a BARE failing
  // command aborts the step before `rc=$?` can be read — so `git ls-remote;
  // rc=$?` turns a legitimate cold start (rc=2) into a dead run. Capturing the
  // status needs a condition context (`&& rc=0 || rc=$?`, or `|| { ... }` as
  // anomaly-watch does). Any ls-remote whose status is read must use one.
  // Only lines that INVOKE it — prose comments and the ::error:: echo both
  // name the command without running it.
  const invocations = y.split('\n').filter((l) =>
    /git ls-remote/.test(l) && !/^\s*#/.test(l) && !/\becho\b/.test(l));
  check(`${consumer} actually invokes ls-remote (guard is not vacuous)`, invocations.length > 0);
  for (const line of invocations) {
    check(`${consumer}: ls-remote captures its status set -e-safely — ${line.trim().slice(0, 52)}`,
      /(\|\||&&|^\s*(if|while)\b|\$\()/.test(line));
  }
}

/* 1a-ii. The writers additionally gate the FORCE-PUSH on a successful overlay:
   the push rebuilds the branch as <main> + one commit, so persisting state
   built on a baseline the job never managed to read overwrites the history it
   failed to load. `if: always()` alone would still run that step. */
for (const producer of ['weekly-adverse-media.yml', 'onboarding-screen.yml']) {
  const y = wf(producer);
  check(`${producer} marks the overlay step with an id so the commit step can depend on it`,
    /id:\s*overlay/.test(y));
  check(`${producer} publishes state_ready only after the overlay establishes a baseline`,
    /echo "state_ready=1" >> "\$GITHUB_OUTPUT"/.test(y));
  check(`${producer} gates the force-push commit step on that overlay outcome`,
    /if:\s*always\(\) && steps\.overlay\.outputs\.state_ready == '1'/.test(y));
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

/* 3. WORKFLOW-SAFE STATE PUSH — a state branch rebuilt as <main> + one data
   commit and force-pushed carries every .github/workflows change made on main
   since the branch was last written, and GitHub refuses that push for the
   Actions token ("refusing to allow a GitHub App to create or update workflow
   ... without `workflows` permission"): Daily Screening run 36991549616 went
   red and did not persist its delta-state. No workflow may push HEAD to a
   state branch any more (the orphan, data-only screen-progress snapshot
   excepted), and the helper is exercised end-to-end against a real repo. */
const statePushOffenders = [];
for (const f of readdirSync(join(ROOT, '.github/workflows')).filter(n => n.endsWith('.yml'))) {
  const lines = readFileSync(join(ROOT, '.github/workflows', f), 'utf8').split('\n');
  lines.forEach((line, i) => {
    if (/HEAD:refs\/heads\//.test(line) && !/screen-progress/.test(line)) statePushOffenders.push(`${f}:${i + 1}`);
  });
}
check('no workflow force-pushes HEAD (<main> + data) to a state branch'
  + (statePushOffenders.length ? ' — ' + statePushOffenders.join(', ') : ''), statePushOffenders.length === 0);

{
  const { spawnSync } = await import('node:child_process');
  const { mkdtempSync, writeFileSync, mkdirSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const tmp = mkdtempSync(join(tmpdir(), 'state-push-'));
  const env = { ...process.env, GITHUB_TOKEN: 'x', GITHUB_REPOSITORY: 'o/r',
    STATE_PUSH_URL: join(tmp, 'origin.git'), GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@example.invalid',
    GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@example.invalid' };
  const work = join(tmp, 'work');
  const git = (...a) => spawnSync('git', a, { cwd: work, env, encoding: 'utf8' });
  const helper = (...a) => spawnSync('bash', [join(ROOT, 'scripts/push-state-branch.sh'), ...a], { cwd: work, env, encoding: 'utf8' });
  try {
    spawnSync('git', ['init', '-q', '--bare', join(tmp, 'origin.git')], { env });
    mkdirSync(join(work, '.github/workflows'), { recursive: true });
    mkdirSync(join(work, 'data'), { recursive: true });
    git('init', '-q', '-b', 'main');
    git('remote', 'add', 'origin', join(tmp, 'origin.git'));
    writeFileSync(join(work, '.github/workflows/w.yml'), 'v1\n');
    writeFileSync(join(work, 'data/state.json'), '{"n":1}\n');
    git('add', '-A'); git('commit', '-q', '-m', 'main v1'); git('push', '-q', 'origin', 'main');
    const first = helper('st', 'state 1 [skip ci]', 'data/state.json');
    check('state helper creates an absent state branch', first.status === 0
      && git('ls-remote', '--heads', 'origin', 'st').stdout.includes('refs/heads/st'));
    // main moves on: a workflow file changes, then the next state write happens
    writeFileSync(join(work, '.github/workflows/w.yml'), 'v2 (changed on main)\n');
    git('commit', '-qam', 'main v2'); git('push', '-q', 'origin', 'main');
    writeFileSync(join(work, 'data/state.json'), '{"n":2}\n');
    const second = helper('st', 'state 2 [skip ci]', 'data/state.json');
    git('fetch', '-q', 'origin', 'st');
    const diffTip = git('diff', '--name-only', 'FETCH_HEAD~1', 'FETCH_HEAD').stdout.trim();
    check('after a workflow change on main, the state push touches ONLY the data path', second.status === 0
      && diffTip === 'data/state.json');
    check('the state branch keeps its own workflow files (no workflow update is pushed)',
      git('show', 'FETCH_HEAD:.github/workflows/w.yml').stdout === 'v1\n'
      && git('show', 'FETCH_HEAD:data/state.json').stdout === '{"n":2}\n');
    const third = helper('st', 'state 3 [skip ci]', 'data/state.json');
    check('an unchanged state is a no-op, not an empty commit',
      third.status === 0 && /state unchanged/.test(third.stdout));
    const none = helper('st', 'x');
    check('the helper refuses to run with no paths', none.status !== 0);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
