/* Read-only GitHub API quota observations, never Actions billing amounts.
 * No retries on denied/limited requests, no credential or error-body logging.
 * Response headers override the matching /rate_limit bucket when both exist.
 * https://docs.github.com/en/rest/rate-limit/rate-limit
 */
import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
const NAME = /^[a-z][a-z0-9_]{0,48}$/;
function safeNumber(x) {
  return Number.isSafeInteger(x) && x >= 0 ? x : null;
}
function rowFor(name, item) {
  if (!NAME.test(name) || !item || typeof item !== 'object' || Array.isArray(item)) return null;
  const limit = safeNumber(item.limit), remaining = safeNumber(item.remaining);
  const resetEpoch = safeNumber(item.reset);
  const used = item.used === undefined ? null : safeNumber(item.used);
  if (limit === null || remaining === null || remaining > limit || resetEpoch === null ||
      resetEpoch > 4102444800 || (item.used !== undefined && used === null)) return null;
  const remainingPct = limit === 0 ? null : Math.round(100 * remaining / limit);
  return { resource: name, limit, remaining, used,
    reset_utc: new Date(resetEpoch * 1000).toISOString(), remaining_pct: remainingPct,
    state: limit === 0 ? 'unavailable' : remaining === 0 ? 'exhausted' :
      BigInt(remaining) * 10n <= BigInt(limit) ? 'low' : 'normal' };
}
export function parseGitHubRateSnapshot(payload, { observedAt = new Date().toISOString() } = {}) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload) ||
      !payload.resources || typeof payload.resources !== 'object' || Array.isArray(payload.resources) ||
      typeof observedAt !== 'string' || !Number.isFinite(Date.parse(observedAt))) {
    return { ok: false, reason: 'rate_snapshot_missing_or_invalid' };
  }
  const resources = Object.entries(payload.resources);
  if (resources.length === 0 || resources.length > 60) return { ok: false, reason: 'rate_snapshot_missing_or_invalid' };
  const rows = resources.map(([name, item]) => rowFor(name, item));
  if (rows.some(row => row === null)) return { ok: false, reason: 'rate_resource_invalid' };
  if (!rows.some(x => x.resource === 'core')) return { ok: false, reason: 'core_rate_resource_missing' };
  rows.sort((a, b) => a.resource.localeCompare(b.resource));
  return { ok: true, observed_at: new Date(observedAt).toISOString(), rows };
}
export function applyGitHubRateHeaders(snapshot, headers) {
  if (!snapshot?.ok || !headers || typeof headers.get !== 'function') return snapshot;
  const get = name => { try { return headers.get(name); } catch { return null; } };
  const resource = get('x-ratelimit-resource');
  const raw = ['limit', 'remaining', 'reset'].map(key => get('x-ratelimit-' + key));
  if (resource == null && raw.every(value => value == null)) return snapshot;
  if (typeof resource !== 'string' || !NAME.test(resource) ||
      raw.some(value => typeof value !== 'string' || !/^\d{1,12}$/.test(value))) {
    return { ok: false, reason: 'rate_headers_invalid' };
  }
  const [limit, remaining, reset] = raw.map(Number);
  const row = rowFor(resource, { limit, remaining, reset });
  if (!row || !snapshot.rows.some(x => x.resource === resource)) {
    return { ok: false, reason: 'rate_headers_invalid' };
  }
  return { ...snapshot, header_override: resource,
    rows: snapshot.rows.map(x => x.resource === resource ? row : x) };
}
export async function fetchGitHubRateSnapshot({
  token, fetchImpl = globalThis.fetch, observedAt = new Date().toISOString(), timeoutMs = 10000
} = {}) {
  if (typeof token !== 'string' || !token || typeof fetchImpl !== 'function' ||
      !Number.isSafeInteger(timeoutMs) || timeoutMs < 10 || timeoutMs > 60000) {
    return { ok: false, reason: 'github_credentials_or_transport_unavailable' };
  }
  const controller = new AbortController();
  let timer;
  const deadline = new Promise(resolve => {
    timer = setTimeout(() => {
      controller.abort();
      resolve({ ok: false, reason: 'github_rate_request_timed_out' });
    }, timeoutMs);
  });
  const request = (async () => {
    let response;
    try {
      response = await fetchImpl('https://api.github.com/rate_limit', {
        redirect: 'error', signal: controller.signal,
        headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28', 'Cache-Control': 'no-store' }
      });
    } catch { return { ok: false, reason: 'github_rate_request_unavailable' }; }
    if (!response?.ok) {
      return { ok: false, reason: [403, 429].includes(response?.status)
        ? 'github_rate_limited_or_denied' : 'github_rate_request_unavailable' };
    }
    let data;
    try { data = await response.json(); }
    catch { return { ok: false, reason: 'github_rate_response_invalid' }; }
    return applyGitHubRateHeaders(parseGitHubRateSnapshot(data, { observedAt }), response.headers);
  })();
  try { return await Promise.race([request, deadline]); }
  finally { clearTimeout(timer); }
}
export function renderGitHubRateDashboard(snapshot) {
  if (!snapshot || snapshot.ok !== true) {
    return '# GitHub API rate-limit dashboard\n\nStatus UNKNOWN: could not verify remaining REST/GraphQL limits.\n';
  }
  const lines = ['# GitHub API rate-limit dashboard', '',
    'Read-only snapshot observed at ' + snapshot.observed_at + '. Rate limits count API requests, not GitHub Actions billing dollars.',
    '', '| Resource | Remaining | Limit | Remaining % | Reset UTC | Status |',
    '| --- | ---: | ---: | ---: | --- | --- |'];
  for (const x of snapshot.rows) {
    lines.push('| ' + [x.resource, x.remaining, x.limit,
      x.remaining_pct === null ? 'unknown' : x.remaining_pct + '%', x.reset_utc, x.state].join(' | ') + ' |');
  }
  if (snapshot.header_override) lines.push('', 'The ' + snapshot.header_override + ' bucket uses authoritative response headers.');
  lines.push('', 'A healthy primary limit does not prove that secondary/abuse limits are available. Respect Retry-After and GitHub response headers.', '');
  return lines.join('\n');
}
async function main() {
  const snapshot = await fetchGitHubRateSnapshot({ token: process.env.GITHUB_TOKEN });
  const md = renderGitHubRateDashboard(snapshot);
  console.log(md);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, md, 'utf8');
  if (!snapshot.ok) process.exitCode = 1;
  else if (process.env.GITHUB_ACTIONS === 'true') {
    const constrained = snapshot.rows.filter(x => ['low', 'exhausted'].includes(x.state));
    if (constrained.length) console.warn('::warning title=GitHub API quota::Low or exhausted resource buckets: ' +
      constrained.map(x => x.resource).join(', '));
  }
}
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) await main();
