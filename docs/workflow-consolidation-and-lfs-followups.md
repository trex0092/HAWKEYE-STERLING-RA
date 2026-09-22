# Workflow Consolidation Analysis + Git LFS Runbook

_Written: 2026-09-11 · Scope: `.github/workflows/` sprawl analysis and a Git
LFS migration runbook for the repo's committed binary assets._

> **What was verified, and what was not.** This is an analysis and a runbook,
> not an executed change. Every claim about workflow triggers, schedules, and
> file references below was verified by reading the actual 65 files in
> `.github/workflows/` and grepping the served HTML/CSS/JS for asset
> references -- not assumed. Neither the workflow consolidation nor the LFS
> migration was executed in this session: the former needs a design decision
> from whoever has lived through this pipeline's incident history, and the
> latter needs git push credentials this session doesn't have (see Part 2).

---

## Part 1: Workflow consolidation analysis

### The actual, quantified duplication (safe to fix, high value)

Every one of the 65 workflow files repeats the identical `harden-runner` pin
(`step-security/harden-runner@e14015d583714f6e62063499dc959a02595150a1`, 72
occurrences across jobs). 51 of 65 files repeat the identical `checkout` pin
(`actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1`, 55 occurrences).
29 repeat the same `setup-node` pin; 9 repeat the same `setup-python` pin.
There is zero pin *fragmentation* today (every file agrees on the same SHA per
action) -- but that also means the next time any of these four actions needs a
version bump, it's a 50-65-file manual edit instead of a one-file edit.

