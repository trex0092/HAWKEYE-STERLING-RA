import { parseGitHubRateSnapshot, applyGitHubRateHeaders, fetchGitHubRateSnapshot,
  renderGitHubRateDashboard } from '../../scripts/github-rate-dashboard.mjs';

export async function run(check) {
  const observedAt = '2026-10-12T12:00:00Z';
  const reset = Date.parse('2026-10-12T13:00:00Z') / 1000;
  const payload = { resources: { core: { limit: 5000, remaining: 4900, used: 100, reset },
    graphql: { limit: 5000, remaining: 5000, reset } } };
  const get = values => ({ get: key => values[key] ?? null });
  const headers = get({ 'x-ratelimit-resource': 'core', 'x-ratelimit-limit': '5000',
    'x-ratelimit-remaining': '0', 'x-ratelimit-reset': String(reset) });
  const original = parseGitHubRateSnapshot(payload, { observedAt });
  const current = applyGitHubRateHeaders(original, headers);
  check('GitHub quota: authoritative exhausted headers override a healthy-looking body',
    current.ok && current.header_override === 'core' && current.rows[0].state === 'exhausted' &&
    original.rows[0].remaining === 4900 && current.rows[1].remaining === 5000);
  check('GitHub quota: incomplete or invalid authoritative headers never fall back silently',
    !applyGitHubRateHeaders(original, get({ 'x-ratelimit-resource': 'core' })).ok &&
    !applyGitHubRateHeaders(original, get({ 'x-ratelimit-resource': 'core',
      'x-ratelimit-limit': '10', 'x-ratelimit-remaining': '99', 'x-ratelimit-reset': String(reset) })).ok);
  check('GitHub quota: low threshold is exact, not an artifact of percentage rounding',
    parseGitHubRateSnapshot({ resources: { core: { limit: 1000, remaining: 104, reset } } },
      { observedAt }).rows[0].state === 'normal' &&
    parseGitHubRateSnapshot({ resources: { core: { limit: 1000, remaining: 100, reset } } },
      { observedAt }).rows[0].state === 'low');
  let calls = 0, requestOptions;
  const fetched = await fetchGitHubRateSnapshot({ token: 'synthetic-token', observedAt,
    fetchImpl: async (_url, options) => {
      calls++; requestOptions = options; return { ok: true, headers, json: async () => payload };
    } });
  check('GitHub quota: one fixed read-only request carries an abort signal and denies redirects',
    calls === 1 && fetched.ok && fetched.rows[0].remaining === 0 &&
    requestOptions.signal instanceof AbortSignal && requestOptions.redirect === 'error');
  let reads = 0;
  const denied = await fetchGitHubRateSnapshot({ token: 'synthetic-token', observedAt,
    fetchImpl: async () => ({ ok: false, status: 429, json: async () => { reads++; return { secret: 'PRIVATE' }; } }) });
  check('GitHub quota: denied requests are not retried and their bodies are not exposed',
    !denied.ok && reads === 0 && !renderGitHubRateDashboard(denied).includes('PRIVATE'));
  let signal;
  const hung = await fetchGitHubRateSnapshot({ token: 'synthetic-token', observedAt, timeoutMs: 10,
    fetchImpl: async (_url, options) => { signal = options.signal; return new Promise(() => {}); } });
  check('GitHub quota: a transport ignoring abort still cannot hang past the local deadline',
    hung.reason === 'github_rate_request_timed_out' && signal.aborted);
  const bodyHang = await fetchGitHubRateSnapshot({ token: 'synthetic-token', observedAt, timeoutMs: 10,
    fetchImpl: async () => ({ ok: true, json: () => new Promise(() => {}) }) });
  check('GitHub quota: the deadline also bounds body decoding', bodyHang.reason === 'github_rate_request_timed_out');
}
