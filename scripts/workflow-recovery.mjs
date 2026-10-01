/* Bounded recovery of operational controls. A dispatch is not proof of health.
 * Only approved controls can be started; publishing/release jobs are excluded.
 * Run --self-test offline. Run with GITHUB_TOKEN in the recovery workflow.
 */
import { appendFileSync } from 'node:fs';
import { pathToFileURL, URL, URLSearchParams } from 'node:url';
import assert from 'node:assert/strict';

const ACTIVE = new Set(['queued', 'in_progress', 'requested', 'waiting', 'pending']);
const EVENTS = new Set(['schedule', 'workflow_dispatch']);
const DAY = 86400000;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const runTime = r => Date.parse(r.run_started_at || r.created_at || '');
const dayStart = ms => Math.floor(ms / DAY) * DAY;

export const HELPERS = [
  { id: 'sanctions-runtime-assurance.yml', name: 'Sanctions runtime evidence', maxAgeDays: 0, allowPush: true },
  { id: 'delivery-watchdog.yml', name: 'Asana delivery verification', maxAgeDays: 0 },
  { id: 'site-currency.yml', name: 'Production currency verification', maxAgeDays: 0 },
  { id: 'site-health.yml', name: 'Site health verification', maxAgeDays: 0 },
  { id: 'function-health.yml', name: 'Function health verification', maxAgeDays: 0 },
];

export function staleSupersededRun(control, activeRuns, {
  nowMs = Date.now(), currentSha = '', minAgeMs = 30 * 60 * 1000,
} = {}) {
  if (control?.id !== 'sanctions-screen.yml' || !Array.isArray(activeRuns)
      || !currentSha || !Number.isFinite(nowMs)) return null;
  return activeRuns
    .filter(run => run && ACTIVE.has(run.status)
      && typeof run.head_sha === 'string' && run.head_sha
      && run.head_sha !== currentSha
      && Number.isFinite(runTime(run))
      && nowMs - runTime(run) >= minAgeMs)
    .sort((x, y) => runTime(x) - runTime(y))[0] || null;
}

export function decide(control, runs, { nowMs = Date.now(), branch = 'main', activeRuns = [] } = {}) {
  if (!Array.isArray(runs) || !Array.isArray(activeRuns) || !Number.isFinite(nowMs)) {
    return { action: 'unknown', reason: 'invalid run history or clock' };
  }
  const relevant = r => r && r.head_branch === branch
    && (EVENTS.has(r.event) || (control.allowPush && r.event === 'push'));
  const scoped = runs.filter(relevant);
  const active = [...scoped, ...activeRuns.filter(relevant)].find(r => ACTIVE.has(r.status));
  if (active) return { action: 'wait', reason: `run ${active.id} is ${active.status}; not verified operational` };
  if (scoped.some(r => !Number.isFinite(runTime(r)) || runTime(r) > nowMs + 300000)) {
    return { action: 'unknown', reason: 'invalid or future-dated operational run' };
  }
  const finished = scoped.filter(r => r.status === 'completed' && r.conclusion !== 'skipped')
    .sort((a, b) => runTime(b) - runTime(a));
  const cutoff = dayStart(nowMs) - (control.maxAgeDays || 0) * DAY;
  const success = finished.find(r => r.conclusion === 'success' && runTime(r) >= cutoff);
  const latest = finished[0];
  if (success && latest?.conclusion === 'success') {
    return { action: 'healthy', reason: `operational run ${success.id} succeeded inside its cadence window` };
  }
  // Includes schedules/manual attempts, preventing an API/billing failure storm.
  const attempts = scoped.filter(r => runTime(r) >= dayStart(nowMs));
  const limit = control.maxAgeDays > 0 ? 1 : 3;
  if (attempts.length >= limit) {
    return { action: 'blocked', reason: `${attempts.length} attempts today; limit ${limit}, unresolved failure requires review` };
  }
  const last = scoped.sort((a, b) => runTime(b) - runTime(a))[0];
  if (last && nowMs - runTime(last) < 3600000) {
    return { action: 'cooldown', reason: 'last operational attempt was less than one hour ago' };
  }
  return { action: 'dispatch', reason: latest && latest.conclusion !== 'success'
    ? `latest operational run ${latest.id} concluded ${latest.conclusion}`
    : 'no successful operational run inside its cadence window' };
}

