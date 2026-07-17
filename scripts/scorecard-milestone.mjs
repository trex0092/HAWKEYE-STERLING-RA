/* OpenSSF Scorecard 9.0 milestone — files ONE Asana task when the Maintained
   age gate lifts (repo created 2026-06-11 ⇒ 90 days ⇒ 2026-09-09), so the
   verification step of docs/governance/scorecard-9.5-path.md happens the day
   the 9.0 becomes printable instead of relying on someone remembering.

   Idempotent twice over: a hard date guard (never files before the gate
   lifts, however the workflow is dispatched) plus an exact-title check across
   the whole project (one task for this milestone, ever — the yearly cron
   re-fire in 2027 finds the task and skips).

   Runs in GitHub Actions (.github/workflows/scorecard-milestone.yml).
   Needs the ASANA_ACCESS_TOKEN secret. Delete the workflow after the
   September 2026 verification is signed off. */
import {
  notifyAsana, asanaEnabled, ensureSection, listProjectTasks, runUrl, REG_PROJECT_GID
} from './asana-notify.mjs';

export const SECTION_NAME = 'Repository Governance';

/* The gate lifts 90 days after repo creation (2026-06-11T07:56:32Z). */
export const MILESTONE_DATE = '2026-09-09';
export const MILESTONE_TITLE =
  'OpenSSF Scorecard 9.0 verification — Maintained gate lifts (' + MILESTONE_DATE + ')';

export function gateLifted(now) {
  return (now || new Date()) >= new Date(MILESTONE_DATE + 'T08:00:00Z');
}

/* Checklist body — the verification and the exact expected-badge arithmetic. */
export function buildMilestoneNotes(link) {
  const L = [];
  L.push('SCORECARD 9.0 VERIFICATION — the Maintained 90-day age gate lifted today.');
  L.push('Owner: repository owner. Due: three days from filing.');
  L.push('Runbook: docs/governance/scorecard-9.5-path.md ("Runbook to ≥ 9.0").');
  L.push('');
  L.push('☐ 1. Ensure a Scorecard run exists AFTER ' + MILESTONE_DATE + ' 08:00 UTC');
  L.push('     (any push to main triggers one, or dispatch scorecard.yml).');
  L.push('☐ 2. Open the run\'s "Run Scorecard analysis" job log and confirm:');
  L.push('     Maintained is NO LONGER flagged (≈10), Branch-Protection reads 8,');
  L.push('     Vulnerabilities reads 10 (no new unsuppressed advisories).');
  L.push('☐ 3. Count approving reviews on the last 30 merged changesets');
  L.push('     (the Code-Review score; owner-approved Dependabot PRs count).');
  L.push('☐ 4. Check the README badge against the expected values:');
  L.push('     - No reviewed changesets, no CII registration:      ~8.8');
  L.push('     - + CII "in progress" registration (+0.05):         ~8.8-8.9');
  L.push('     - + ~9-10 reviewed changesets in the window (CR 3): 9.0-9.1  <- target');
  L.push('     - Fully reviewed window (second maintainer):        9.5-9.6');
  L.push('☐ 5. If short of 9.0: keep approving every Dependabot PR before merge');
  L.push('     (never bypass a bot-authored PR) and see the runbook\'s');
  L.push('     second-maintainer step. Each reviewed changeset in the last-30');
  L.push('     window is worth ≈ +0.07 badge.');
  L.push('');
  L.push('Asking Claude Code to "verify the scorecard runbook" performs steps 1-4.');
  L.push('');
  L.push('Sign-off (name + date): ____________________________');
  L.push('');
  L.push('After sign-off: delete .github/workflows/scorecard-milestone.yml and');
  L.push('scripts/scorecard-milestone.mjs — this milestone fires once.');
  if (link) L.push('\nFiled automatically — workflow run: ' + link);
  return L.join('\n');
}

async function main() {
  if (!asanaEnabled()) {
    console.error('scorecard-milestone: ASANA_ACCESS_TOKEN not set — cannot file the task.');
    process.exit(3);
  }
  if (!gateLifted()) {
    console.log('scorecard-milestone: gate lifts ' + MILESTONE_DATE + ' — nothing to file yet.');
    return;
  }

  /* One task for this milestone, ever — exact-title check across the project. */
  const existing = await listProjectTasks(REG_PROJECT_GID);
  const already = existing.find(t => String(t.name || '') === MILESTONE_TITLE);
  if (already) {
    console.log('scorecard-milestone: already filed — ' + MILESTONE_TITLE + (already.permalink_url ? ' — ' + already.permalink_url : ''));
    return;
  }

  const section = await ensureSection(REG_PROJECT_GID, SECTION_NAME);
  const due = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
  const url = await notifyAsana(MILESTONE_TITLE, buildMilestoneNotes(runUrl()), { project: REG_PROJECT_GID, section, due });
  console.log('scorecard-milestone: filed — ' + MILESTONE_TITLE + (url ? ' — ' + url : ''));
}

if (process.argv[1] && process.argv[1].endsWith('scorecard-milestone.mjs')) {
  main().catch(e => { console.error(e.message); process.exit(1); });
}
