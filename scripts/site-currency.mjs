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
 * The primary signal is now a Netlify-generated deploy marker:
 * `data/deploy-meta.json`, written from Netlify's immutable `COMMIT_REF`
 * during the build. That proves exactly which Git commit is live.
 * Hashes of the served assets are INDEPENDENT integrity evidence: a matching
 * marker cannot excuse mutated/unreadable/missing files. A missing marker
 * cannot prove dynamic Netlify Functions are current, even if HTML matches.
 * Site serving failures are distinct from a stale deployment marker.
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

/**
 * Bounded excerpt of the first divergent region between the repo's bytes and
 * the live site's bytes, so a serve-time mutation NAMES ITSELF in the log.
 *
 * On 2026-08-04 the three HTML shells diverged for hours while every other
 * asset matched — the signature of an injector rewriting HTML at serve time —
 * and this report could only say `repo <hash> != live <hash>`, pushing the
 * actual diagnosis out to Netlify API archaeology. The next injector should be
 * readable straight off the failing run.
 *
 * Pure. Returns null when the buffers are identical; otherwise
 * { at, repoBytes, liveBytes, repo, live } where the snippets start `context`
 * bytes before the divergence, are escaped to a single printable line
 * (\n, \r, \t literalised; other non-printables become '.'), and are capped
 * at `cap` characters — a multi-megabyte body can never flood the log.
 */