export function makeApi({ repo, token, fetchImpl = fetch, wait = sleep }) {
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo || '') || !token) {
    throw new Error('GITHUB_REPOSITORY and GITHUB_TOKEN are required');
  }
  return async (path, { method = 'GET', body } = {}) => {
    if (!path.startsWith('/actions/')) throw new Error('refusing non-Actions API path');
    const url = `https://api.github.com/repos/${repo}${path}`;
    for (let attempt = 0; attempt < 3; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);
      try {
        let res;
        try {
          res = await fetchImpl(url, {
            method,
            headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json',
              'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json' },
            signal: controller.signal,
            ...(body === undefined ? {} : { body: JSON.stringify(body) }),
          });
        } catch {
          if (method !== 'GET' || attempt === 2) throw new Error(`${method} transport failure; outcome unverified`);
          await wait(1000 * 2 ** attempt);
          continue;
        }
        if (method === 'GET' && (res.status === 429 || res.status >= 500) && attempt < 2) {
          const retry = Number(res.headers?.get('retry-after'));
          await wait(Math.min(30000, Math.max(1000 * 2 ** attempt, Number.isFinite(retry) ? retry * 1000 : 0)));
          continue;
        }
        if (!res.ok) throw new Error(`${method} ${path.split('?')[0]} returned HTTP ${res.status}`);
        if (method === 'POST') {
          if (res.status !== 202 && res.status !== 204) {
            throw new Error(`${path.endsWith('/cancel') ? 'cancel' : 'dispatch'} returned unexpected HTTP ${res.status}`);
          }
          return null;
        }
        let data;
        try { data = await res.json(); } catch { throw new Error('GitHub returned invalid JSON'); }
        return { data, next: /rel="next"/.test(res.headers?.get('link') || '') };
      } finally {
        clearTimeout(timer);
      }
    }
    throw new Error('GitHub request exhausted retry budget');
  };
}

/* MORNING DISPATCH — the on-time start for the daily screening, so its results
 * are in Asana before 09:00 UAE (05:00 UTC). GitHub starts this repo's
 * scheduled runs 4-6h late (sanctions-screen's 05:37 slot started 09:41-11:57
 * UTC, 19-30 Sep 2026) and drops most firings of a frequent cron, but a
 * workflow_dispatch starts at once. screening-morning-dispatch.yml is
 * therefore scheduled several times in the UTC evening: whichever firing
 * GitHub delivers first waits on the runner until 00:05 UTC, then dispatches
 * both screens; later firings find today's runs and exit. 00:05 is the
 * earliest SAME-UTC-day start (freshness-check counts runs per UTC day). An
 * accepted dispatch is NOT proof of delivery -- each control's own evidence,
 * Delivery Watchdog and Control Retry still judge that. */
export const MORNING_CONTROLS = ['sanctions-screen.yml', 'weekly-adverse-media.yml'];
export const MORNING_DISPATCH_UTC_MIN = 5;
export const MORNING_MAX_WAIT_MS = 330 * 60000; // inside the job's 350-minute timeout

export function morningPlan(nowMs, { atMin = MORNING_DISPATCH_UTC_MIN } = {}) {
  if (!Number.isFinite(nowMs)) throw new Error('invalid clock');
  const today = dayStart(nowMs);
  // Evening firings (>= 12:00 UTC) prepare the NEXT UTC day; a firing delayed
  // past midnight serves the day it lands in.
  const targetDayMs = new Date(nowMs).getUTCHours() >= 12 ? today + DAY : today;
  const dispatchAtMs = targetDayMs + atMin * 60000;
  return { targetDay: new Date(targetDayMs).toISOString().slice(0, 10), targetDayMs,
    dispatchAtMs, waitMs: Math.max(0, dispatchAtMs - nowMs) };
}

export function morningDecision(runs, targetDayMs, branch = 'main') {
  if (!Array.isArray(runs) || !Number.isFinite(targetDayMs)) {
    return { action: 'unknown', reason: 'invalid run history or target day' };
  }
  const started = runs.find(r => r && r.head_branch === branch && EVENTS.has(r.event)
    && Number.isFinite(runTime(r)) && runTime(r) >= targetDayMs);
  if (started) {
    return { action: 'skip', reason: `run ${started.id} (${started.event}, ${started.status}) already started on the target UTC day` };
  }
  // A run still active from the PREVIOUS day does not cover today: dispatching
  // queues behind it (cancel-in-progress is false), never in parallel.
  return { action: 'dispatch', reason: 'no run has started on the target UTC day' };
}

