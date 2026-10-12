/* Just-in-time workflow dispatch deduplication with bounded evidence reads.
 * Process-local coalescing closes local races, not races across runners.
 * Keep workflow concurrency and run-level idempotence: GitHub offers no
 * workflow_dispatch idempotency key. Ambiguous POSTs are never replayed.
 */
import { URLSearchParams } from 'node:url';
const ACTIVE = new Set(['queued', 'pending', 'waiting', 'in_progress', 'requested']);
const EVENTS = new Set(['schedule', 'workflow_dispatch']);
const localDispatches = new WeakMap();
const object = value => !!value && typeof value === 'object' && !Array.isArray(value);

export function decideUniqueDispatch(runs, options = {}) {
  if (!object(options)) return { action: 'unknown', reason: 'invalid dispatch options' };
  const { branch = 'main', nowMs = Date.now(), sinceMs = nowMs - 3600000,
    quietMs = 15 * 60000 } = options;
  if (!Array.isArray(runs) || runs.length > 1000 || !Number.isFinite(nowMs) ||
      !Number.isFinite(sinceMs) || sinceMs > nowMs ||
      !Number.isSafeInteger(quietMs) || quietMs < 0 || quietMs > 3600000 ||
      runs.some(r => !object(r) || typeof r.head_branch !== 'string' || typeof r.event !== 'string')) {
    return { action: 'unknown', reason: 'run history or dispatch clock invalid' };
  }
  const relevant = runs.filter(r => r.head_branch === branch && EVENTS.has(r.event));
  for (const run of relevant) {
    const started = Date.parse(String(run.created_at || ''));
    if (!Number.isFinite(started) || started > nowMs + 300000 ||
        (!ACTIVE.has(run.status) && run.status !== 'completed')) {
      return { action: 'unknown', reason: 'run timestamp or lifecycle status unverified' };
    }
  }
  if (relevant.some(run => ACTIVE.has(run.status))) {
    return { action: 'skip', reason: 'workflow already has an active run' };
  }
  const scoped = relevant.filter(run => Date.parse(run.created_at) >= sinceMs);
  if (scoped.some(run => nowMs - Date.parse(run.created_at) < quietMs)) {
    return { action: 'skip', reason: 'workflow dispatched or scheduled within quiet window' };
  }
  return { action: 'dispatch', reason: 'no recent competing operational run' };
}

function pageState(observed) {
  const runs = observed?.data?.workflow_runs;
  if (!Array.isArray(runs) || runs.length > 100 ||
      (observed.next !== undefined && typeof observed.next !== 'boolean')) return null;
  const total = observed.data.total_count;
  if (total !== undefined && (!Number.isSafeInteger(total) || total < runs.length)) return null;
  return { runs, complete: observed.next !== true && (total === undefined || total <= runs.length) };
}

async function dispatchEvidence(api, path, options) {
  const { branch, nowMs, sinceMs, quietMs } = options;
  const query = new URLSearchParams({ branch, per_page: '100' });
  const first = pageState(await api(path + '/runs?' + query));
  if (!first) return { action: 'unknown', reason: 'recent run history unavailable' };
  const decision = decideUniqueDispatch(first.runs, options);
  // A visible active/recent run is enough to suppress duplicates even if the
  // history is incomplete. It is never enough to prove absence on later pages.
  if (decision.action !== 'dispatch' || first.complete) return decision;
  // Do not fetch years of completed history. Instead prove each ACTIVE bucket
  // is empty and inspect the bounded quiet window. At most six extra GETs.
  // https://docs.github.com/en/rest/actions/workflow-runs
  for (const status of ACTIVE) {
    const active = pageState(await api(path + '/runs?' + new URLSearchParams({ branch, status, per_page: '100' })));
    if (!active) return { action: 'unknown', reason: 'active run history unavailable' };
    const action = decideUniqueDispatch(active.runs, options);
    if (action.action !== 'dispatch') return action;
    if (!active.complete) return { action: 'unknown', reason: 'active run history truncated; no blind dispatch' };
  }
  if (quietMs === 0) return decision;
  const start = Math.max(sinceMs, nowMs - quietMs);
  if (!Number.isFinite(new Date(start).getTime())) return { action: 'unknown', reason: 'invalid dispatch window' };
  const recent = pageState(await api(path + '/runs?' + new URLSearchParams({
    branch, created: '>=' + new Date(start).toISOString(), per_page: '100'
  })));
  if (!recent) return { action: 'unknown', reason: 'quiet-window history unavailable' };
  const action = decideUniqueDispatch(recent.runs, options);
  if (action.action !== 'dispatch') return action;
  return recent.complete ? action : { action: 'unknown', reason: 'quiet-window history truncated; no blind dispatch' };
}

export async function dispatchOnce(api, path, options = {}) {
  if (!object(options)) return { action: 'unknown', reason: 'invalid dispatch options' };
  const { branch = 'main', nowMs = Date.now(), sinceMs = nowMs - 3600000,
    quietMs = 15 * 60000 } = options;
  if (typeof api !== 'function' || typeof path !== 'string' ||
      !/^\/actions\/workflows\/[A-Za-z0-9_][A-Za-z0-9_.-]*$/.test(path) ||
      typeof branch !== 'string' || !/^[A-Za-z0-9._/-]{1,120}$/.test(branch)) {
    return { action: 'unknown', reason: 'workflow dispatch request invalid' };
  }
  const settings = { branch, nowMs, sinceMs, quietMs };
  const valid = decideUniqueDispatch([], settings);
  if (valid.action !== 'dispatch') return valid;
  let entries = localDispatches.get(api);
  if (!entries) { entries = new Map(); localDispatches.set(api, entries); }
  for (const [key, value] of entries) if (!value.pending && nowMs >= value.until) entries.delete(key);
  const key = JSON.stringify([path, branch]);
  const previous = entries.get(key);
  if (previous) {
    return { action: previous.pending || previous.outcome === 'dispatched' ? 'skip' : 'unknown',
      reason: previous.pending ? 'same-process dispatch check already in progress' :
        'recent local dispatch attempt retained; no replay before quiet window' };
  }
  if (entries.size >= 64) return { action: 'unknown', reason: 'local dispatch tracking budget exhausted' };
  const entry = { pending: true, until: nowMs + Math.max(1000, quietMs), outcome: 'unknown' };
  entries.set(key, entry);
  let attempted = false;
  try {
    const decision = await dispatchEvidence(api, path, settings);
    if (decision.action !== 'dispatch') return decision;
    attempted = true;
    await api(path + '/dispatches', { method: 'POST', body: { ref: branch } });
    entry.outcome = 'dispatched';
    return { action: 'dispatched', reason: 'GitHub accepted dispatch; delivery not verified' };
  } catch {
    return { action: 'unknown', reason: attempted
      ? 'dispatch outcome unverified; no blind replay' : 'run evidence unavailable; no blind dispatch' };
  } finally {
    entry.pending = false;
    if (!attempted) entries.delete(key);
  }
}
