# Code-Scanning Alert Triage — 2026-07-07 (CAPA CA-13)

**Owner:** maintainer (triage) · MLRO (record). **Input:** the 46 open alerts
enumerated by the `Code-Scanning Alert Inventory` workflow (run 28863164319).
**Disposition classes:** FIXED (code change), SCOPED (removed from analysis with
justification), DISMISS (owner clicks *Dismiss* in Security → Code scanning with
the reason below — alert stays on record). Closes the triage half of
[CA-13](../aims/corrective-actions.md); the dismissals are the remaining owner
action.

## 1 · FIXED in code (10 alerts — auto-close on the next CodeQL run)

| # | Rule | Location | Fix |
|---|---|---|---|
| 15 | `js/incomplete-sanitization` | `scripts/reg-sources-doc.mjs:16` | Escape backslashes before pipe-escaping in the markdown cell sanitizer |
| 10 | `js/bad-tag-filter` | `scripts/reg-watch.mjs:52` | Script/style end-tag regexes now match `</script >` (trailing whitespace) |
| 88, 89 | `py/file-not-closed` | `screen.py:931, 954` | EOCN JSON/PDF reads use `with open(...)` context managers |
| 92 | `py/unused-local-variable` | `screen.py:1671` | Dropped unused `supp_ok` |
| 90, 91 | `py/unused-local-variable` | `agents.py:170, 201` | Dropped unused `companies`, `creds` |
| 87 | `py/unused-import` | `test/redteam_injection.py:28` | Dropped unused `difflib` import |
| 86 | `py/unused-import` | `test/bias_eval.py:34` | Availability probe rewritten to `importlib.util.find_spec("rapidfuzz")` (same semantics, no bare import) |
| 54 | `js/unneeded-defensive-code` | `scripts/lei-check.mjs:98` | Removed dead `!m` guard (`nameMatches` always returns an object) |

## 2 · SCOPED out of analysis (6 alerts — `paths-ignore` in codeql.yml)

`design/` (static reference mockups per `design/README.md`, not the shipped app
pages) and `test/` (fixtures/assertions whose "findings" are the test inputs):

| # | Rule | Location |
|---|---|---|
| 2, 3 | `js/xss-through-dom` | `design/assets/hs-report.js` |
| 4 | `js/xss-through-dom` | `design/assets/hs-app.js` |
| 7 | `js/missing-origin-check` | `design/assets/tweaks-panel.jsx` |
| 16 | `js/incomplete-url-substring-sanitization` | `test/link-check.test.mjs:68` (assertion on a fixture URL) |
| 84 | `js/incomplete-url-substring-sanitization` | `test/sanctions-screen.test.mjs:207` (assertion on a fixture URL) |

## 3 · DISMISS with reason (30 alerts — owner clicks; reasons below)

### Scorecard `TokenPermissionsID` (high) ×10 — reason: **"Won't fix — by design"**
> The state-committing / release workflows require `contents: write` to push
> screening fingerprints, retention snapshots and releases back to the repo;
> accepted baseline documented in `.github/zizmor.yml` (artipacked rationale).
> The everyday CI/test workflows are read-only.

Alerts: 94 (`branch-cleanup.yml` — ref deletion is its function), 82 (`visual.yml`
baseline job), 77 (`release.yml`), 76 (`auto-release.yml`), 59
(`weekly-adverse-media.yml`), 58 (`onboarding-screen.yml`), 38
(`sanctions-watch.yml`), 37 (`sanctions-screen.yml`), 35
(`regulatory-watch.yml`), 34 (`fatf-watchdog.yml`).

### Scorecard `PinnedDependenciesID` (medium) ×5 — reason: **"Won't fix — by design"**
> Exact-version `npm`/`pip` installs in a deliberately lockfile-free,
> no-runtime-deps repo; documented accepted baseline (`.github/zizmor.yml`,
> adhoc-packages rationale).

Alerts: 83, 41 (`visual.yml`), 79 (`cross-browser.yml`), 78 (`semgrep.yml`), 51
(`workflow-lint.yml`).

### Scorecard project-posture ×4
| # | Rule | Reason to record |
|---|---|---|
| 47 | `FuzzingID` | Won't fix — property/fuzz tests run in CI (`test/sanctions-match-fuzz.test.mjs`); OSS-Fuzz integration is not applicable to a static app with no runtime deps |
| 45 | `CIIBestPracticesID` | Won't fix — OpenSSF badge programme not pursued at this time |
| 44 | `MaintainedID` | False positive — flags only repo age (<90 days); the repo has daily automated + human commits |
| 43 | `CodeReviewID` | Won't fix — single-maintainer repo (documented in `.github/settings.yml`); compensating controls are the 8 required CI gates; revisit when a second maintainer joins |

### CodeQL watcher-pipeline data flows (medium) ×9 — reason: **"Won't fix — by design"**
> The watcher scripts exist to fetch the watched regulatory registries
> (`data/reg-sources.json`) and persist fingerprints/state; every write lands in
> repo-tracked files reviewed via PR, and every fetch target comes from the
> version-controlled registry — the flagged source→sink flows are the feature.

Alerts (`js/http-to-file-access`): 81, 25 (`sanctions-screen.mjs`), 80
(`advisor-bias-eval.mjs`), 29 (`advisor-eval.mjs`), 11 (`reg-draft.mjs`).
Alerts (`js/file-access-to-http`): 17 (`sanctions-watch.mjs`), 14
(`reg-watch.mjs`), 13, 12 (`reg-draft.mjs`).

### CodeQL `js/file-system-race` (high) ×2 — reason: **"Won't fix — not exploitable in context"**
> Single-writer CI scripts operating on the runner-local workspace; no
> concurrent mutator exists in the workflow model, and the written state is
> integrity-checked downstream (`retain-state` verify, PR review of committed
> state).

Alerts: 31 (`retain-state.mjs:95`), 6 (`fatf-watchdog.mjs:468`).

## 4 · Verification
- Buckets 1+2 auto-close when CodeQL next analyses `main` (push-triggered).
- Bucket 3 count trends to zero in the **daily AI Governance Report** once the
  owner records the dismissals; the report's open-alert metric is the CA-13
  closure evidence.