async function morning() {
  const api = makeApi({ repo: process.env.GITHUB_REPOSITORY, token: process.env.GITHUB_TOKEN || process.env.GH_TOKEN });
  const plan = morningPlan(Date.now());
  const rows = [];
  if (plan.waitMs > MORNING_MAX_WAIT_MS) {
    rows.push({ id: 'all', action: 'deferred', reason: `fired ${Math.round(plan.waitMs / 60000)} min before the ${plan.targetDay} 00:05 UTC dispatch — longer than one job may wait; a later scheduled firing dispatches` });
  } else {
    console.log(`morning-dispatch: target ${plan.targetDay} 00:05 UTC; waiting ${Math.round(plan.waitMs / 60000)} min`);
    for (let left = plan.waitMs; left > 0; left = plan.dispatchAtMs - Date.now()) {
      await sleep(Math.min(left, 10 * 60000));
      console.log(`morning-dispatch: ${Math.max(0, Math.round((plan.dispatchAtMs - Date.now()) / 60000))} min to dispatch`);
    }
    for (const id of MORNING_CONTROLS) {
      try {
        const path = `/actions/workflows/${encodeURIComponent(id)}`;
        const { data: workflow } = await api(path);
        if (workflow.state !== 'active') throw new Error(`workflow is ${workflow.state || 'unknown'}, not auto-enabling it`);
        const runs = await readRuns(api, path + '/runs', { branch: 'main', created: '>=' + plan.targetDay });
        const decision = morningDecision(runs, plan.targetDayMs);
        if (decision.action === 'dispatch') {
          await api(path + '/dispatches', { method: 'POST', body: { ref: 'main' } });
          decision.action = 'dispatched';
          decision.reason += '; request accepted, delivery NOT yet verified';
        }
        rows.push({ id, ...decision });
      } catch (err) {
        rows.push({ id, action: 'unknown', reason: String(err.message) });
      }
    }
  }
  const cell = value => String(value).replaceAll('|', '/').replace(/[\r\n]/g, ' ');
  const report = ['# Morning screening dispatch', '',
    'An accepted dispatch is not delivery evidence; Delivery Watchdog and each control judge that.', '',
    '| Workflow | State | Detail |', '| --- | --- | --- |',
    ...rows.map(r => `| ${cell(r.id)} | ${cell(r.action)} | ${cell(r.reason)} |`), ''].join('\n');
  console.log(report);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, report);
  if (rows.some(r => r.action === 'unknown')) process.exitCode = 1;
}

export async function readRuns(api, path, filters, maxPages = 5) {
  const runs = [];
  for (let page = 1; page <= maxPages; page++) {
    const query = new URLSearchParams({ ...filters, per_page: '100', page: String(page) });
    const { data, next } = await api(path + '?' + query);
    if (!Array.isArray(data?.workflow_runs)) throw new Error('GitHub run history is missing workflow_runs');
    runs.push(...data.workflow_runs);
    if (!next) return runs;
  }
  throw new Error('run history exceeds pagination budget; refusing a blind retry');
}

