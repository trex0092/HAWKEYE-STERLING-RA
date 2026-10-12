/* Just-in-time deduplication of workflow_dispatch requests.
 *
 * GitHub workflow_dispatch has no server-side idempotency key. A POST that
 * times out may already have been accepted. This guard re-reads recent run
 * history immediately before the POST; ambiguous history or POST outcome
 * FAILS CLOSED rather than issuing a blind retry. A very short propagation
 * race between GitHub readers/writers still requires workflow concurrency
 * groups, run-level idempotence and human incident review.
 */
const ACTIVE = new Set(['queued', 'pending', 'waiting', 'in_progress', 'requested']);
const EVENTS = new Set(['schedule', 'workflow_dispatch']);

export function decideUniqueDispatch(runs, {
  branch = 'main', nowMs = Date.now(), sinceMs = nowMs - 3600000,
  quietMs = 15 * 60000
} = {}) {
  if (!Array.isArray(runs) || !Number.isFinite(nowMs) ||
      !Number.isFinite(sinceMs) || sinceMs > nowMs ||
      !Number.isSafeInteger(quietMs) || quietMs < 0 || quietMs > 3600000) {
    return { action: 'unknown', reason: 'run history or dispatch clock invalid' };
  }
  const relevant = runs.filter(r => r && r.head_branch === branch && EVENTS.has(r.event));
  for (const run of relevant) {
    const started = Date.parse(String(run.created_at || ''));
    if (!Number.isFinite(started) || started > nowMs + 300000) {
      return { action: 'unknown', reason: 'run start time missing or future-dated' };
    }
  }
  const scoped = relevant.filter(run => Date.parse(run.created_at) >= sinceMs);
  if (scoped.some(run => ACTIVE.has(run.status))) {
    return { action: 'skip', reason: 'workflow has a recent active run' };
  }
  if (scoped.some(run => nowMs - Date.parse(run.created_at) < quietMs)) {
    return { action: 'skip', reason: 'workflow dispatched or scheduled within quiet window' };
  }
  return { action: 'dispatch', reason: 'no recent competing operational run' };
}

export async function dispatchOnce(api, path, {
  branch = 'main', nowMs = Date.now(),
  sinceMs = nowMs - 3600000, quietMs = 15 * 60000
} = {}) {
  if (typeof api !== 'function' ||
      !/^\/actions\/workflows\/[A-Za-z0-9_.-]+$/.test(path) ||
      !/^[A-Za-z0-9._/-]{1,120}$/.test(branch)) {
    return { action: 'unknown', reason: 'workflow dispatch request invalid' };
  }
  let observed;
  try {
    // Only the latest page is needed for a recent-run deduplication decision.
    // Any missing/unusable page fails closed. Avoid more costly pagination.
    observed = await api(path + '/runs?branch=' + encodeURIComponent(branch) + '&per_page=100');
  } catch { return { action: 'unknown', reason: 'recent run history unavailable' }; }
  if (!Array.isArray(observed?.data?.workflow_runs)) {
    return { action: 'unknown', reason: 'recent run history unavailable' };
  }
  const decision = decideUniqueDispatch(observed.data.workflow_runs,
    { branch, nowMs, sinceMs, quietMs });
  if (decision.action !== 'dispatch') return decision;
  try {
    await api(path + '/dispatches', { method: 'POST', body: { ref: branch } });
    return { action: 'dispatched', reason: 'GitHub accepted dispatch; delivery not verified' };
  } catch {
    // A transport error after POST does not prove the job was not created.
    return { action: 'unknown', reason: 'dispatch outcome unverified; no blind replay' };
  }
}
