# Netlify production deploy recovery

**Scope:** The live HAWKEYE assessment site, not the repository's passing
Python/JavaScript unit tests. Never assume that merging into `main` means the
Netlify production URL has been updated.

Production site: https://hawkeye-sterling-ra.netlify.app
Netlify deploys: https://app.netlify.com/projects/hawkeye-sterling-ra/deploys
CI guard: `.github/workflows/site-currency.yml`
Build trigger: `.github/workflows/netlify-production-deploy.yml`
Exact content comparison: `scripts/site-currency.mjs`

### Runtime-asset release coverage

The static asset probe compares all root HTML, JavaScript, CSS and webmanifest
files, plus the published `robots.txt` and the browser-fetched
`data/country-score-suggested.json`. The Netlify build-hook workflow's
`push.paths` matches this asset set, including `privacy-policy.html`,
`terms.html` and `404.html`, so changing any of those files alone schedules
a deploy. `test/netlify-deploy-workflow-privacy.test.mjs` enforces that
**every** probed runtime asset activates the production deploy trigger.

Do not add `data/**` wholesale to the build trigger: other files under `data/`
are audit state, transient screening results or governance snapshots and can
change daily without affecting the served app. Deploying the country-score
*suggestion* file is only a publication update. It does **not** approve or
apply proposed changes to the underlying country-risk model or ASM gold
EDD thresholds.

This trigger/monitor parity is a **repository-side safeguard only**. It
does not fix stopped Netlify builds, a locked production deployment, a
wrong project/branch connection, or missing Netlify permissions. The
site's actual live content must still pass Site Currency before being
called published/current.


## Evidence and incident boundary (2026-10-09)

