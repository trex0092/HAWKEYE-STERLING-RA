/* Offline unit tests for the pure parts of scripts/scorecard-milestone.mjs. */
import {
  gateLifted, buildMilestoneNotes, MILESTONE_DATE, MILESTONE_TITLE, SECTION_NAME
} from '../scripts/scorecard-milestone.mjs';

let passed = 0, failed = 0;
function check(name, cond) {
  if (cond) { passed++; console.log('  ok  ' + name); }
  else { failed++; console.error('  FAIL ' + name); }
}

check('milestone is 90 days after repo creation (2026-06-11 → 2026-09-09)',
  MILESTONE_DATE === '2026-09-09');
check('date guard holds before the gate lifts (never files early, even on manual dispatch)',
  gateLifted(new Date(Date.UTC(2026, 7, 31))) === false
  && gateLifted(new Date(Date.UTC(2026, 8, 9, 7, 0))) === false);
check('date guard opens once the gate lifts and stays open (2027 re-fire dedups by title instead)',
  gateLifted(new Date(Date.UTC(2026, 8, 9, 8, 0))) === true
  && gateLifted(new Date(Date.UTC(2027, 8, 9, 10, 17))) === true);
check('title embeds the milestone date (the forever-dedup key)',
  MILESTONE_TITLE.includes(MILESTONE_DATE) && MILESTONE_TITLE.includes('9.0'));

const notes = buildMilestoneNotes('https://example/run');
check('checklist covers the run, the per-check reads, the review count and the badge table',
  ['Scorecard run exists AFTER', 'Maintained is NO LONGER flagged', 'Branch-Protection reads 8',
   'Vulnerabilities reads 10', 'last 30 merged changesets', 'README badge']
    .every(h => notes.includes(h)));
check('badge table states the 9.0 target and both fallback rows',
  notes.includes('9.0-9.1') && notes.includes('~8.8') && notes.includes('9.5-9.6'));
check('remediation names the Dependabot-approval habit and the runbook',
  notes.includes('Dependabot PR') && notes.includes('scorecard-9.5-path.md'));
check('self-destruct instruction present (workflow fires once by design)',
  notes.includes('delete .github/workflows/scorecard-milestone.yml'));
check('sign-off line present', notes.includes('Sign-off'));
check('run link is embedded when provided', notes.includes('https://example/run'));
check('section constant routes to the governance column', SECTION_NAME === 'Repository Governance');

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
