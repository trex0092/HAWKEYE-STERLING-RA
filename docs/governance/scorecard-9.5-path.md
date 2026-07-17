# OpenSSF Scorecard — where the score comes from and the path to 9.0 / 9.5+

_Last updated: 2026-07-16 · Scorecard v5.3.0 · live aggregate at the time of
writing: **7.7** (verified in the 2026-07-16 run SARIF; the README badge is
served live by `api.scorecard.dev`)._

This page records the exact arithmetic behind the repo's Scorecard aggregate,
what was maximized, what is **structurally capped** and by what, and the
concrete, honest path to ≥ 9.0 and ≥ 9.5. It exists so nobody burns time
chasing points that cannot move yet — or misreads a score change (see the
2026-07-16 event below, which this page predicted).

## 2026-07-16: why the badge fell 8.1 → 7.7 (and why that is not a regression)

Until 2026-07-15 the **Branch-Protection** check could not read any rules on
`main` — no live protection existed and the workflow token cannot read what
isn't there — so the check **errored (−1) and was excluded**: no score, but
also no weight in the denominator (97.5). On 2026-07-16 the owner applied the
hardening checklist by hand (row 1: branch protection on `main`) and installed
the Settings app (row 10). The moment live rules existed, the check could read
them and began scoring: it found force-pushes and deletions blocked and PRs
required, but **0 required approvals and no code-owner review** — the
deliberate single-maintainer configuration of that time — and priced it at
**3/10**. Including 3 × 7.5 in the aggregate moved it from 787.5 / 97.5 =
8.08 → **8.1** to 810 / 105 = 7.71 → **7.7**. The timeline is verified in the
run logs: the 2026-07-15 18:23 UTC run's SARIF has no Branch-Protection
finding (still excluded); every 2026-07-16 run scores it 3.

In other words: the repo got *more* secure and the badge went *down*, because
the scorer could finally see the one weak setting. The fix is to raise the
setting, not to re-hide it — the 2026-07-16 hardening PR does exactly that
(approvals 1 + code-owner review, with the admin bypass as the documented
single-maintainer merge path; see `.github/settings.yml` and
[`github-repository-hardening.md`](github-repository-hardening.md) §1). The
Settings app re-applies `settings.yml` on merge, the `branch_protection_rule`
trigger re-runs Scorecard, and Branch-Protection is expected at **6–8**
(8 if the strict status-check tier is credited, as the current warn list
suggests) → badge **7.9–8.1**.

## How the aggregate works

The aggregate is a weighted average over the checks that ran: each check scores
0–10 and carries a risk weight — Critical = 10, High = 7.5, Medium = 5,
Low = 2.5. A check that errors (score −1) is **excluded from both sides of the
division** — exclusion is not a zero.

## Current per-check state (verified from the Scorecard run SARIF, 2026-07-16)

