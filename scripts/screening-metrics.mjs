/* Screening Metrics — observability for the sanctions screening engine.

   Screening can silently DEGRADE (a normalization regression, a threshold
   drift, a list that stopped contributing hits) without ever erroring. This
   computes a metrics snapshot from data/sanctions-screen-state.json so the
   health of matching is visible run-to-run instead of invisible: the score-band
   distribution, how many subjects hit more than one list, and how many subject
   names required diacritic/transliteration folding to normalize (evidence the
   non-ASCII / Arabic / Turkish name handling is actually exercised).

   SCOPE: this reports the distribution of the engine's own decisions. TRUE
   precision/recall (false-positive / false-negative RATES) require a labelled
   ground-truth set that does not exist here, and a commercial feed such as
   Refinitiv World-Check requires a licensed API key — both are out of scope for
   this free, no-API-key pipeline and are called out, not silently omitted.

   computeMetrics is pure and offline-tested. Usage: node scripts/screening-metrics.mjs */
import { readFileSync, existsSync, appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const STATE_FILE = 'data/sanctions-screen-state.json';

const hasNonAscii = s => typeof s === 'string' && [...s].some(ch => ch.codePointAt(0) > 127);

/* Pure: derive metrics from a screen-state object. */
export function computeMetrics(state) {
  const subjects = Object.values((state && state.subjects) || {});
  const total = subjects.length;
  const byBand = {};
  const byRecommendation = {};
  const scoreBuckets = { '90-100': 0, '80-89': 0, '70-79': 0, '<70': 0 };
  let matches = 0, multiList = 0, diacriticFolded = 0;

  for (const s of subjects) {
    const band = s.band || 'none';
    byBand[band] = (byBand[band] || 0) + 1;
    const rec = s.recommendation || 'none';
    byRecommendation[rec] = (byRecommendation[rec] || 0) + 1;

    const score = typeof s.topScore === 'number' ? s.topScore : null;
    if (score != null) {
      if (score >= 90) scoreBuckets['90-100']++;
      else if (score >= 80) scoreBuckets['80-89']++;
      else if (score >= 70) scoreBuckets['70-79']++;
      else scoreBuckets['<70']++;
    }

    const lists = Array.isArray(s.lists) ? s.lists : [];
    if (band === 'high' || band === 'critical' || lists.length > 0) matches++;
    if (new Set(lists).size > 1) multiList++;
    if (hasNonAscii(s.name)) diacriticFolded++;
  }

  return { total, matches, multiList, diacriticFolded, byBand, byRecommendation, scoreBuckets, updated: (state && state.updated) || null };
}

export function buildReport(m) {
  const dist = obj => Object.keys(obj).length
    ? Object.entries(obj).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}: ${v}`).join(' · ')
    : '(none)';
  const pct = n => m.total ? ` (${Math.round((n / m.total) * 100)}%)` : '';
  return [
    `# Screening Metrics — ${m.updated || 'n/a'}`, '',
    `- Subjects screened: **${m.total}**`,
    `- Matches (high/critical band or a list hit): **${m.matches}**${pct(m.matches)}`,
    `- Multi-list corroborated hits: **${m.multiList}**`,
    `- Names requiring diacritic/transliteration folding: **${m.diacriticFolded}**${pct(m.diacriticFolded)}`,
    '',
    `**Score bands:** ${dist(m.scoreBuckets)}`,
    `**Risk bands:** ${dist(m.byBand)}`,
    `**Recommendations:** ${dist(m.byRecommendation)}`,
    '',
    '> Distribution of the engine\'s own decisions. True precision/recall needs a labelled ground-truth set, and World-Check / Refinitiv coverage needs a licensed feed — both out of scope for this free, no-API-key pipeline.',
  ].join('\n');
}

function main() {
  if (!existsSync(STATE_FILE)) {
    console.error(`screening-metrics: ${STATE_FILE} not found`);
    return;
  }
  let state;
  try { state = JSON.parse(readFileSync(STATE_FILE, 'utf8')); }
  catch (e) { console.error(`screening-metrics: ${STATE_FILE} is not valid JSON — ${e.message}`); process.exitCode = 1; return; }
  const report = buildReport(computeMetrics(state));
  console.log(report);
  if (process.env.GITHUB_STEP_SUMMARY) {
    try { appendFileSync(process.env.GITHUB_STEP_SUMMARY, report + '\n'); } catch { /* best effort */ }
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main();
}
