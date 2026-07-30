#!/usr/bin/env node
/**
 * Site currency — does the live site actually SERVE what main ships?
 *
 * WHY THIS EXISTS, AND WHY IT DOES NOT COMPARE APP_VERSION
 * -------------------------------------------------------
 * The previous check compared the live site's `APP_VERSION` string against the
 * one at HEAD of main. On 30 Jul 2026 it reported
 *
 *     CURRENT — production serves the version at HEAD of main
 *
 * while production was serving a build **31 commits behind main** (the last
 * published deploy was commit 403f091f / PR #338, created 29 Jul via the
 * Netlify API; PRs #339-#369 had never reached the live site). The check was
 * not lying about what it measured — live `3.7.2` really did equal repo
 * `3.7.2`. APP_VERSION is a *hand-maintained* string: it moves only when
 * somebody remembers to move it, and it had not moved since 16 Jul. So the
 * probe passed by measuring a constant.
 *
 * That is the same defect this repo has now found at four other layers:
 * counted as covered, actually not covered, and silent about it.
 *
 * The fix is to compare something that cannot be forgotten. `netlify.toml`
 * sets `publish = "."` with no build step, so every served asset is a
 * checked-in file byte-for-byte. Hashing them is therefore an exact test of
 * "is production serving this commit's code?" — and any merge that changes
 * what the site serves necessarily changes a hash. Nobody has to remember
 * anything.
 *
 * SCOPE (stated, not silent)
 * --------------------------
 * Every root-level `.html`, `.js`, `.css` and `.webmanifest` file — the whole
 * app surface, discovered from disk rather than listed, so a new root asset is
 * covered the day it is added (a hardcoded list is exactly how the shadow-
 * policy sweep in #338 acquired a blind spot). Binary assets under `assets/`
 * (fonts, images) are NOT fetched: they are large and effectively immutable,
 * and any deploy carrying them also carries the text assets above. A stale
 * deploy cannot hide behind that gap.
 *
 * VERDICTS
 * --------
 *   current       every asset matches — production serves this commit
 *   lag           the only mismatches were committed within the grace window;
 *                 a deploy is presumably still in flight
 *   drift         production is behind main — deploys are not publishing
 *   unverifiable  the live site could not be read; currency is UNKNOWN, which
 *                 is reported as a failure and never as a pass
 */

import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SERVED_EXTENSIONS = new Set(['.html', '.js', '.css', '.webmanifest']);

export function sha256(buf) {
  return createHash('sha256').update(buf).digest('hex');
}

/** Root-level assets the site publishes, discovered from disk. */
export function discoverServedAssets(root = REPO_ROOT) {
  return readdirSync(root, { withFileTypes: true })
    .filter((e) => e.isFile() && SERVED_EXTENSIONS.has(path.extname(e.name)))
    .map((e) => e.name)
    .sort();
}

/**
 * Turn per-asset comparison results into a verdict.
 *
 * Pure so the decision can be tested without a network: `results` is
 * [{ name, status: 'match'|'differ'|'missing'|'error', changedAt }] where
 * `changedAt` is the unix seconds of the asset's last commit on main.
 */
export function decide(results, { graceSeconds = 86400, now = Math.floor(Date.now() / 1000) } = {}) {
  const unreadable = results.filter((r) => r.status === 'error');
  if (unreadable.length) {
    return {
      verdict: 'unverifiable',
      ok: false,
      stale: [],
      unreadable,
      reason:
        `could not read ${unreadable.length} asset(s) from the live site — ` +
        'currency is UNKNOWN, which is not the same as current',
    };
  }

  // A missing asset is drift too: main ships a file production does not serve.
  const stale = results.filter((r) => r.status === 'differ' || r.status === 'missing');
  if (!stale.length) {
    return { verdict: 'current', ok: true, stale: [], unreadable: [], reason: 'every served asset matches HEAD' };
  }

  // Deploy lag only if EVERY divergence is recent. One old divergence means
  // production is genuinely behind, however many recent ones sit beside it.
  const ages = stale.map((r) => (Number.isFinite(r.changedAt) ? now - r.changedAt : Infinity));
  const oldest = Math.max(...ages);
  if (oldest <= graceSeconds) {
    return {
      verdict: 'lag',
      ok: true,
      stale,
      unreadable: [],
      reason: `all ${stale.length} divergence(s) were committed within the ${graceSeconds}s grace window`,
    };
  }

  return {
    verdict: 'drift',
    ok: false,
    stale,
    unreadable: [],
    reason:
      `${stale.length} asset(s) diverge from main, ` +
      (Number.isFinite(oldest)
        ? `the oldest for ${oldest}s (> ${graceSeconds}s grace)`
        : 'at least one of them undatable so none can be excused as deploy lag') +
      ' — production deploys are not publishing',
  };
}

/**
 * Unix seconds of the asset's most recent commit on the deploy branch, used
 * only to tell deploy lag from real drift.
 *
 * Read over the API rather than by shelling out to `git log`: the
 * hawkeye-no-child-process rule in `.semgrep/hawkeye.yml` forbids subprocess
 * spawning anywhere in application, script or function code, and a monitoring
 * probe is not the place to make an exception for a command-injection vector.
 * `fetch` is already this script's transport, and api.github.com is already on
 * both callers' egress allowlists.
 *
 * Returns NaN whenever the date cannot be established — no repo slug, no
 * network, a rate limit, an unparseable body. `decide()` treats an undatable
 * divergence as DRIFT, which is the safe direction: a divergence we cannot
 * prove is recent must not be excused as lag.
 */