async function main() {
  // Import only here so offline self-tests do not depend on the checkout tree.
  const { CONTROLS } = await import('./freshness-check.mjs');
  const api = makeApi({ repo: process.env.GITHUB_REPOSITORY, token: process.env.GITHUB_TOKEN || process.env.GH_TOKEN });
  const branch = 'main';
  const controls = [...CONTROLS, ...HELPERS].filter((c, i, a) => a.findIndex(x => x.id === c.id) === i);
  // No date filter: yesterday's queued/long-running work must not be duplicated.
  const activeRuns = [];
  for (const status of ACTIVE) activeRuns.push(...await readRuns(api, '/actions/runs', { branch, status }));
  const rows = [];
  let dispatched = false;
  for (const control of controls) {
    try {
      const path = `/actions/workflows/${encodeURIComponent(control.id)}`;
      const { data: workflow } = await api(path);
      if (workflow.state !== 'active') throw new Error(`workflow is ${workflow.state || 'unknown'}, not auto-enabling it`);
      const runs = [];
      // The newest successes and operational attempts are sufficient for cadence
      // decisions; server-side event filtering excludes code-validation noise.
      for (const event of [...EVENTS, ...(control.allowPush ? ['push'] : [])]) {
        const { data } = await api(path + '/runs?' + new URLSearchParams({ branch, event, per_page: '100' }));
        if (!Array.isArray(data?.workflow_runs)) throw new Error('GitHub run history is missing workflow_runs');
        runs.push(...data.workflow_runs);
      }
      const controlActive = activeRuns.filter(r => r.path === `.github/workflows/${control.id}`);
      const stale = staleSupersededRun(control, controlActive, {
        currentSha: process.env.GITHUB_SHA || '',
      });
      if (stale) {
        await api(`/actions/runs/${stale.id}/cancel`, { method: 'POST' });
        const decision = { action: 'dispatch',
          reason: `cancelled stale pre-fix run ${stale.id} at ${stale.head_sha}; current main is ${process.env.GITHUB_SHA}` };
        await api(path + '/dispatches', { method: 'POST', body: { ref: branch } });
        decision.action = 'dispatched';
        decision.reason += '; fresh current-main run requested, successful completion NOT yet verified';
        rows.push({ id: control.id, ...decision });
        dispatched = true;
        continue;
      }
      const decision = decide(control, runs, { branch, activeRuns: controlActive });
      if (decision.action === 'dispatch') {
        await api(path + '/dispatches', { method: 'POST', body: { ref: branch } });
        decision.action = 'dispatched';
        decision.reason += '; request accepted, successful completion NOT yet verified';
        dispatched = true;
      }
      rows.push({ id: control.id, ...decision });
    } catch (err) {
      rows.push({ id: control.id, action: 'unknown', reason: String(err.message) });
    }
  }
  // Re-check the actual estate after new evidence lands. This check does not
  // convert accepted dispatches to green; it independently fails if still stale.
  if (!dispatched && !activeRuns.some(r => r.path === '.github/workflows/freshness-check.yml')) {
    try { await api('/actions/workflows/freshness-check.yml/dispatches', { method: 'POST', body: { ref: branch } }); }
    catch (err) { rows.push({ id: 'freshness-check.yml', action: 'unknown', reason: String(err.message) }); }
  }
  const cell = value => String(value).replaceAll('|', '/').replace(/[\r\n]/g, ' ');
  const report = ['# Operational control recovery', '',
    'A successful dispatcher is not an operational attestation. Only each control can supply its evidence.', '',
    '| Workflow | Recovery state | Evidence / next action |', '| --- | --- | --- |',
    ...rows.map(r => `| ${cell(r.id)} | ${cell(r.action)} | ${cell(r.reason)} |`), ''].join('\n');
  console.log(report);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, report);
  if (rows.some(r => ['unknown', 'blocked'].includes(r.action))) process.exitCode = 1;
}

