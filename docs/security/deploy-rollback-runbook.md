# Deploy Rollback Runbook

**Owner:** Repo owner · **Scope:** the production static site
(`hawkeye-sterling-ra.netlify.app`) and its Netlify functions · **Written:**
2026-08-04 (register item 26 owns the automation follow-up).

When production serves something wrong — a bad merge, a broken publish, or
drift the Site Currency probe flagged — this is the path back. The deploy
model this runbook assumes: `netlify.toml` publishes the repo root **as-is**
(`publish = "."`, `skip_processing = true`, no build step), production
publishes are triggered by the build hook
(`.github/workflows/netlify-production-deploy.yml`), and currency is verified
byte-exactly by `scripts/site-currency.mjs`.

## 0 · Decide what "last good" is

- **Releases:** the tagged releases (`vX.Y.Z`) are the auditable good points —
  each carries a source tarball, SBOM and Sigstore provenance.
- **Deploys:** Netlify → Deploys lists every published deploy with its commit.
- **Evidence:** the failing Site Currency run's output names exactly which
  assets diverge — read it before assuming the whole deploy is bad.

## 1 · Fast pin (minutes, no git) — Netlify UI

1. Netlify → *Deploys* → select the last known-good deploy (check its commit
   hash against `git log`).
2. **Publish deploy** — production now serves that deploy atomically.
3. *Deploys → Deploy settings*: **Lock deploys** (stop auto-publishing) if the
   bad state could re-publish.
4. Verify (step 3 below). **Remember the pin:** production is now frozen;
   unlock after the fix merges or main will silently stop shipping — exactly
   the drift class the 2026-06/07 incidents were.

## 2 · Durable fix (the default) — revert on main

1. `git revert` the offending commit(s) on a branch; PR; merge through the
   normal gates (they exist precisely for this moment — do not bypass).
2. The merge fires `netlify-production-deploy.yml` (or run it via
   *workflow_dispatch* if the paths filter doesn't match). Free-tier CDN
   propagation has measured ~12 minutes; the workflow polls up to ~18.
3. If the deploy run is killed mid-verify (runner shutdown — observed
   2026-08-04, exit 143), re-run it from the Actions UI: the poll is
   idempotent. Automating that re-run is register item 26.

## 3 · Verify — never trust the publish, read the site

```bash
LIVE_ORIGIN=https://hawkeye-sterling-ra.netlify.app node scripts/site-currency.mjs
```

Byte-exact verdict per asset. `UNVERIFIABLE` is a failure, not a pass — an
unread site is not a current site. The scheduled Site Currency probe
(08:07 UTC) independently alarms while any drift persists.

## 4 · Functions and data

- Functions ship with the deploy — rolling back the deploy rolls back
  `netlify/functions/` with it. If the incident is a function secret
  (`ANTHROPIC_API_KEY`, Asana token), rotate in Netlify → Environment
  variables; a redeploy picks it up.
- Committed `data/` state is **not** part of the served bundle's correctness
  story; never revert data-state commits as part of a site rollback — the
  watchers own that state (see [`../../data/README.md`](../../data/README.md)).

## 5 · Afterwards

Record the incident per the
[AI incident runbook](../governance/ai-incident-runbook.md) if any control
reported green over the bad state; if the rollback exposed a gap no register
item owns, open one (with an owner) in the
[open-actions register](../governance/open-actions-register.md).