async function lastChangedAt(name, { timeoutMs = 15000 } = {}) {
  const slug = process.env.GITHUB_REPOSITORY;
  if (!slug) return NaN;
  const branch = process.env.DEPLOY_BRANCH || 'main';
  const url =
    `https://api.github.com/repos/${slug}/commits` +
    `?path=${encodeURIComponent(name)}&sha=${encodeURIComponent(branch)}&per_page=1`;
  const headers = { Accept: 'application/vnd.github+json' };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers, signal: ac.signal });
    if (!res.ok) return NaN;
    const body = await res.json();
    const iso = body?.[0]?.commit?.committer?.date;
    const ms = Date.parse(iso || '');
    return Number.isFinite(ms) ? Math.floor(ms / 1000) : NaN;
  } catch {
    return NaN;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchAsset(origin, name, timeoutMs) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(`${origin}/${name}`, {
      signal: ac.signal,
      headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
    });
    if (res.status === 404) return { status: 'missing', detail: 'HTTP 404' };
    if (!res.ok) return { status: 'error', detail: `HTTP ${res.status}` };
    return { status: 'ok', body: Buffer.from(await res.arrayBuffer()) };
  } catch (err) {
    return { status: 'error', detail: err?.name === 'AbortError' ? 'timed out' : String(err?.message || err) };
  } finally {
    clearTimeout(timer);
  }
}

export async function compare({ origin, graceSeconds = 86400, timeoutMs = 30000 } = {}) {
  const assets = discoverServedAssets();
  const results = [];
  for (const name of assets) {
    const repoHash = sha256(readFileSync(path.join(REPO_ROOT, name)));
    const fetched = await fetchAsset(origin, name, timeoutMs);
    if (fetched.status === 'ok') {
      const liveHash = sha256(fetched.body);
      results.push({
        name,
        status: liveHash === repoHash ? 'match' : 'differ',
        repoHash,
        liveHash,
        changedAt: NaN,
      });
    } else {
      results.push({ name, status: fetched.status, repoHash, liveHash: null, detail: fetched.detail, changedAt: NaN });
    }
  }

  /* Date only the divergences, and only when a grace window can act on the
     answer. A matching asset's history is irrelevant, and with grace at zero
     (the deploy workflow's publish-wait, which polls up to 30 times) every
     divergence is drift regardless of age — so a healthy site makes no API
     calls at all, and the polling caller makes none either. */
  if (graceSeconds > 0) {
    await Promise.all(
      results
        .filter((r) => r.status === 'differ' || r.status === 'missing')
        .map(async (r) => { r.changedAt = await lastChangedAt(r.name); }),
    );
  }

  return { results, decision: decide(results, { graceSeconds }) };
}

async function main() {
  /* --quiet keeps the exit code and the table but suppresses the ::error::
     workflow annotations. The deploy workflow polls this script up to 30 times
     while a publish lands; without it, 29 expected "not yet" polls would each
     file a red annotation on a step that goes on to succeed. */
  const quiet = process.argv.includes('--quiet');
  const annotate = (line) => { if (!quiet) console.log(line); };
  const origin = (process.env.LIVE_ORIGIN || '').replace(/\/+$/, '');
  if (!origin) {
    console.error('LIVE_ORIGIN is not set — refusing to report currency without an origin to check.');
    process.exit(2);
  }
  const graceSeconds = Number.parseInt(process.env.GRACE_SECONDS || '86400', 10);
  const { results, decision } = await compare({ origin, graceSeconds });

  const width = Math.max(...results.map((r) => r.name.length));
  for (const r of results) {
    const mark = { match: 'ok    ', differ: 'STALE ', missing: 'ABSENT', error: 'ERROR ' }[r.status];
    const note =
      r.status === 'match'
        ? r.repoHash.slice(0, 12)
        : r.status === 'differ'
          ? `repo ${r.repoHash.slice(0, 12)} != live ${r.liveHash.slice(0, 12)}`
          : r.detail || '';
    console.log(`  ${mark} ${r.name.padEnd(width)}  ${note}`);
  }
  console.log('');
  console.log(`verdict: ${decision.verdict.toUpperCase()} — ${decision.reason}`);

  if (decision.ok) {
    if (decision.verdict === 'lag') {
      annotate(`::notice::Deploy lag — ${decision.stale.length} asset(s) not yet published, all within grace.`);
    }
    return;
  }

  if (decision.verdict === 'unverifiable') {
    annotate(`::error::Site currency UNVERIFIABLE — ${decision.reason}. Treating as a failure: an unread site is not a current site.`);
    process.exit(2);
  }

  const names = decision.stale.map((r) => r.name).join(', ');
  annotate(
    `::error::PRODUCTION DRIFT — the live site is NOT serving what main ships. ` +
      `Stale or absent: ${names}. Production deploys are not publishing: check the Netlify ` +
      `deploy log (app.netlify.com/projects/hawkeye-sterling-ra/deploys), re-link the ` +
      `repository under Build & deploy -> Continuous deployment, or set the ` +
      `NETLIFY_BUILD_HOOK_URL secret so netlify-production-deploy.yml can publish.`,
  );
  process.exit(1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(`::error::site-currency failed to run: ${err?.stack || err}`);
    process.exit(2);
  });
}