| Check | Score | Weight | State |
|---|---|---|---|
| Dangerous-Workflow | 10 | Critical | maxed |
| Binary-Artifacts, Token-Permissions, Signed-Releases, Dependency-Update-Tool | 10 | High | maxed |
| Pinned-Dependencies, SAST, Security-Policy, Fuzzing, Packaging | 10 | Medium | maxed |
| CI-Tests | 10 | Low | maxed |
| Vulnerabilities | 10 | High | Justified suppressions in [`ci/osv-scanner.toml`](../../ci/osv-scanner.toml) are honored by the check. Two families, both in semgrep's CI venv and both upstream-pinned: PYSEC-2026-2132 (`click==8.1.8` — semgrep pins `click~=8.1.8`; interactive `click.edit()` unreachable in CI) and, added 2026-07-17, the `mcp==1.23.3` server-transport trio GHSA-hvrp-rf83-w775 / GHSA-jpw9-pfvf-9f58 / GHSA-vj7q-gjh5-988w (fixed in mcp 1.27.2/1.28.1, but semgrep 1.169.0 hard-pins `mcp==1.23.3`; the vulnerable MCP *server* transports never start in the one-shot, egress-blocked scan job). The mcp advisories briefly read the check at 7 on 2026-07-16 22:02 (badge 8.1 → 7.9) between the advisories landing in OSV and the suppression landing. Auto-heals fully the moment semgrep re-pins (Dependabot covers `/ci` weekly). |
| **Maintained** | **0** | High | **Hard time gate** — the check returns 0 for any repo younger than 90 days regardless of activity. Created 2026-06-11 ⇒ the gate lifts ~**2026-09-09**, and with the repo's commit/issue cadence the check then scores ~10 with no action needed. |
| **Code-Review** | **0** | High | **Practice, not config** — single maintainer. GitHub does not count self-approval and the sole code owner is the author; the check looks at the last ~30 merged changesets and counts those with an approving review (0 today). It moves only as reviewed merges accumulate: the owner approving **Dependabot PRs** counts, and a **second human** reviewing everything moves it fastest. Requiring approvals in config (done 2026-07-16) does not by itself move this check. |
| CII-Best-Practices | 0 | Low | Registration at bestpractices.dev is owner-only; the proprietary `LICENSE` fails the `floss_license` passing-level MUST, capping the entry at **in progress = 2/10** (≈ +0.05 aggregate). See [`openssf-best-practices.md`](openssf-best-practices.md). |
| License | 9 | Low | 9 is the max while the license is proprietary (not FSF/OSI). Deliberate. |
| Contributors | 6 | Low | Needs contributors from ≥ 3 organizations with 5+ commits each — an organic-growth metric. |
| Branch-Protection | **3** (included since 2026-07-16) | High | Live rules became readable on 2026-07-16 (see the event section above) and the then-current approvals-0 config scored 3. **Fix in flight**: `settings.yml` now requires 1 approval + code-owner review (admin bypass = the solo merge path); expected **6–8** once the Settings app applies the merged change and Scorecard re-runs. |

**Arithmetic**: maxed checks contribute 750 over weight 75; adding License
9×2.5, Contributors 6×2.5, Branch-Protection 3×7.5 and the three zeros gives
**810 / 105 = 7.71 → badge 7.7** — exactly the live value. After the
Branch-Protection fix applies: 6 → 832.5/105 = 7.93 (badge 7.9); 8 →
847.5/105 = **8.07 (badge 8.1)**.

## The hard truth about "make it 9 now"

With Maintained and Code-Review both pinned at 0 today, the ceiling of every
other check combined — Branch-Protection at a solo-impossible 10, CII
registered, everything else already maxed — is 867.5 / 105 = 8.26 → badge
**8.3**. **No in-repo change can print 9.0 before the Maintained age gate
lifts on ~2026-09-09.** The two 0×7.5 checks cost 1.43 aggregate points
between them and neither is a configuration: one is repo age, the other is
review practice accumulated over the last ~30 merged changesets.

## Reaching 8.5 — the near milestone

| Route | What happens | When | Expected badge |
|---|---|---|---|
| **A — automatic** | The Maintained 90-day age gate lifts (repo created 2026-06-11); with the normal commit/issue cadence the check jumps 0 → ~10. With Branch-Protection fixed at 8 that is 922.5/105 = 8.79 | **~2026-09-09**, no action | **~8.8** |
| **B — fast (owner process)** | A second reviewer approves PRs before merge (Dependabot PRs count). At ~15 approved of the last 30 changesets, Code-Review reads 5 → 885/105 = 8.43; at ~18, 8.5 prints | ~2–3 weeks of reviewed merges at the current near-daily cadence | **8.5** |

Optional garnish for margin: CII "in progress" registration (+0.05, owner-only,
~2 min — evidence pack ready in
[`openssf-best-practices.md`](openssf-best-practices.md)).

What the 2026-07-15 hardening PR does for this: nothing mechanical was left to
gain, so it **protects the twelve 10s** the routes above stand on — zizmor now
gates with a zero suppression baseline (ephemeral-token state pushes), the
security tooling runs egress-blocked with observed allowlists, npm installs
ignore dependency scripts, and the container gained non-root + edge-header
parity with a PR-time smoke gate. A regression in any 10 before September
would cost more than either route gains.

## The path to ≥ 9.5 (in order of when each step can happen)

1. **Done (verified 2026-07-14)** — Vulnerabilities remediated (the
   `ci/osv-scanner.toml` suppression is honored; reads 10). Everything
   mechanical was at ceiling; the aggregate read 8.1 until the 2026-07-16
   Branch-Protection inclusion event (see top of page).