export async function selfTest() {
  const nowMs = Date.parse('2026-09-29T12:00:00Z');
  const c = { id: 'example.yml', maxAgeDays: 0 };
  const r = (patch = {}) => ({ id: 1, event: 'schedule', head_branch: 'main', status: 'completed',
    conclusion: 'success', created_at: '2026-09-29T06:00:00Z', ...patch });
  const action = (runs, control = c, extra = {}) => decide(control, runs, { nowMs, ...extra }).action;
  assert.equal(action([r()]), 'healthy');
  assert.equal(action([r({ event: 'push' })]), 'dispatch');
  assert.equal(action([r({ head_branch: 'untrusted' })]), 'dispatch');
  assert.equal(action([r({ conclusion: 'skipped' })]), 'dispatch');
  assert.equal(action([r({ created_at: '2026-09-28T23:00:00Z', status: 'in_progress', conclusion: null })]), 'wait');
  assert.equal(action([], c, { activeRuns: [r({ status: 'pending', conclusion: null })] }), 'wait');
  assert.equal(action([r({ created_at: 'invalid' })]), 'unknown');
  assert.equal(action([r({ created_at: '2026-10-01T00:00:00Z' })]), 'unknown');
  assert.equal(action([r(), r({ id: 2, conclusion: 'failure', created_at: '2026-09-29T08:00:00Z' })]), 'dispatch');
  assert.equal(action([r({ conclusion: 'failure' }), r({ id: 2, created_at: '2026-09-29T08:00:00Z' })]), 'healthy');
  assert.equal(action([r({ conclusion: 'failure', created_at: '2026-09-29T11:30:00Z' })]), 'cooldown');
  assert.equal(action([r({ conclusion: 'failure' }), r({ conclusion: 'timed_out' }), r({ conclusion: 'cancelled' })]), 'blocked');
  assert.equal(action([r({ created_at: '2026-09-20T00:00:00Z' })], { ...c, maxAgeDays: 8 }), 'dispatch');
  assert.equal(action([r({ created_at: '2026-09-23T00:00:00Z' })], { ...c, maxAgeDays: 8 }), 'healthy');
  assert.equal(action([r({ conclusion: 'failure' })], { ...c, maxAgeDays: 8 }), 'blocked');
  assert.equal(action([r({ event: 'push' })], { ...c, allowPush: true }), 'healthy');
  const stale = staleSupersededRun({ id: 'sanctions-screen.yml' }, [
    r({ status: 'in_progress', conclusion: null, head_sha: 'old', created_at: '2026-09-29T10:00:00Z' }),
  ], { nowMs, currentSha: 'new' });
  assert.equal(stale?.head_sha, 'old');
  assert.equal(staleSupersededRun({ id: 'weekly-adverse-media.yml' }, [stale],
    { nowMs, currentSha: 'new' }), null);
  assert.equal(staleSupersededRun({ id: 'sanctions-screen.yml' }, [
    r({ status: 'in_progress', conclusion: null, head_sha: 'new', created_at: '2026-09-29T10:00:00Z' }),
  ], { nowMs, currentSha: 'new' }), null);
  let calls = 0;
  const response = (status, data = {}) => ({ status, ok: status >= 200 && status < 300,
    headers: { get: () => null }, json: async () => data });
  const api = makeApi({ repo: 'owner/repo', token: 'fixture', wait: async () => {},
    fetchImpl: async () => response(++calls < 3 ? 503 : 200) });
  await api('/actions/runs');
  assert.equal(calls, 3);
  calls = 0;
  const post = makeApi({ repo: 'owner/repo', token: 'fixture', wait: async () => {},
    fetchImpl: async () => { calls++; return response(503); } });
  await assert.rejects(post('/actions/workflows/example.yml/dispatches', { method: 'POST', body: { ref: 'main' } }));
  assert.equal(calls, 1, 'never blindly replay a possibly accepted POST');
  await assert.rejects(readRuns(async () => ({ data: {}, next: false }), '/actions/runs', {}));
  await assert.rejects(readRuns(async () => ({ data: { workflow_runs: [] }, next: true }), '/actions/runs', {}, 2));
  const pages = await readRuns(async path => ({ data: { workflow_runs: [r()] }, next: new URL('https://example.test' + path).searchParams.get('page') === '1' }), '/actions/runs', {});
  assert.equal(pages.length, 2);
  // Morning dispatch: evening firings target the next UTC day's 00:05.
  const evening = morningPlan(Date.parse('2026-10-01T21:30:00Z'));
  assert.equal(evening.targetDay, '2026-10-02');
  assert.equal(evening.waitMs, (2 * 60 + 35) * 60000);
  const late = morningPlan(Date.parse('2026-10-02T01:40:00Z'));
  assert.equal(late.targetDay, '2026-10-02');
  assert.equal(late.waitMs, 0, 'a firing delayed past 00:05 dispatches at once');
  assert.ok(morningPlan(Date.parse('2026-10-01T19:07:00Z')).waitMs <= MORNING_MAX_WAIT_MS,
    'the earliest scheduled slot, if delivered on time, fits inside one job');
  assert.ok(morningPlan(Date.parse('2026-10-01T13:00:00Z')).waitMs > MORNING_MAX_WAIT_MS);
  const target = Date.parse('2026-10-02T00:00:00Z');
  assert.equal(morningDecision([], target).action, 'dispatch');
  assert.equal(morningDecision([r({ created_at: '2026-10-02T00:05:30Z', status: 'in_progress', conclusion: null })], target).action, 'skip');
  assert.equal(morningDecision([r({ created_at: '2026-10-02T03:00:00Z', conclusion: 'failure' })], target).action, 'skip',
    'a failed run today is Control Retry\'s to heal, never a second morning dispatch');
  assert.equal(morningDecision([r({ created_at: '2026-10-01T22:00:00Z', status: 'in_progress', conclusion: null })], target).action, 'dispatch',
    'yesterday\'s still-running screen does not cover today');
  assert.equal(morningDecision([r({ created_at: '2026-10-02T01:00:00Z', head_branch: 'feature' })], target).action, 'dispatch');
  assert.equal(morningDecision([r({ created_at: '2026-10-02T01:00:00Z', event: 'push' })], target).action, 'dispatch');
  assert.equal(morningDecision(null, target).action, 'unknown');
  assert.deepEqual(MORNING_CONTROLS, ['sanctions-screen.yml', 'weekly-adverse-media.yml']);
  console.log('workflow-recovery: 39 offline regression checks passed');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  (process.argv.includes('--self-test') ? selfTest()
    : process.argv.includes('--morning') ? morning() : main()).catch(err => {
    console.error('workflow-recovery: ' + err.message);
    process.exitCode = 1;
  });
}
