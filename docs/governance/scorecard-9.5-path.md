# OpenSSF Scorecard — where the score comes from and the path to 9.5+

_Last updated: 2026-07-14 · Scorecard v5.3.0 · live aggregate at the time of
writing: **8.0** (README badge is served live by `api.scorecard.dev`)._

This page records the exact arithmetic behind the repo's Scorecard aggregate,
what was maximized, what is **structurally capped** and by what, and the
concrete, honest path to ≥ 9.5. It exists so nobody burns time chasing points
that cannot move yet — or, worse, "fixes" a check in a way that lowers the
aggregate (see Branch-Protection below).

## How the aggregate works

The aggregate is a weighted average over the checks that ran: each check scores
0–10 and carries a risk weight — Critical = 10, High = 7.5, Medium = 5,
Low = 2.5. A check that errors (score −1) is **excluded from both sides of the
division** — exclusion is not a zero.

## Current per-check state (verified from the Scorecard run log, 2026-07-14)

| Check | Score | Weight | State |
|---|---|---|---|
| Dangerous-Workflow | 10 | Critical | maxed |
| Binary-Artifacts, Token-Permissions, Signed-Releases, Dependency-Update-Tool | 10 | High | maxed |
| Pinned-Dependencies, SAST, Security-Policy, Fuzzing, Packaging | 10 | Medium | maxed |
| CI-Tests | 10 | Low | maxed |
| Vulnerabilities | 9 | High | PYSEC-2026-2132 (`click==8.1.8`, semgrep's CI venv). **Not fixable by upgrade**: semgrep — including the latest 1.169.0 — pins `click~=8.1.8`, so the fixed 8.3.3 cannot resolve. Remediated with a justified, documented suppression in [`ci/osv-scanner.toml`](../../ci/osv-scanner.toml) (the vulnerable `click.edit()` is an interactive-editor path unreachable in the non-interactive CI job). If the scanner honors the suppression this check reads 10; either way it auto-heals the moment semgrep unpins click (Dependabot covers `/ci` weekly). |
| **Maintained** | **0** | High | **Hard time gate** — the check returns 0 for any repo younger than 90 days regardless of activity. Created 2026-06-11 ⇒ the gate lifts ~**2026-09-09**, and with the repo's commit/issue cadence the check then scores ~10 with no action needed. |
| **Code-Review** | **0** | High | **Structural** — single maintainer. GitHub does not count self-approval and the sole code owner is the author, so required-approvals is deliberately 0 (see [`github-repository-hardening.md`](github-repository-hardening.md) §1 and `.github/settings.yml`). The check looks at the last ~30 changesets; it only moves when a **second human** reviews and approves PRs. |
| CII-Best-Practices | 0 | Low | Registration at bestpractices.dev is owner-only; the proprietary `LICENSE` fails the `floss_license` passing-level MUST, capping the entry at **in progress = 2/10** (≈ +0.05 aggregate). See [`openssf-best-practices.md`](openssf-best-practices.md). |
| License | 9 | Low | 9 is the max while the license is proprietary (not FSF/OSI). Deliberate. |
| Contributors | 6 | Low | Needs contributors from ≥ 3 organizations with 5+ commits each — an organic-growth metric. |
| Branch-Protection | −1 (excluded) | High | The default workflow token cannot read branch-protection rules, so the check errors and is excluded. **Deliberately left unwired** — see below. |

**Arithmetic**: maxed checks contribute 675 over weight 67.5; adding
Vulnerabilities 9×7.5, License 9×2.5, Contributors 6×2.5 and the three zeros
gives **780 / 97.5 = 8.0** — exactly the badge.

## Why NOT to "fix" Branch-Protection with an admin PAT

Wiring a fine-grained PAT (`administration:read`) as the scorecard job's
`repo_token` would let the check run — and **lower the aggregate**. With
required approvals legitimately at 0 (single maintainer), Branch-Protection
scores ≲ 5, and an included 5×7.5 drags the average below 8.0, where the
current exclusion simply removes the 7.5 weight. Leave it unwired until the
repo has a second maintainer and approvals ≥ 1; then the same PAT is worth
adding.

## The path to ≥ 9.5 (in order of when each step can happen)

1. **Now (this change)** — Vulnerabilities remediated (suppression or, later,
   the upstream unpin): aggregate → **~8.08–8.1**. Everything mechanical is at
   ceiling.
2. **~2026-09-09 (automatic)** — Maintained gate lifts at 90 days of repo age:
   0 → ~10, aggregate → **~8.8–8.9**. No action required; keep the normal
   commit/issue cadence.
3. **Second maintainer joins (human step — the big one)** — flip required
   approvals to ≥ 1 + code-owner review On (both documented as ready-to-raise),
   have every PR approved before merge. Code-Review climbs as the last-30
   changeset window fills with approved changesets; at Code-Review ≈ 7 the
   aggregate crosses **9.5** (with everything above in place). This also
   unlocks wiring the Branch-Protection PAT for further headroom.
4. **Optional garnish** — CII "in progress" registration (+0.05, owner-only),
   Contributors organic growth (+ up to 0.1), an FSF/OSI license would lift
   License to 10 and the CII cap entirely — but that is a business decision,
   not a hygiene task.

**What ≥ 9.5 is NOT reachable by**: more workflows, more pinning, more
scanners, more docs — every check those feed is already at 10. The remaining
points are time (Maintained), a second human (Code-Review), and community
breadth (Contributors). Any tooling that claims otherwise is gaming the badge.

## Runbook to ≥ 9.0 (moved here from tracking issue #228 so the issues tab stays clear)

- [ ] **Now (2 min, owner-only):** register at bestpractices.dev (evidence pack:
  [`openssf-best-practices.md`](openssf-best-practices.md)) → CII "in progress" (+0.05).
- [ ] **By mid-August (the lever):** add one trusted second maintainer; they
  approve every PR before merge (Dependabot PRs count). The repo merges PRs
  near-daily, so the last-30-changeset window refills in ~2–3 weeks of reviewed
  merges. Then flip `required_approving_review_count: 1` + code-owner review ON
  ([`github-repository-hardening.md`](github-repository-hardening.md) §1 and
  `.github/settings.yml` are written ready-to-raise). A reviewer whose profile
  belongs to a third organization who lands 5+ commits also lifts
  **Contributors** 6→10.
- [ ] **2026-09-09:** Maintained lifts automatically — nothing to do.
- [ ] **On/after 2026-09-09 — verify the flip (~5 min):** open the latest
  Scorecard workflow run log (per-check JSON in the "Run Scorecard analysis"
  step) or `https://api.scorecard.dev/projects/github.com/trex0092/HAWKEYE-STERLING-RA`;
  confirm Maintained ≈ 10 and the aggregate against the table below. Asking
  Claude Code to "verify the scorecard runbook" on/after Sept 9 performs this
  whole step.
- [ ] **Keep NOT wiring** the Branch-Protection admin PAT (see above).

| Scenario | Expected Sept 9 badge |
|---|---|
| No action | 8.8–8.9 |
| + CII registration + ~6 reviewed changesets in the window | **9.0–9.1** |
| + all merges reviewed from mid-August (+ Contributors) | **~9.5–9.6** |