2. **Done (2026-07-16, this PR)** — Branch-Protection raised at the source:
   approvals 1 + code-owner review required, admin bypass documented as the
   solo merge path. Expected 3 → 6–8 on the first run after the Settings app
   applies the merge; badge 7.7 → **7.9–8.1**.
3. **~2026-09-09 (automatic)** — Maintained gate lifts at 90 days of repo age:
   0 → ~10, aggregate → **~8.8**. No action required; keep the normal
   commit/issue cadence.
4. **Review practice (human step — the big one)** — the config now *requires*
   reviews; what remains is a human to give them. Approve every Dependabot PR
   instead of bypassing (works today, solo), and add one trusted second
   maintainer who approves every PR before merge. Code-Review climbs as the
   last-30-changeset window fills: ~9–10 approved changesets ⇒ Code-Review 3
   ⇒ **9.0–9.1 prints on Sept 9**; a fully reviewed window (Code-Review
   9–10) ⇒ **9.5–9.6**. A reviewer from a third organization with 5+ commits
   also lifts Contributors 6 → 10 for extra margin.
5. **Optional garnish** — CII "in progress" registration (+0.05, owner-only),
   an FSF/OSI license would lift License to 10 and the CII cap entirely — but
   that is a business decision, not a hygiene task.

**What ≥ 9.5 is NOT reachable by**: more workflows, more pinning, more
scanners, more docs — every check those feed is already at 10. The remaining
points are time (Maintained), a second human (Code-Review), and community
breadth (Contributors). Any tooling that claims otherwise is gaming the badge.

## Runbook to ≥ 9.0 (moved here from tracking issue #228 so the issues tab stays clear)

- [x] **2026-07-16 — raise Branch-Protection at the source** (this PR):
  approvals 1 + code-owner review in `settings.yml`, admin bypass documented.
  After merge, confirm the next Scorecard run reads Branch-Protection 6–8 and
  the badge 7.9–8.1.
- [ ] **Now (2 min, owner-only):** register at bestpractices.dev (evidence pack:
  [`openssf-best-practices.md`](openssf-best-practices.md)) → CII "in progress" (+0.05).
- [ ] **Habit, from today (owner):** approve every Dependabot PR before
  merging it — never bypass a bot-authored PR. Each approved changeset in the
  last-30 window is worth ≈ +0.024 aggregate; ~9–10 in the window reads
  Code-Review 3, the margin that turns Sept 9 from 8.8 into 9.0.
- [ ] **By mid-August (the lever):** add one trusted second maintainer; they
  approve every PR before merge. The repo merges PRs near-daily, so the
  last-30-changeset window refills in ~2–3 weeks of reviewed merges. The
  config is already review-ready — when they join, also restore
  `enforce_admins: true` and retire the bypass. A reviewer whose profile
  belongs to a third organization who lands 5+ commits also lifts
  **Contributors** 6→10.
- [ ] **2026-09-09:** Maintained lifts automatically — nothing to do. The
  verification task below **auto-files in Asana that morning**
  (`.github/workflows/scorecard-milestone.yml`, 10:17 UTC, idempotent; delete
  the workflow after sign-off).
- [ ] **On/after 2026-09-09 — verify the flip (~5 min):** open the latest
  Scorecard workflow run log (per-check JSON in the "Run Scorecard analysis"
  step) or `https://api.scorecard.dev/projects/github.com/trex0092/HAWKEYE-STERLING-RA`;
  confirm Maintained ≈ 10 and the aggregate against the table below. Asking
  Claude Code to "verify the scorecard runbook" on/after Sept 9 performs this
  whole step (the auto-filed Asana task carries the same checklist).
- Note: the old "keep the Branch-Protection admin PAT unwired" advice is
  retired — the check reads the live rules by itself since 2026-07-16; no PAT
  is needed or useful either way.

| Scenario | Expected Sept 9 badge |
|---|---|
| No further action (Branch-Protection fix merged, nothing else) | 8.8 |
| + CII registration + ~9–10 approved changesets in the window | **9.0–9.1** |
| + all merges reviewed from mid-August (+ Contributors) | **~9.5–9.6** |
