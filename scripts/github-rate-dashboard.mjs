/* Read-only GitHub REST /rate_limit dashboard.
 * Quotas are a point-in-time API observation, not dollar costs, a guarantee
 * of webhook delivery, or an authorization to raise integration frequency.
 * Never print the token or any raw provider error response.
 */
import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const NAME = /^[a-z][a-z0-9_]{0,48}$/;
function safeNumber(x) {
  return Number.isSafeInteger(x) && x >= 0 ? x : null;
}

export function parseGitHubRateSnapshot(payload, { observedAt = new Date().toISOString() } = {}) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload) ||
      !payload.resources || typeof payload.resources !== 'object' ||
      !Number.isFinite(Date.parse(observedAt))) {
    return { ok: false, reason: 'rate_snapshot_missing_or_invalid' };
  }
  const rows = [];
  const resources = Object.entries(payload.resources);
  if (resources.length === 0 || resources.length > 60) {
    return { ok: false, reason: 'rate_snapshot_missing_or_invalid' };
  }
  for (const [name, item] of resources) {
    if (!NAME.test(name) || !item || typeof item !== 'object') {
      return { ok: false, reason: 'rate_resource_invalid' };
    }
    const limit = safeNumber(item.limit);
    const remaining = safeNumber(item.remaining);
    const resetEpoch = safeNumber(item.reset);
    const used = item.used === undefined ? null : safeNumber(item.used);
    if (limit === null || remaining === null || remaining > limit ||
        resetEpoch === null || resetEpoch > 4102444800 ||
        (item.used !== undefined && used === null)) {
      return { ok: false, reason: 'rate_resource_invalid' };
    }
    const remainingPct = limit === 0 ? null : Math.round(100 * remaining / limit);
    rows.push({
      resource: name, limit, remaining, used,
      reset_utc: new Date(resetEpoch * 1000).toISOString(),
      remaining_pct: remainingPct,
      state: limit === 0 ? 'unavailable' :
        remaining === 0 ? 'exhausted' : remainingPct <= 10 ? 'low' : 'normal',
    });
  }
  if (!rows.some(x => x.resource === 'core')) {
    return { ok: false, reason: 'core_rate_resource_missing' };
  }
  rows.sort((a, b) => a.resource.localeCompare(b.resource));
  return { ok: true, observed_at: observedAt, rows };
}

export async function fetchGitHubRateSnapshot({
  token, fetchImpl = globalThis.fetch, observedAt = new Date().toISOString()
} = {}) {
  if (typeof token !== 'string' || !token || typeof fetchImpl !== 'function') {
    return { ok: false, reason: 'github_credentials_or_transport_unavailable' };
  }
  let response;
  try {
    response = await fetchImpl('https://api.github.com/rate_limit', {
      headers: {
        Authorization: 'Bearer ' + token,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Cache-Control': 'no-store',
      },
    });
  } catch { return { ok: false, reason: 'github_rate_request_unavailable' }; }
  if (!response?.ok) {
    const status = Number.isInteger(response?.status) ? response.status : 0;
    return { ok: false, reason: status === 429 || status === 403
      ? 'github_rate_limited_or_denied' : 'github_rate_request_unavailable' };
  }
  let data;
  try { data = await response.json(); }
  catch { return { ok: false, reason: 'github_rate_response_invalid' }; }
  return parseGitHubRateSnapshot(data, { observedAt });
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
      x.remaining_pct === null ? 'unknown' : x.remaining_pct + '%',
      x.reset_utc, x.state].join(' | ') + ' |');
  }
  lines.push('', 'A healthy primary limit does not prove that secondary/abuse limits are available. Respect Retry-After and GitHub response headers.', '');
  return lines.join('\n');
}

async function main() {
  const snapshot = await fetchGitHubRateSnapshot({ token: process.env.GITHUB_TOKEN });
  const md = renderGitHubRateDashboard(snapshot);
  console.log(md);
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, md, 'utf8');
  }
  if (!snapshot.ok) process.exitCode = 1;
}
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) await main();
