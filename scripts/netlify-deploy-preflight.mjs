#!/usr/bin/env node
/**
 * Optional, READ-ONLY Netlify deployment diagnostics.
 *
 * Build hooks return HTTP 200 even when production never publishes. With
 * NETLIFY_AUTH_TOKEN + NETLIFY_SITE_ID configured in GitHub Actions, query
 * the Netlify site and last few production deploys. Fail early only when the
 * returned data proves a blocker. Do not read provider secrets/environment,
 * echo response bodies, trigger another build, or modify Netlify settings.
 *
 * With no optional credentials the normal byte-exact Site Currency poll
 * still runs and remains the final deployment proof.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const NETLIFY_ORIGIN = 'https://api.netlify.com/api/v1';
const MAX_API_MS = 8000;
const BAD_DEPLOY_STATES = new Set([
  'error', 'rejected', 'skipped', 'canceled', 'cancelled', 'pending_review',
]);

function repoId(value) {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/^https?:\/\/(?:www\.)?github\.com\//i, '')
    .replace(/\.git$/i, '').replace(/^git@github\.com:/i, '')
    .replace(/\/$/, '').toLowerCase();
}

export function assessNetlifySite(site, expectedRepo, expectedBranch = 'main') {
  if (!site || typeof site !== 'object' || Array.isArray(site))
    return { status: 'unknown', code: 'invalid_site_response' };
  const build = site.build_settings;
  if (!build || typeof build !== 'object' || Array.isArray(build))
    return { status: 'unknown', code: 'build_settings_not_available' };
  if (build.stop_builds === true)
    return { status: 'blocked', code: 'builds_stopped' };
  if (site.published_deploy && site.published_deploy.locked === true)
    return { status: 'blocked', code: 'production_deploy_locked' };
  if (typeof build.repo_branch === 'string' && build.repo_branch &&
      build.repo_branch !== expectedBranch)
    return { status: 'blocked', code: 'wrong_production_branch' };
  const actualRepo = repoId(build.repo_path || build.repo_url);
  if (actualRepo && repoId(expectedRepo) && actualRepo !== repoId(expectedRepo))
    return { status: 'blocked', code: 'wrong_linked_repository' };
  return { status: 'no_confirmed_blocker', code: 'settings_inspected' };
}

export function assessRecentDeploys(deploys, expectedSha) {
  if (!Array.isArray(deploys) || !/^[a-f0-9]{40}$/.test(String(expectedSha || '')))
    return { status: 'unknown', code: 'deploy_list_unavailable' };
  const expected = deploys.find(d =>
    d && typeof d.commit_ref === 'string' && d.commit_ref.toLowerCase() === expectedSha &&
    (d.context === 'production' || d.branch === 'main'));
  if (!expected) return { status: 'unknown', code: 'expected_commit_not_in_recent_deploys' };
  const state = String(expected.state || '').toLowerCase();
  if (BAD_DEPLOY_STATES.has(state)) {
    const code = state === 'pending_review' ? 'build_requires_manual_review' : 'matching_deploy_failed';
    return { status: 'blocked', code };
  }
  if (state === 'ready' && typeof expected.published_at === 'string' &&
      expected.published_at.length > 0)
    return { status: 'candidate', code: 'provider_reports_published_verify_bytes' };
  return { status: 'unknown', code: 'deployment_in_progress_or_not_published' };
}

async function readSafeJson(url, token, fetchImpl, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        Authorization: 'Bearer ' + token,
        Accept: 'application/json',
      },
    });
    if (!response || !response.ok) return null;
    return await response.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function auditNetlifyProduction({
  token, siteId, expectedRepo, expectedSha, fetchImpl = fetch, timeoutMs = MAX_API_MS,
} = {}) {
  if (!token || !siteId) return {
    enabled: false, status: 'unknown', code: 'optional_api_credentials_unavailable',
  };
  if (typeof siteId !== 'string' || !/^[a-z0-9_-]{3,80}$/i.test(siteId))
    return { enabled: true, status: 'unknown', code: 'invalid_site_id' };
  const id = encodeURIComponent(siteId);
  const wait = Number.isSafeInteger(timeoutMs) ? Math.max(1000, Math.min(12000, timeoutMs)) : MAX_API_MS;
  const site = await readSafeJson(NETLIFY_ORIGIN + '/sites/' + id, token, fetchImpl, wait);
  const settings = assessNetlifySite(site, expectedRepo);
  if (settings.status === 'blocked') return { enabled: true, ...settings };
  const deployments = await readSafeJson(
    NETLIFY_ORIGIN + '/sites/' + id + '/deploys?production=true&per_page=5',
    token, fetchImpl, wait
  );
  const recent = assessRecentDeploys(deployments, expectedSha);
  if (recent.status === 'blocked') return { enabled: true, ...recent };
  if (settings.status === 'unknown') return { enabled: true, ...settings };
  return { enabled: true, ...recent };
}

const MESSAGES = Object.freeze({
  builds_stopped: 'Netlify builds are stopped. Activate builds in Netlify project configuration.',
  production_deploy_locked: 'Published production deploy is locked. Verify and unlock auto-publishing in Netlify Deploys.',
  wrong_production_branch: 'Netlify project is linked to a production branch other than main.',
  wrong_linked_repository: 'Netlify project points to a different GitHub repository.',
  build_requires_manual_review: 'Expected production deploy requires Netlify deploy review/acceptance.',
  matching_deploy_failed: 'The matching production deploy failed, was skipped, rejected or canceled. Inspect its Netlify build log.',
  settings_inspected: 'No definite Netlify blocker found; byte-exact live comparison remains required.',
  provider_reports_published_verify_bytes: 'Netlify reports a published deploy; verify actual served bytes.',
  expected_commit_not_in_recent_deploys: 'The expected main commit was not among the last five production deploys.',
  deployment_in_progress_or_not_published: 'A matching deploy may still be queued/building or unpublished.',
  invalid_site_response: 'Netlify site response could not be interpreted.',
  build_settings_not_available: 'Netlify build settings are unavailable from this API account.',
  deploy_list_unavailable: 'Netlify production deployment list is unavailable.',
  optional_api_credentials_unavailable: 'Set optional NETLIFY_AUTH_TOKEN and NETLIFY_SITE_ID to enable early read-only diagnostics.',
  invalid_site_id: 'NETLIFY_SITE_ID has an invalid format.',
});

export async function runNetlifyPreflight({ env = process.env, fetchImpl = fetch, log = console.log,
  warn = console.warn } = {}) {
  const result = await auditNetlifyProduction({
    token: env.NETLIFY_AUTH_TOKEN,
    siteId: env.NETLIFY_SITE_ID,
    expectedRepo: env.GITHUB_REPOSITORY,
    expectedSha: env.GITHUB_SHA,
    fetchImpl,
  });
  // Only emit fixed allowlisted labels, never provider bodies or identifiers.
  const message = MESSAGES[result.code] || MESSAGES.deploy_list_unavailable;
  if (result.status === 'blocked') {
    warn('::error::Netlify preflight blocker: ' + message);
    return 2; // stop 18-minute polling only on proven external blockers
  }
  if (result.status === 'unknown') {
    warn('::warning::Netlify preflight: ' + message);
  } else log('Netlify preflight: ' + message);
  return 0; // never substitute API status for Site Currency verification
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await runNetlifyPreflight();
}