**Recommendation:** extract the harden-runner + checkout (+ optional
setup-node/setup-python) preamble into one or two reusable workflows
(`workflow_call`), parametrized by:
- `egress-allowlist` (input string) -- confirmed genuinely variable: 53 job
  instances use `egress-policy: block` with a per-workflow allowlist, 13 use
  `egress-policy: audit` (tools with unpredictable egress, like Playwright
  fetching browsers or Fortify's per-deployment endpoints). A reusable
  workflow needs to accept both modes, not assume one.
- `needs-node` / `needs-python` (boolean inputs, or just always set up both
  since the marginal cost of an unused `setup-python` step is near zero).

This is genuinely low-risk to build: the blast radius of a *wrong* reusable
workflow is "one pilot workflow's CI breaks in an obviously visible way," not
"the sanctions engine matches names differently." Recommended rollout: convert
one low-stakes workflow first (e.g. `stale.yml` or `label-sync.yml`, no
scheduled compliance obligation riding on it), verify its next few runs match
its pre-change behavior, then roll out to the rest in batches.

**What this does NOT save:** the 8 separate SAST/security-scanner workflows
(`codeql.yml`, `semgrep.yml`, `gitleaks.yml`, `osv-scanner.yml`,
`container-scan.yml`, `dast-zap.yml`, `fortify.yml`, `bandit.yml`) are
one-tool-per-file by design, matching common industry practice for exactly
this reason: independent status badges, independent required-check gating,
independent failure isolation. Merging them into fewer files would not reduce
actual scanning work, only make per-tool status harder to see at a glance.
Not a consolidation candidate.

### The daily pipeline: sequenced by design, not accidentally overlapping

Reading every cron alongside its own comments shows a single, deliberately
engineered daily sequence, timed by wall-clock offset (not `workflow_run`
dependencies, because the team's own comments document that GitHub delivers
scheduled events "2-4h late, every day" and offsets are tuned empirically
around that):

```
05:07 sanctions-watch        (fetch lists)
05:19 site-health
05:23 function-health        (after site-health)
05:37 sanctions-screen       (case engine, after sanctions-watch)
06:07 fatf-watchdog + weekly-adverse-media's 3rd retry pass
06:19 regulatory-watch
06:37 anomaly-watch          (after morning screening)
07:09 daily-brief            (after the daily watchers)
07:37 control-retry pass 1   (heals other daily controls)
07:51 governance-report      (after daily-brief)
08:07 site-currency
09:09 freshness-check pass 1 (after sanctions-watch + regulatory-watch)
10:07 control-retry pass 2   (catches a retry that itself died)
12:09 freshness-check pass 2 (re-verifies after control-retry's healing)
18:00 delivery-watchdog      (after the scheduled run + both healing passes)
```

Plus `weekly-adverse-media.yml`'s own internal 3-pass retry (00:07/03:07/06:07)
running mostly before this chain starts. This is **not** sprawl in the sense
of accidental duplication -- it's a real pipeline, and the sequencing has
documented incident history behind it (e.g. "the 24 & 25 Jul 00:07 runs died
to runner-VM shutdowns mid-sweep and stayed red until someone manually
re-ran hours later" is the stated reason for `weekly-adverse-media`'s retry
passes). I'd recommend against restructuring this without the person who
lived through those incidents reviewing the plan first.

### The one genuine soft spot: three independently-evolved retry mechanisms

There are three different resilience patterns doing conceptually similar jobs:
1. Per-workflow internal retry passes (`weekly-adverse-media.yml`'s 3 crons).
2. A generic cross-workflow healer (`control-retry.yml`, 2 daily passes).
3. A separate double-check-only layer (`freshness-check.yml`, checks freshness
   twice, doesn't re-run anything itself).

Each is individually justified in its own comments, but three separately-grown
mechanisms for "did the daily control actually run and produce something
fresh" is worth a deliberate design review to see if one unified pattern could
replace all three -- this is a real redesign question, not a same-session
mechanical merge, and I'm flagging it rather than proposing a specific new
design, since that needs input from whoever has watched these systems handle
real incidents.

### Worth a human confirming, not confidently deleting

- `asana-delivery-diag.yml` -- triggers only on push to
  `diag/asana-live-delivery-check`. If that branch no longer exists or hasn't
  been pushed to in a long time, this may be dead diagnostic tooling from a
  past incident investigation.
- `netlify-probe.yml` and `netlify-deploy.yml` -- both `workflow_dispatch`-only,
  worth confirming they're not superseded by `netlify-production-deploy.yml`'s
  automatic push-triggered deploy.

I did not check usage/run history for these three (that's a `GITHUB_LIST_WORKFLOW_RUNS_FOR_A_REPOSITORY` query away, filtered by workflow and date, if useful as a next step) -- flagging them as candidates, not confirmed dead weight.

---

## Part 2: Git LFS runbook (needs real git push credentials -- not run here)

### Why this session can't do it

Converting existing files to LFS requires two things this environment
doesn't have: (1) `git` with push credentials for this repo (confirmed no `gh`
CLI, no token in env), and (2) the ability to upload actual object bytes to
GitHub's LFS content store, which is a *separate* API from the standard Git
Data API (blobs/trees/commits) that the available GitHub tools cover. Writing
a `.gitattributes` LFS rule and committing pointer-file text without a way to
push the real object bytes would leave GitHub showing pointer text where an
image or font used to be -- a regression, not a fix. So this is a runbook for
whoever has real push access, not something I attempted and gave up on.

### What's safe to move vs. what must NOT be touched

Netlify publishes this repo's root byte-for-byte
(`netlify.toml`: `publish = "."`, `skip_processing = true`, explicitly by
policy). That means **any binary file anywhere in the repo could be a live
site asset**, and I checked which ones actually are:

- `assets/**` (all `.webp`/`.png` personas and icons, all `.woff2` fonts) --
  **confirmed served**: `fonts.css` references `assets/fonts/*.woff2` by
  exact path, loaded by `index.html`/`console.html`/`advisor.html`. There is
  no evidence in `netlify.toml` of Netlify Large Media (the paid add-on
  needed for Netlify to resolve LFS pointers into real bytes at serve time).
  **Do not LFS-track anything under `assets/` without first confirming
  Netlify Large Media is enabled on this site** -- otherwise every font and
  icon on the live app breaks the moment this merges.
- `docs/**/*.png`, `docs/executive/*.docx` -- confirmed **not** served (only
  reference to `docs/` anywhere in served JS/CSS/HTML is a code *comment* in
  `app.js` pointing at an unrelated markdown file). Safe to LFS-track.
- `test/__screenshots__/**` -- confirmed not served (Playwright visual-
  regression baselines only, consumed in CI). Safe to LFS-track, **but**
  requires adding `lfs: true` to the `actions/checkout` step in both
  `.github/workflows/visual.yml` and `.github/workflows/cross-browser.yml`
  (the only two workflows that reference these files) -- otherwise Playwright
  compares against pointer-file text instead of real images and every visual
  test starts failing.

Combined size of the safe-to-move set: ~5.2MB (`docs/executive/*.docx` 947KB,
three `docs/screenshots/*.png` totaling ~1.24MB, two `docs/executive/diagrams/
*.png` totaling ~538KB, six `test/__screenshots__/**/*.png` totaling ~2.5MB) --
comfortably inside GitHub's free LFS storage/bandwidth quota.

### Exact commands (run wherever real push access exists)

```bash
# 1. Install git-lfs if not already present, then initialize it for this repo.
git lfs install

# 2. Track ONLY the confirmed-safe, confirmed-unserved paths.
git lfs track "docs/executive/*.docx"
git lfs track "docs/executive/diagrams/*.png"
git lfs track "docs/screenshots/*.png"
git lfs track "test/__screenshots__/**"
# This appends filter=lfs rules to .gitattributes -- review the diff.

# 3. Re-stage the already-tracked files through the new LFS filter. This is a
#    forward-only change (a new commit where these paths become LFS pointers);
#    it does NOT rewrite existing history, so no force-push is needed and old
#    clones/tags are unaffected.
git add .gitattributes
git add docs/executive/*.docx docs/executive/diagrams/*.png docs/screenshots/*.png test/__screenshots__/
git commit -m "chore: move docs/test screenshot binaries to Git LFS (forward-only, no history rewrite)"

# 4. Add `with: lfs: true` to the actions/checkout step in BOTH:
#      .github/workflows/visual.yml
#      .github/workflows/cross-browser.yml
#    (the only two workflows that read test/__screenshots__/**)

# 5. Push normally (no force needed -- this is an ordinary new commit).
git push origin main   # or via a PR branch, matching this repo's usual flow

# 6. Verify: re-clone fresh somewhere and confirm the files resolve to their
#    real content, not pointer text --
git clone <repo-url> /tmp/verify-lfs && cd /tmp/verify-lfs
file docs/executive/*.docx   # should say "Microsoft Word 2007+", not "ASCII text"
```

### If full history shrinkage is wanted later (separate, bigger decision)

The above only stops new bloat and fixes the current tree; existing commits in
history still store the old blobs at full size, so `.git` won't shrink
retroactively. That requires `git lfs migrate import --include="..."
--everything`, which **rewrites every historical commit SHA** and needs a
force-push plus every other clone of this repo to be re-cloned or hard-reset.
Given `disk_usage` on this repo is currently 200MB (per the GitHub API) and
well within normal limits, I'd treat that as a separate, explicitly-approved
decision rather than something to bundle into this cleanup -- it's the kind of
one-way door that deserves its own conversation, not a line item in a
follow-up doc.