- The Site Currency run [37950228106](https://github.com/trex0092/HAWKEYE-STERLING-RA/actions/runs/37950228106)
  reported live commit `b66df4221b02193720c4ce1919ac0c5f6abf170e`,
  while the run expected `b4b010be34ec86b6d574348e7ffc07ad37374f31`.
  Numerous served assets differed, and `telemetry.js` returned HTTP 404.
- The production-deploy job [37937177715](https://github.com/trex0092/HAWKEYE-STERLING-RA/actions/runs/37937177715)
  had a configured `NETLIFY_BUILD_HOOK_URL`. The POST returned HTTP 200,
  but even after 54 checks across approximately 18 minutes, the same old
  commit remained live.
- The recovery dispatcher [37975294013](https://github.com/trex0092/HAWKEYE-STERLING-RA/actions/runs/37975294013)
  reported the Site Currency retry limit exhausted. Blind re-dispatch
  consumes build minutes and provides no new evidence of publication.
- A successful build-hook POST is **not proof** of an active build, completed
  deploy, or published site. The responsible Netlify operator must verify
  the site's own deploy record and publishing settings.

## Fail-closed deployment-integrity criteria

The live `data/deploy-meta.json` identifies the Netlify build commit. The
Site Currency probe also hashes every served root HTML, JS, CSS and manifest
file. **Neither signal can override a known failure in the other**:

- A deploy marker matching `main` is **not a pass** when a required root
  asset is absent, unreadable or byte-different. The repository config
  explicitly disables Netlify post-processing, so unexpected differences
  require investigation rather than a silent green check.
- When the deploy marker is older than `main`, equal HTML/JS bytes do
  **not** prove that deployed Netlify Functions are current. All changed
  deploy-relevant files, including `netlify/functions/**`, must be accounted
  for. Only independently dated changes inside the site's configured grace
  window can be reported as **LAG**, which is not verified currency.
- A failed GitHub commit comparison or undatable changed file is
  **UNVERIFIABLE/DRIFT**, not an implicit clean bill of health. A missing
  or malformed live deploy marker is likewise **UNVERIFIABLE** on GitHub
  production checks, even if root HTML happens to match, because the
  independent Netlify Functions cannot be verified from those files. More than
  100 changed deploy-relevant paths also fail closed rather than performing
  an unbounded number of API history lookups.
- A docs-only merge can leave an earlier deploy current, but only after the
  actual served root assets have been checked. Missing production files
  cannot be excused by a non-deploy commit.

The check remains **read-only**, and does not trigger another paid Netlify
build to attempt to conceal deployment drift. A failed Site Currency check
is an operational incident requiring Netlify deploy inspection, not grounds
to bypass production protections.

## Operator recovery steps

1. Open the Netlify deploy list for **hawkeye-sterling-ra** and verify the
   selected project is connected to `trex0092/HAWKEYE-STERLING-RA`.
   Check which production branch is configured and that it is `main`.
2. Under **Project configuration → Developer settings → Continuous deployment
   → Build settings**, verify **Build status = Active builds**. Stopped builds
   do not start from build hooks. Do not equate hook HTTP 200 with this state.
3. In the **Deploys** list verify whether the production deploy is **locked**.
   Unlock automatic publishing if it was unintentionally locked, with the
   release owner's authorization. A locked deploy can leave a new build
   unpublished while the older site remains live.
4. Locate the most recent `github-main-<commit>` build-hook trigger in the
   site's deployment history. If there is *no corresponding build*, inspect
   the hook's project/branch registration and active-build setting. If there
   is a **failed or skipped build**, open its Netlify deploy log. If a build
   succeeded but the site is still stale, inspect publishing locks, published
   deploy ID and asset consistency.
5. Correct the underlying Netlify setting or deployment error. If necessary,
   re-link the **same** GitHub repository and `main` branch through Netlify's
   Continuous deployment controls. **Caution:** unlinking/relinking can delete
   existing build hooks; re-create the hook and replace the
   `NETLIFY_BUILD_HOOK_URL` GitHub Actions **repository secret** if you
   intentionally take this path.
6. Trigger **one** new `main` production deploy after resolving the blocker,
   then verify the new deploy's published status in Netlify. Avoid repeated
   blind POSTs: Netlify build minutes/credits are finite.
7. Run the read-only
   [Site Currency](https://github.com/trex0092/HAWKEYE-STERLING-RA/actions/workflows/site-currency.yml)
   manual check on the updated `main` commit and require exact asset
   agreement. Also verify
   [Site Health](https://github.com/trex0092/HAWKEYE-STERLING-RA/actions/workflows/site-health.yml)
   and the Netlify Functions health checks.
8. Resolve the existing Asana incident as **verified restored** only after the
   live content check passes. Do not close the incident because a workflow was
   dispatched or a hook returned HTTP 200.

### Account/API cost and privacy controls

- Never paste the Netlify build hook URL, `NETLIFY_AUTH_TOKEN`, provider
  credentials or GitHub Secrets into a PR, issue, CI log, screenshot or Asana
  task. The hook is effectively a deployment trigger credential.
- The GitHub build-hook workflow does not log the full `vars` context; it
  probes only fixed secret names. Variable *values* may still be sensitive.
- The Advisor live behavioural eval cannot complete while the Anthropic API
  account reports exhausted monthly usage. Its failed job must remain red
  and classified as **evaluation unavailable**, not a behavioural regression.
  The 2026-10-09 provider response identified 2026-11-01 as the next access
  date. Restore authorized quota or wait; never silently skip the required
  live evaluation and claim success.
- The GitHub Advanced Security AI-review monthly quota is a **separate**
  account-level limitation. Standard CodeQL, Semgrep, Bandit and secret scans
  remain applicable and must not be disabled.

## References

- Netlify docs: [Build hooks](https://docs.netlify.com/build/configure-builds/build-hooks/)
- Netlify docs: [Stop or activate builds](https://docs.netlify.com/build/configure-builds/stop-or-activate-builds/)
- Netlify docs: [Manage locked deploys](https://docs.netlify.com/deploy/manage-deploys/manage-deploys-overview/)
- Netlify docs: [Repository linking](https://docs.netlify.com/configure-builds/repo-permissions-linking/)