export function firstDivergence(repoBuf, liveBuf, { context = 40, cap = 160 } = {}) {
  const min = Math.min(repoBuf.length, liveBuf.length);
  let at = 0;
  while (at < min && repoBuf[at] === liveBuf[at]) at++;
  if (at === repoBuf.length && at === liveBuf.length) return null;
  const start = Math.max(0, at - context);
  const printable = (buf) =>
    buf
      .toString('utf8')
      .replace(/\\/g, '\\\\')
      .replace(/\r/g, '\\r')
      .replace(/\n/g, '\\n')
      .replace(/\t/g, '\\t')
      .replace(/[^\x20-\x7E]/g, '.')
      .slice(0, cap);
  return {
    at,
    repoBytes: repoBuf.length,
    liveBytes: liveBuf.length,
    repo: printable(repoBuf.subarray(start, at + cap)),
    live: printable(liveBuf.subarray(start, at + cap)),
  };
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
 * Combine the primary deploy SHA and exact bytes the site serves.
 * Pure for offline tests. In particular:
 * - A correct deploy SHA cannot excuse missing/modified root assets.
 * - Identical HTML does not prove that stale Netlify Functions were updated.
 * - Deployment lag is allowed only when ALL changed deploy paths are dated
 *   inside the configured grace window; undatable paths fail closed.
 */
export function assessDeploymentIntegrity({
  expectedCommit, markerCommit, changedPaths = null, changedAtSeconds = [],
  markerCommittedAt = NaN, assetDecision,
  graceSeconds = 86400, now = Math.floor(Date.now() / 1000)
} = {}) {
  if (!assetDecision || typeof assetDecision.verdict !== 'string') {
    return { verdict: 'unverifiable', ok: false,
      reason: 'asset comparison did not produce a verdict' };
  }
  const knownMarker = typeof markerCommit === 'string' && /^[0-9a-f]{40}$/.test(markerCommit);
  const knownExpected = typeof expectedCommit === 'string' && /^[0-9a-f]{40}$/.test(expectedCommit);
  if (knownMarker && knownExpected && markerCommit === expectedCommit) {
    return assetDecision.verdict === 'current'
      ? { verdict: 'current', ok: true, reason: 'deploy marker and every served root asset match' }
      : { verdict: 'integrity_failure', ok: false,
          reason: 'deploy marker matches but live assets differ, are missing or cannot be read' };
  }
  if (knownMarker && knownExpected && markerCommit !== expectedCommit) {
    if (!Array.isArray(changedPaths)) {
      // Known stale root bytes are already hard evidence of drift. An
      // incomplete GitHub compare cannot turn a proven failure into
      // "unknown", or a clean-looking static site into "current".
      if (assetDecision.verdict === 'drift' ||
          assetDecision.verdict === 'integrity_failure') {
        return { verdict: 'drift', ok: false,
          reason: 'live root assets differ and full deploy-path comparison is unavailable' };
      }
      return { verdict: 'unverifiable', ok: false,
        reason: 'deploy marker is behind main and full changed-path comparison is unavailable' };
    }
    if (changedPaths.length > 0) {
      if (assetDecision.verdict === 'unverifiable') {
        return { verdict: 'unverifiable', ok: false,
          reason: 'unreadable live assets and stale deploy marker' };
      }
      // The MOST RECENT commit to a path cannot prove lag: a stale Function
      // can be changed again today, concealing an unshipped edit from weeks
      // ago. Require independently verified age for the *deployed marker*
      // and all intervening comparison commits before granting grace.
      const markerWithinGrace = Number.isFinite(markerCommittedAt) &&
        markerCommittedAt <= now && now - markerCommittedAt <= graceSeconds;
      const datesProveLag = graceSeconds > 0 && markerWithinGrace &&
        changedPaths.length <= 100 &&
        changedPaths.length === changedAtSeconds.length &&
        changedAtSeconds.every(at => Number.isFinite(at) && at <= now && now - at <= graceSeconds);
      if (datesProveLag && assetDecision.ok === true) {
        return { verdict: 'lag', ok: true,
          reason: 'deploy-relevant changes are within the grace window; production is not verified current yet' };
      }
      return { verdict: 'drift', ok: false,
        reason: 'stale commit marker with deploy-relevant code/functions outside verified lag' };
    }
    // Only docs/CI have changed. A root asset mismatch therefore cannot be
    // explained by an in-flight app build (the previous early-return bug).
    return assetDecision.verdict === 'current'
      ? { verdict: 'current', ok: true,
          reason: 'only non-deploy files changed and every live root asset still matches' }
      : { verdict: 'integrity_failure', ok: false,
          reason: 'docs-only deploy-marker gap cannot excuse missing, unreadable or modified assets' };
  }
  if (knownExpected && !knownMarker) {
    return { verdict: 'unverifiable', ok: false,
      reason: 'missing/invalid live deploy marker: static assets cannot prove Netlify Functions are current' };
  }
  return { verdict: assetDecision.verdict, ok: assetDecision.ok === true,
    reason: assetDecision.reason };
}

/** GitHub compare responses are bounded to 300 changed files and 250 commits.
 * A partial comparison MUST NOT imply that Netlify Functions are current.
 * The commit list (not the latest edit per path) gives a conservative lower
 * bound on how long any unshipped change has been waiting. Parsing is pure
 * and independently regression-tested using synthetic truncated responses.
 */
export function verifiedDeployComparison(body, base, head) {
  const isSha = value => typeof value === 'string' && /^[0-9a-f]{40}$/.test(value);
  if (!isSha(base) || !isSha(head) ||
      !body || body.status !== 'ahead' ||
      body.base_commit?.sha !== base ||
      body.merge_base_commit?.sha !== base ||
      !Array.isArray(body.files) || body.files.length >= 300 ||
      !Array.isArray(body.commits) || !Number.isSafeInteger(body.total_commits) ||
      body.total_commits < 1 || body.commits.length !== body.total_commits ||
      body.commits[body.commits.length - 1]?.sha !== head ||
      body.files.some(file => !file || typeof file.filename !== 'string')) return null;
  const markerAtMs = Date.parse(body.base_commit?.commit?.committer?.date || '');
  const commitDates = body.commits.map(commit =>
    Date.parse(commit?.commit?.committer?.date || ''));
  if (!Number.isFinite(markerAtMs) ||
      commitDates.some(ms => !Number.isFinite(ms))) return null;
  return {
    changedPaths: [...new Set(body.files.filter(file =>
      isDeployRelevantPath(file.filename)).map(file => file.filename))],
    markerCommittedAt: Math.floor(markerAtMs / 1000),
    oldestComparedCommitAt: Math.floor(Math.min(...commitDates) / 1000),
  };
}

export function isDeployRelevantPath(name) {
  const p = String(name || '').replace(/^\.\//, '');
  if (!p) return false;
  if (/^[^/]+\.(?:html|js|css|webmanifest)$/.test(p)) return true;
  return p === 'netlify.toml' || p.startsWith('assets/') || p.startsWith('netlify/');
}

async function deployRelevantChangesSince(base, head, timeoutMs = 15000) {
  const slug = process.env.GITHUB_REPOSITORY;
  if (!slug || !/^[0-9a-f]{40}$/.test(base) || !/^[0-9a-f]{40}$/.test(head)) return null;
  const headers = { Accept: 'application/vnd.github+json' };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(`https://api.github.com/repos/${slug}/compare/${base}...${head}`, {
      headers, signal: ac.signal,
    });
    if (!res.ok) return null;
    return verifiedDeployComparison(await res.json(), base, head);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchDeployMeta(origin, timeoutMs = 15000) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(`${origin}/data/deploy-meta.json`, {
      signal: ac.signal,
      headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
    });
    if (!res.ok) return { ok: false, status: res.status, reason: `HTTP ${res.status}` };
    const body = await res.json();
    const commit = String(body?.commit || '').trim().toLowerCase();
    if (!/^[0-9a-f]{40}$/.test(commit)) {
      return { ok: false, status: res.status, reason: 'invalid or missing commit in deploy-meta.json' };
    }
    return { ok: true, commit, body };
  } catch (err) {
    return { ok: false, status: 0, reason: err?.name === 'AbortError' ? 'timed out' : String(err?.message || err) };
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

export async function compare({ origin, graceSeconds = 86400, timeoutMs = 30000,
  oldestComparedCommitAt = NaN } = {}) {
  const assets = discoverServedAssets();
  const results = [];
  for (const name of assets) {
    const repoBody = readFileSync(path.join(REPO_ROOT, name));
    const repoHash = sha256(repoBody);
    const fetched = await fetchAsset(origin, name, timeoutMs);
    if (fetched.status === 'ok') {
      const liveHash = sha256(fetched.body);
      const match = liveHash === repoHash;
      results.push({
        name,
        status: match ? 'match' : 'differ',
        repoHash,
        liveHash,
        excerpt: match ? null : firstDivergence(repoBody, fetched.body),
        changedAt: match ? NaN : oldestComparedCommitAt,
      });
    } else {
      results.push({ name, status: fetched.status, repoHash, liveHash: null,
        detail: fetched.detail, changedAt: oldestComparedCommitAt });
    }
  }

  // One bounded compare response supplies the *oldest* intervening commit.
  // No extra per-file GitHub API calls, and recent re-edits cannot erase a
  // much older unshipped deployment change. If unavailable, NaN fails closed.

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
  const expectedCommit = String(process.env.EXPECTED_DEPLOY_SHA || process.env.GITHUB_SHA || '').trim().toLowerCase();
  const deployMeta = await fetchDeployMeta(origin);
  let changedPaths = null;
  let comparison = null;

  if (deployMeta.ok && /^[0-9a-f]{40}$/.test(expectedCommit)) {
    console.log(`deploy marker: live ${deployMeta.commit} · expected ${expectedCommit}`);
    if (deployMeta.commit !== expectedCommit) {
      comparison = await deployRelevantChangesSince(deployMeta.commit, expectedCommit);
      changedPaths = comparison?.changedPaths ?? null;
      if (Array.isArray(changedPaths) && changedPaths.length) {
        annotate(`::notice::Live marker is behind main and ${changedPaths.length} deploy-relevant paths changed: ${changedPaths.slice(0, 12).join(', ')}`);
      } else if (Array.isArray(changedPaths)) {
        annotate('::notice::Only non-deploy files changed since marker; verifying served assets anyway.');
      } else {
        annotate('::notice::Stale marker with unavailable change comparison; current production cannot be established.');
      }
    }
  } else if (/^[0-9a-f]{40}$/.test(expectedCommit)) {
    console.log(`deploy marker unavailable (${deployMeta.reason || 'unknown'}); checking assets but Netlify Function freshness remains UNVERIFIABLE`);
  }

  const { results, decision } = await compare({
    origin, graceSeconds, oldestComparedCommitAt: comparison?.oldestComparedCommitAt ?? NaN,
  });
  // The same complete compare response supplies a conservative earliest
  // unshipped commit date for every deploy path. We must not infer age from
  // the latest edit, or make one HTTP request for every changed filename.
  const changedAtSeconds = Array.isArray(changedPaths) && comparison
    ? changedPaths.map(() => comparison.oldestComparedCommitAt)
    : [];
  const integrity = assessDeploymentIntegrity({
    expectedCommit, markerCommit: deployMeta.ok ? deployMeta.commit : null,
    changedPaths, changedAtSeconds,
    markerCommittedAt: comparison?.markerCommittedAt ?? NaN,
    assetDecision: decision, graceSeconds,
  });

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
  /* Where bytes diverge, show WHICH bytes — the 2026-08-04 HTML drift sat
     behind hash-only rows for hours while the injector's own markup would have
     identified it in one line. */
  for (const r of results) {
    if (r.status !== 'differ' || !r.excerpt) continue;
    const e = r.excerpt;
    console.log(`\n  ${r.name}: first divergence at byte ${e.at} (repo ${e.repoBytes} B, live ${e.liveBytes} B)`);
    console.log(`    repo: ${e.repo}`);
    console.log(`    live: ${e.live}`);
  }
  console.log('');
  console.log(`asset comparison: ${decision.verdict.toUpperCase()} — ${decision.reason}`);
  console.log(`verdict: ${integrity.verdict.toUpperCase()} — ${integrity.reason}`);

  if (integrity.ok) {
    if (integrity.verdict === 'lag') {
      annotate('::notice::Deploy-relevant code is within the grace window. Production is NOT YET verified current.');
    }
    return;
  }
  if (integrity.verdict === 'unverifiable') {
    annotate(`::error::Site currency UNVERIFIABLE — ${integrity.reason}. Unknown coverage must never be called current.`);
    process.exit(2);
  }
  if (integrity.verdict === 'integrity_failure') {
    annotate(`::error::PRODUCTION INTEGRITY FAILURE — ${integrity.reason}. The SHA marker cannot excuse missing, unreadable, or mutated files.`);
    process.exit(1);
  }
  const names = decision.stale.map((r) => r.name).join(', ');
  annotate(`::error::PRODUCTION DRIFT — ${integrity.reason}. Stale or absent root assets: ${names || 'none (Netlify Functions/configuration may be behind)'}. Check Netlify Deploys and docs/runbooks/netlify-production-recovery.md.`);
  process.exit(1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(`::error::site-currency failed to run: ${err?.stack || err}`);
    process.exit(2);
  });
}
