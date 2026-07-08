/* Regulatory Watch — optional AI draft step.

   Runs only when an ANTHROPIC_API_KEY secret is present AND reg-watch flagged
   content changes. For each changed source it fetches the current page text and
   asks Claude to draft a reviewer-facing proposal: what appears to have changed
   and which app entries (Q&A answers in assets/super-data.js / risk data in
   index.html) likely need updating, with citations. The proposal is written to
   docs/research/auto/REG-UPDATE-<date>.md and included in the pull request.

   It NEVER edits super-data.js directly — a human reviews and applies. If the
   key is missing or the API errors, it exits 0 so the (detection-only) PR still
   opens. Model id per the repo's Claude usage standard: claude-opus-4-8
   (override with ANTHROPIC_MODEL, e.g. claude-sonnet-4-6 to cut cost). */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { extractText, CHANGES_FILE, fetchWithFallback } from './reg-watch.mjs';

const KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-4-8';
const OUT_DIR = 'docs/research/auto';

function skip(msg) { console.log('reg-draft: ' + msg + ' — skipping (detection-only PR).'); process.exit(0); }

if (!KEY) skip('no ANTHROPIC_API_KEY');
if (!existsSync(CHANGES_FILE)) skip('no changes file');

let date, changes;
try {
  ({ date, changes } = JSON.parse(readFileSync(CHANGES_FILE, 'utf8')));
} catch (e) {
  skip('changes file unreadable (' + String(e && e.message || e).slice(0, 120) + ')');
}
/* Draft only for real content changes — an 'unreachable' alert entry has no
   new page text to analyse; it is on the card purely to surface the gap. */
if (Array.isArray(changes)) changes = changes.filter(c => c.status === 'new' || c.status === 'changed');
if (!Array.isArray(changes) || !changes.length) skip('no content changes');

async function fetchText(url) {
  /* Same direct→wayback fetch chain as the watcher, so bot-blocked sources
     that were fingerprinted via a snapshot can be drafted from it too. */
  const res = await fetchWithFallback(url);
  if (!res.ok) return '(could not fetch: ' + String(res.error || ('HTTP ' + res.status)).slice(0, 120) + ')';
  return extractText(res.body).slice(0, 6000);
}

async function draftFor(c) {
  const pageText = await fetchText(c.url);
  /* When the watcher itemised the change, hand the actual additions/deletions
     to the analyst prompt — a draft grounded in the delta beats one guessing
     from the full page. */
  const delta = c.diff ? [
    'Detected delta (' + c.diff.addedCount + ' added / ' + c.diff.removedCount + ' removed segments):',
    ...c.diff.added.map(s => 'ADDED: "' + s + '"'),
    ...c.diff.removed.map(s => 'REMOVED: "' + s + '"'),
    ''
  ] : [];
  const prompt = [
    'You are a UAE-focused AML/CFT regulatory analyst. A monitored source changed. Draft a SHORT reviewer-facing proposal for an MLRO.',
    '',
    'Source: ' + c.name + ' (' + (c.jurisdiction || '') + ')',
    'URL: ' + c.url,
    '',
    ...delta,
    'Current page text (extracted, truncated):',
    '"""',
    pageText,
    '"""',
    '',
    'Write Markdown with exactly these sections:',
    '### ' + c.name,
    '- **What appears to have changed**: 1-3 bullets, factual, no speculation. If the change looks like routine site churn, say so.',
    '- **Likely app impact**: which Regulatory Q&A topics/answers or Super Tools citations in assets/super-data.js, or country/risk data in index.html, may need updating.',
    '- **Suggested citation**: the instrument/title to cite if an update is warranted.',
    '',
    'Be concise and do NOT invent article or circular numbers that are not visible in the text. This is a proposal for human review, not a final edit.'
  ].join('\n');

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: MODEL, max_tokens: 700, messages: [{ role: 'user', content: prompt }] })
    });
    if (!res.ok) return '### ' + c.name + '\n_AI draft unavailable (HTTP ' + res.status + '). Review manually: ' + c.url + '_';
    const data = await res.json();
    const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
    return text || ('### ' + c.name + '\n_AI returned no text. Review manually: ' + c.url + '_');
  } catch (e) {
    return '### ' + c.name + '\n_AI draft errored (' + String(e && e.message || e).slice(0, 120) + '). Review manually: ' + c.url + '_';
  }
}

const sections = [];
for (const c of changes) sections.push(await draftFor(c));

const doc = [
  '# Regulatory update proposal — ' + date,
  '',
  '> AI-drafted from monitored-source changes for **human review**. Nothing here is applied automatically. Verify against the primary source before editing `assets/super-data.js` or `index.html`.',
  '',
  sections.join('\n\n'),
  ''
].join('\n');

mkdirSync(OUT_DIR, { recursive: true });
const file = OUT_DIR + '/REG-UPDATE-' + date + '.md';
writeFileSync(file, doc);
console.log('reg-draft: wrote ' + file + ' (' + changes.length + ' source(s)).');
