/* Quarterly adverse-media methodology review — files ONE Asana task at the
   start of each quarter so the review cadence regulators expect (documented
   methodology review, FATF RBA / ISO 42001 A.6) is self-enforcing instead of
   relying on someone remembering. The task lands in Ongoing Monitoring under
   "Adverse Media & PEP Monitoring" with a two-week due date and a concrete
   checklist of what to review.

   Idempotent twice over: an exact-title check across the whole project (one
   task per quarter, ever) plus notifyAsana's own 48h re-run guard.

   Runs in GitHub Actions (.github/workflows/quarterly-review.yml).
   Needs the ASANA_ACCESS_TOKEN secret. */
import {
  notifyAsana, asanaEnabled, ensureSection, listProjectTasks, runUrl, REG_PROJECT_GID
} from './asana-notify.mjs';

export const SECTION_NAME = 'Adverse Media & PEP Monitoring';

/* "Q3 2026" for any date inside that quarter (UTC). */
export function quarterLabel(d) {
  return 'Q' + (Math.floor(d.getUTCMonth() / 3) + 1) + ' ' + d.getUTCFullYear();
}

export function buildReviewTitle(label) {
  return 'Adverse-media methodology review — ' + label;
}

/* Checklist body — everything the reviewer must confirm or change. */
export function buildReviewNotes(label, link) {
  const L = [];
  L.push('QUARTERLY ADVERSE-MEDIA METHODOLOGY REVIEW — ' + label);
  L.push('Cadence: quarterly (auto-filed). Owner: MLRO. Due: two weeks from filing.');
  L.push('');
  L.push('Review each item; record changes in git (screen.py / adverse-media.mjs):');
  L.push('');
  L.push('☐ 1. KEYWORD SETS — English red-flag terms (screen.py ADVERSE_KEYWORDS) and');
  L.push('     Arabic terms (ADVERSE_KEYWORDS_AR): any new typologies from FATF/EOCN/');
  L.push('     MoE circulars this quarter? Any term generating systematic noise?');
  L.push('☐ 2. TYPOLOGY BUCKETS — KEYWORD_TYPOLOGY mapping still matches the firm\'s');
  L.push('     risk assessment categories.');
  L.push('☐ 3. SOURCES — Google News (5 locales incl. AR/TR) + GDELT both returning');
  L.push('     results (check recent run logs for "GDELT unavailable" streaks).');
  L.push('☐ 4. EVIDENCE LOG — sample data/adverse-media-evidence.json entries: URLs');
  L.push('     still resolve, categorisation sensible, repeat-pattern escalations');
  L.push('     were actioned (90-day / 3-story rule).');
  L.push('☐ 5. THRESHOLDS — repeat-pattern window (90d) and threshold (3 stories),');
  L.push('     adverse-media degradation alarm (25%): still appropriate for the');
  L.push('     customer base size.');
  L.push('☐ 6. FALSE-POSITIVE REVIEW — sample this quarter\'s CLEAR dispositions;');
  L.push('     confirm no adverse story was wrongly dismissed.');
  L.push('');
  L.push('Sign-off (name + date): ____________________________');
  L.push('');
  L.push('Methodology changes require the model-validation sign-off procedure');
  L.push('(docs/governance/model-validation-2026.md §5).');
  if (link) L.push('\nFiled automatically — workflow run: ' + link);
  return L.join('\n');
}

async function main() {
  if (!asanaEnabled()) {
    console.error('quarterly-review: ASANA_ACCESS_TOKEN not set — cannot file the review task.');
    process.exit(3);
  }
  const label = quarterLabel(new Date());
  const title = buildReviewTitle(label);

  /* One task per quarter, ever — exact-title check across the whole project. */
  const existing = await listProjectTasks(REG_PROJECT_GID);
  const already = existing.find(t => String(t.name || '') === title);
  if (already) {
    console.log('quarterly-review: already filed — ' + title + (already.permalink_url ? ' — ' + already.permalink_url : ''));
    return;
  }

  const section = await ensureSection(REG_PROJECT_GID, SECTION_NAME);
  const due = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
  const url = await notifyAsana(title, buildReviewNotes(label, runUrl()), { project: REG_PROJECT_GID, section, due });
  console.log('quarterly-review: filed — ' + title + (url ? ' — ' + url : ''));
}

if (process.argv[1] && process.argv[1].endsWith('quarterly-review.mjs')) {
  main().catch(e => { console.error(e.message); process.exit(1); });
}
