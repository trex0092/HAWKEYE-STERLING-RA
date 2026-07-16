# GitHub Repository Hardening — Required Configuration

**Status:** authoritative configuration record
**Owner:** @trex0092 (MLRO / repository admin)
**Last reviewed:** 2026-07-16
**Companion config-as-code:** [`.github/settings.yml`](../../.github/settings.yml)

This repository ships a production AML/CFT system, so its GitHub controls are
treated as compliance controls: they must be auditable, reproducible, and not
dependent on one admin remembering to tick a box. This document is the single
authoritative record of the **required** repository configuration.

Two layers keep it honest:

1. **Config-as-code** — [`.github/settings.yml`](../../.github/settings.yml) declares
   general settings, labels, and branch protection. If the
   [Settings GitHub App](https://github.com/apps/settings) is installed, GitHub
   applies that file automatically on every push to the default branch. **Installing
   that app is the recommended way to enforce everything in Section 1 and 2 below.**
2. **This runbook** — the human procedure for the items that have **no API/file
   representation** (security toggles, environments, tag protection) and must be set
   in the GitHub UI, plus the rationale and the audit checklist.

A control is "applied" only when the checkbox in [Section 7](#7-audit-checklist) is
ticked with a date and reviewer.

---

## 1. Branch protection — `main`

Encoded in `.github/settings.yml` (`branches[main].protection`). Apply via the
Settings app, or manually at **Settings → Branches → Add branch ruleset / protect `main`**:

| Control | Required value | Why |
|---|---|---|
| Require a pull request before merging | **On** | No direct pushes to the deploy branch. |
| Required approvals | **0** (see note) | Single-maintainer reality: GitHub never counts the author's own approval, and the sole [code owner](../../.github/CODEOWNERS) *is* the author — any count > 0 made every owner-authored PR unmergeable with no admin bypass (`enforce_admins` is on). The binding controls are the required status checks below. **Raise to ≥ 1 when a second maintainer joins** (see the CHANGELOG entry "Unmergeable-by-design review rule on a single-maintainer repo" and the inline rationale in `.github/settings.yml`). |
| Dismiss stale approvals on new commits | **On** | Re-review after the diff changes (binds any future approvals). |
| Require review from Code Owners | **Off** (see note) | Same single-maintainer constraint as above — the only code owner is the PR author. **Turn back On together with required approvals ≥ 1** when a second maintainer joins. |
| Require status checks to pass | **On** | No merging on red CI. |
| Require branches up to date before merge | **On** (`strict`) | Tests run against the post-merge tree. |
| Required checks | `test`, `lint`, `smoke`, `analyze` (CodeQL), `semgrep`, `gitleaks`, `size`, `Dependency Review` | The blocking gates that prove correctness, style, runtime-CSP/Trusted-Types safety, code scanning (CodeQL + Semgrep app-invariants), secret scanning, size, and dependency licensing/vulns. |
| Require conversation resolution | **On** | No unresolved review threads at merge. |
| Require linear history | **On** | Matches squash-only merging. |
| Include administrators | **On** (`enforce_admins`) | The rules bind everyone, including admins. |
| Allow force pushes | **Off** | History is immutable. |
| Allow deletions | **Off** | `main` cannot be deleted. |

> Check names must match the **job** names exactly. If a workflow job is renamed,
> update both the ruleset and `.github/settings.yml`.

---

## 2. General repository settings

Encoded in `.github/settings.yml` (`repository:`). Apply via the Settings app, or
manually at **Settings → General**:

- **Description, homepage, topics** — populated (improves discoverability and the
  "About" panel). Topics: `aml`, `cft`, `compliance`, `sanctions-screening`,
  `pep-screening`, `risk-assessment`, `regtech`, `dpms`, `netlify`, `codeql`.
- **Merge button** — *Squash* only; *Merge commits* and *Rebase* disabled →
  linear history.
- **Automatically delete head branches** — **On** (self-cleans merged feature and
  auto-generated branches such as `visual/baseline`).
- **Allow auto-merge** — On (lets a green, approved PR merge itself).
- **Features** — Wiki / Projects / Downloads **off** (unused); Issues **on**.
- **Social preview image** — upload a branded card (**Settings → General → Social
  preview**). *UI-only; not representable in `settings.yml`.*

---

## 3. Security & analysis  *(UI-only — Settings → Code security)*

These have **no `settings.yml` representation** and must be enabled in the UI.
`enable_vulnerability_alerts` / `enable_automated_security_fixes` in `settings.yml`
cover Dependabot alerts + security PRs; the rest are manual:

- [ ] **Dependency graph** — On.
- [ ] **Dependabot alerts** — On.
- [ ] **Dependabot security updates** — On. *(Version bumps are already handled by
  [`.github/dependabot.yml`](../../.github/dependabot.yml).)*
- [ ] **Secret scanning** — On.
- [ ] **Secret scanning push protection** — On (blocks pushing a detected secret).
  *(Belt-and-braces with the `gitleaks` and GitGuardian checks already in CI.)*
- [ ] **Code scanning (CodeQL)** — confirmed green; ensure the alert view has **0
  open** alerts (see [Section 6](#6-code-scanning-alerts)).
- [ ] **Private vulnerability reporting** — On (pairs with
  [`SECURITY.md`](../../SECURITY.md) disclosure SLA + CVSS matrix).

---

## 4. Protected environments  *(UI-only — Settings → Environments)*

The release/publish automation must wait for a human. No file representation —
configure in the UI:

- [ ] Create environment **`release`** with a **required reviewer** (@trex0092 or a
  designated approver). `auto-release.yml` / `release.yml` then pause for approval
  before publishing a tag/release.
- [ ] (Optional) Gate any state-mutating watcher workflow that writes back to the
  repo behind the same or a dedicated environment.

> **Verification record, 2026-07-16 (Compliance Eng):** wiring is live on `main`:
> both `release.yml` (line 33) and `auto-release.yml` (line 32) declare
> `environment: release`. Live behaviour measured the same day: the last
> push-triggered Auto Release run before the gate (run 29479225499, started
> 07:13:56Z) began immediately and completed in 77 seconds with no hold, while a
> `workflow_dispatch` probe (run 29483261607, dispatched 08:23:01Z) entered the
> `waiting` state, its job held 82 seconds between queue (08:23:05Z) and start
> (08:24:27Z), then completed as a safe no-op because v3.7.2 was already
> released. Deployment protection on the `release` environment was therefore
> armed between 07:15 and 08:23 UTC on 2026-07-16 and now intercepts every
> release-path run. Not visible from outside the UI: whether the configured rule
> is a required reviewer (what this runbook requires) or only a wait timer, and
> who approved the probe. The owner confirms the rule type under Settings,
> Environments, release before ticking row 7 of Section 7. Operational
> consequence: every push to `main` queues an Auto Release run that holds until
> approved; on commits that do not bump `APP_VERSION` the approved run is a safe
> no-op.
>
> **Same-day follow-up (second probe):** a `workflow_dispatch` of `release.yml`
> itself (run 29484768299, deliberately invalid tag input so nothing could be
> created even if approved) was held 60 seconds between queue (08:48:13Z) and
> job start (08:49:13Z), then the tag-shape validation refused the input, red
> run, zero side effects. Together with the two post-merge Auto Release holds
> (133s and 270s), the four holds measured this day range from 60 to 270
> seconds. A fixed wait timer releases at a constant interval, so this variable
> pattern is consistent with a **required reviewer approved by a human** and
> not with a wait timer. The remaining owner act is the one-glance confirmation
> in the UI, recorded when ticking row 7 of Section 7.

---

## 5. Tag protection  *(UI-only — Settings → Tags)*

- [ ] Add a tag protection rule for **`v*`** so only maintainers can create/modify
  release tags. Protects the provenance of versioned releases (SBOM is attached per
  release in CI).

---

## 6. Code-scanning alerts

The CodeQL **workflow** is green on every recent `main` commit, which proves the
scan runs and the latest diffs introduced no new findings. Separately, confirm the
cumulative alert list is clear:

- [ ] **Security → Code scanning** shows **0 open** alerts (triage or fix any that
  appear; the two historical `js/incomplete-string-escaping` findings were fixed in
  PRs #136 and the test-file cleanup).

---

## 6a. Runner egress policy (harden-runner)

Every workflow runs `step-security/harden-runner`. The **egress** posture is
deliberately split:

- **`egress-policy: block`** (enforced, with a pinned allow-list) — the sensitive
  or predictable-egress jobs: all token-handling AML/Asana workflows, the
  high-frequency CI gates **`ci` (both jobs), `lint`, `gitleaks`,
  `dependency-review`**, `netlify-deploy` / `asana-delivery-diag`, and — promoted
  2026-07-15 with allow-lists read from their own egress-audit logs —
  **`scorecard`, `workflow-lint`, `semgrep`, `osv-scanner`** and ci's `fuzz` job.
  A compromised dependency here cannot reach an unlisted host — the run fails
  loudly instead.
- **`egress-policy: audit`** (observe-only) — jobs whose egress is broad or
  external and not safely enumerable without risking a **required** check or a
  release: `codeql` (bundle + query packs from variable hosts), the
  browser-fetching jobs `cross-browser`, `visual`, `a11y`, `lighthouse`
  (Playwright/Chrome CDNs vary; some also need sudo for apt libraries), the
  site-fetching jobs `dast-zap`, `link-check`, `site-health` (external targets
  by design), plus the release jobs (`release`, `auto-release`) whose asset
  upload + Sigstore endpoints vary. Each carries an inline "stays audit"
  comment; promote one to `block` only from its own observed egress log.

The workflow security itself is gated by **zizmor (blocking)** in
`workflow-lint.yml` with a **zero baseline** — `.github/zizmor.yml` was removed
(2026-07-15) once the state-pushing workflows switched to ephemeral env-token
pushes with `persist-credentials: false`; the only accepted finding is the
documented inline `zizmor: ignore[dangerous-triggers]` in `labeler.yml`.

---

## 7. Audit checklist

Tick with date + initials when verified in the live repo. Re-review quarterly
alongside the MLRO sign-off. The "Automated verification" column is evidence
recorded by Compliance Engineering from live probes and API reads; it does not
tick a row. "Applied" attestation (date + initials) remains the repository
owner's act, after a UI glance wherever the evidence column says so.

| # | Control | Automated verification (2026-07-16) | Applied (date / by) |
|---|---|---|---|
| 1 | Branch protection on `main` (Section 1) | PASS: branches API returns `protected: true`; all 8 required checks plus strict up-to-date enforced on every PR merged this day (#258, #259) | 2026-07-16 / @trex0092 |
| 2 | General settings: squash-only, auto-delete branches, features (Section 2) | PASS on API-visible parts: wiki/projects/downloads off, issues on; 13 consecutive squash merges in 24h, newest merge commit on `main` dates to 5 Jul (pre-rule); zero stray branches. Merge-commit/rebase disablement: owner UI glance | 2026-07-16 / @trex0092 |
| 3 | Description / topics / social preview (Section 2) | PASS for description, homepage and all 10 topics (exact match to Section 2). Social preview image: owner UI glance | 2026-07-16 / @trex0092 |
| 4 | Dependency graph + Dependabot alerts + security updates (Section 3) | PARTIAL: graph proven on (required Dependency Review check green on every PR, hard-fails without it); Dependabot version PRs merged (#214, #216). Alerts + security-updates toggles: owner UI glance | 2026-07-16 / @trex0092 |
| 5 | Secret scanning + push protection (Section 3) | No session read surface (api.github.com egress-blocked; no MCP settings endpoint). Compensating control verified: gitleaks required check green on every PR. Owner UI | 2026-07-16 / @trex0092 |
| 6 | Private vulnerability reporting (Section 3) | No session read surface. Owner UI | 2026-07-16 / @trex0092 |
| 7 | `release` environment with required reviewer (Section 4) | ACTIVE: four measured holds on 2026-07-16 (82s, 133s, 270s, 60s) across `auto-release.yml` and `release.yml`, incl. dispatch probe run 29484768299; the variable pattern matches a required reviewer approved by a human, not a fixed wait timer. Owner confirms rule type in the UI | 2026-07-16 / @trex0092 |
| 8 | Tag protection `v*` (Section 5) | No session read surface (session push path rejects all tag pushes at the transport layer, so probing proves nothing). Indirect: all 7 `v*` tags were created by the release automation; no stray tags | 2026-07-16 / @trex0092 |
| 9 | Code-scanning: 0 open alerts (Section 6) | PASS: alert-inventory run 29476614879 (2026-07-16) reports TOTAL_OPEN_ALERTS=0 | 2026-07-16 / @trex0092 |
| 10 | Settings GitHub App installed (auto-applies Sections 1–2) | No session read surface (app installations not readable). Indirect: live protection shape matches `.github/settings.yml` (8 contexts, strict). Owner confirmed installed, in session, 2026-07-16 | 2026-07-16 / @trex0092 |

> **Attestation basis, rows 1 to 10 (2026-07-16):** the repository owner
> (@trex0092) confirmed completion of the corresponding Settings actions in
> session on 2026-07-16 (confirmation recorded on Asana tasks P24 and P29), on
> top of the automated evidence in the verification column. Row 10 was attested
> the same day on the owner's follow-up in-session confirmation that the
> Settings GitHub App is installed.

### Apply-now priority (2026-07 deep-audit finding)

The checklist above is entirely UI/app-configured, and the deep audit confirmed
**every row is still un-ticked** — so the code-side hardening in this repo
currently rests on one maintainer's discipline plus the CI gates. These four are
the highest-impact and should be applied first; each closes a concrete exposure
the audit called out, and none can be set from code in this repo:

1. **Install the Settings GitHub App (#10)** — until it is installed,
   `.github/settings.yml` (branch protection, required checks, linear history) is
   *documentation only* and does **not** bind `main`. This is the keystone: it
   makes rows 1–2 real.
2. **`release` environment required reviewer (#7)**: partially closed. Both
   release paths now carry `environment: release` in the workflow file
   (`release.yml` line 33, `auto-release.yml` line 32), and deployment
   protection on that environment was observed intercepting release-path runs
   on 2026-07-16 (verification record in Section 4). Remaining for this row:
   the owner confirms in the UI that the configured rule is a **required
   reviewer**, not only a wait timer, then ticks row 7 with the date.
3. **Secret scanning + push protection (#5)** — this is the backstop now that the
   gitleaks whole-file exemptions for `screen.py` / `daily-sanctions-screen.yml`
   have been narrowed (see `.gitleaks.toml`); with push protection off, a secret
   pushed to those files relies on the periodic gitleaks job alone.
4. **Tag protection `v*` (#8)** — prevents a forged/backdated release tag from
   minting provenance for an artifact that never went through the release flow.

---

## Notes

- **Why some items are UI-only:** GitHub exposes branch protection and general
  settings to the Settings app / API, but secret-scanning toggles, environments,
  and tag protection are not representable in `settings.yml` today — hence the
  manual checklist. When GitHub adds API/app support, fold them into
  `.github/settings.yml` and delete the corresponding manual rows.
- **Change control:** edits to this file or to `.github/settings.yml` are owned by
  @trex0092 (see CODEOWNERS) and require a reviewed PR like any other change.
