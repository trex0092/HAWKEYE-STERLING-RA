import { decideUniqueDispatch, dispatchOnce } from '../../scripts/github-workflow-dispatch-guard.mjs';

export async function run(check) {
  const nowMs = Date.parse('2026-10-12T12:00:00Z');
  const path = '/actions/workflows/fixture.yml';
  const run = { id: 1, head_branch: 'main', event: 'workflow_dispatch',
    status: 'completed', created_at: '2026-10-11T12:00:00Z' };
  check('workflow dedup: unknown lifecycle states and malformed records never authorize a POST',
    decideUniqueDispatch([{ ...run, status: 'unrecognized' }], { nowMs }).action === 'unknown' &&
    decideUniqueDispatch([null], { nowMs }).action === 'unknown' &&
    decideUniqueDispatch([], null).action === 'unknown');
  let activePosts = 0, activeGets = 0;
  const hidden = await dispatchOnce(async (url, options) => {
    if (options?.method === 'POST') { activePosts++; return null; }
    activeGets++;
    const q = new URL('https://fixture.invalid' + url).searchParams;
    if (!q.has('status')) return { data: { workflow_runs: [run], total_count: 300 }, next: true };
    return { data: { workflow_runs: [{ ...run, status: 'queued' }] }, next: false };
  }, path, { nowMs });
  check('workflow dedup: a hidden previous-day active run on a paginated history is found before POST',
    hidden.action === 'skip' && activePosts === 0 && activeGets === 2);
  let reads = 0, posts = 0;
  const safe = await dispatchOnce(async (url, options) => {
    if (options?.method === 'POST') { posts++; return null; }
    reads++;
    const q = new URL('https://fixture.invalid' + url).searchParams;
    return q.has('status') || q.has('created')
      ? { data: { workflow_runs: [], total_count: 0 }, next: false }
      : { data: { workflow_runs: [run], total_count: 1000 }, next: true };
  }, path, { nowMs });
  check('workflow dedup: old completed history needs bounded active/window reads, not unlimited pagination',
    safe.action === 'dispatched' && reads === 7 && posts === 1);
  const truncated = await dispatchOnce(async () => ({ data: { workflow_runs: [], total_count: 101 }, next: true }),
    path, { nowMs });
  check('workflow dedup: incomplete active-bucket evidence fails closed', truncated.action === 'unknown');
  let release;
  let concurrentPosts = 0;
  const api = async (_url, options) => {
    if (options?.method === 'POST') { concurrentPosts++; return null; }
    return new Promise(resolve => { release = () => resolve({ data: { workflow_runs: [] } }); });
  };
  const first = dispatchOnce(api, path, { nowMs });
  const second = await dispatchOnce(api, path, { nowMs });
  release();
  const result = await first;
  check('workflow dedup: simultaneous checks coalesce into one local dispatch',
    result.action === 'dispatched' && second.action === 'skip' && concurrentPosts === 1);
  const replay = await dispatchOnce(api, path, { nowMs: nowMs + 1000 });
  check('workflow dedup: accepted requests are remembered during propagation delay',
    replay.action === 'skip' && concurrentPosts === 1);
  let ambiguousPosts = 0;
  const ambiguousApi = async (_url, options) => {
    if (options?.method === 'POST') { ambiguousPosts++; throw new Error('private transport data'); }
    return { data: { workflow_runs: [] } };
  };
  const uncertain = await dispatchOnce(ambiguousApi, path, { nowMs });
  const uncertainAgain = await dispatchOnce(ambiguousApi, path, { nowMs: nowMs + 1000 });
  check('workflow dedup: an ambiguous POST is not replayed while evidence propagation is unresolved',
    uncertain.action === 'unknown' && uncertainAgain.action === 'unknown' && ambiguousPosts === 1 &&
    !JSON.stringify(uncertain).includes('private'));
  await dispatchOnce(ambiguousApi, path, { nowMs: nowMs + 16 * 60000 });
  check('workflow dedup: expired local reservations require a fresh history read before a new attempt',
    ambiguousPosts === 2);
  let malformedCalls = 0;
  const malformed = await dispatchOnce(async () => { malformedCalls++; }, path, null);
  check('workflow dedup: malformed options cause no API traffic', malformed.action === 'unknown' && malformedCalls === 0);
}
