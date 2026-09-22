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

### Config-supplied fetch URLs / redirect-following (SSRF) — reason: **"Accepted — contained by egress-block"**
> `fetchListBody` (`scripts/sanctions-screen.mjs`) and the Python engine's
> `download()` fetch sanctions-list URLs taken from the version-controlled
> registries (`data/sanctions-sources.json`, `data/sanctions-extra.json`) and
> follow HTTP redirects. Redirect-following is **load-bearing**: OFAC and the UN
> serve their list files via a 302 to a presigned storage host (S3 / Azure blob),
> so a hard host-allow-list on the fetch itself would break the primary lists.
> The exposure is instead contained at two layers already in place:
> 1. **Network egress-block** — the workflows that run these fetches
>    (`sanctions-screen`, `weekly-adverse-media`, `onboarding-screen`,
>    `sanctions-watch`, `fatf-watchdog`) run under `step-security/harden-runner`
>    with `egress-policy: block` and an explicit host allow-list, so a request to
>    any host not on that list — including a redirect target — fails at connect
>    time. The redirect *destination* is therefore host-restricted at the network
>    layer even though the application code does not enumerate it.
> 2. **Drift guard** — `test/screening-state.test.mjs` fails CI if a list's
>    primary host is allow-listed without its presigned-storage host, so the
>    allow-list and the real redirect chain cannot silently diverge.
> The application-layer scheme check (http/https only, no `file:`/`ftp:`) remains
> in `fetchListBody`. Residual risk requires an attacker who can both edit the
> in-repo source registry (a reviewed PR) **and** add the target host to the
> egress allow-list (a second reviewed change) — no single-change SSRF path.

## 4 · Verification
- Buckets 1+2 auto-close when CodeQL next analyses `main` (push-triggered).
- Bucket 3 count trends to zero in the **daily AI Governance Report** once the
  owner records the dismissals; the report's open-alert metric is the CA-13
  closure evidence.

## 5 · Addendum (2026-07-15) — zizmor baseline retired

The triage reasons above reference `.github/zizmor.yml` as the accepted-baseline
record. That file was **removed on 2026-07-15**: the six state-pushing workflows
now check out with `persist-credentials: false` and push their data branches
with an ephemeral env-token URL, and `asana-reconcile.yml` (which never pushed —
a stale suppression) was likewise switched to a credential-free checkout. The
`artipacked` suppressions therefore have nothing left to suppress, and zizmor
runs with a **zero baseline** (sole remaining accepted finding: the documented
inline `zizmor: ignore[dangerous-triggers]` in `labeler.yml`). This section is
an addendum rather than an edit because §3's dismissal texts are a point-in-time
record of what the owner clicked.

## 6 · Addendum (2026-08-05) — source-probe alerts #141/#142

The worldwide-coverage build added `scripts/source-probe.mjs` (PR #401), a
dispatch-only diagnostic that fetches sources **already configured in the
screening registry** (selected by id — the workflow input cannot aim it at an
arbitrary URL). CodeQL raised two medium `js/file-access-to-http` alerts on
its fetch: registry-file data flowing into an outbound request.

**Disposition: DISMISS (used in tested code / intended behavior).** The data
flow the query flags *is the instrument's function* — identical in kind to
the daily screen's own list fetcher, which loads the same registry and
fetches the same URLs. The mitigations are structural, not incidental: the
registry is in-repo and PR-reviewed (changing a URL is a reviewed act), the
probe validates scheme (`http(s)` only), runs with `contents: read` and **no
secrets in its environment**, and publishes evidence only to a step summary
+ artifact. Owner action: dismiss #141 and #142 in Security → Code scanning
with reason "used in tested code", citing this section — the alert record
stays, per the §3 convention.
