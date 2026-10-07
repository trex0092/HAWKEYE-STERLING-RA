/* Regulatory Watch — optional AI draft step.

   Runs only when an ANTHROPIC_API_KEY secret is present AND reg-watch flagged
   content changes. For each changed source it fetches the current page text and
   asks Claude to draft a reviewer-facing proposal: what appears to have changed
   and which app entries (Q&A answers in assets/super-data.js / risk data in
   index.html) likely need updating, with citations. The proposal is written to
   docs/research/auto/REG-UPDATE-<date>.md and included in the pull request.

   It NEVER edits super-data.js directly — a human reviews and applies. If the
   key is missing or the API errors, it exits 0 so the (detection-only) PR still
   opens. Model id per the repo's Claude usage standard: claude-opus-5
   (override with ANTHROPIC_MODEL, e.g. claude-sonnet-5 to cut cost). */
import { writeFileSync, mkdirSync } from 'node:fs';
import { extractText, CHANGES_FILE, fetchWithFallback, parseAnalysis } from './reg-watch.mjs';

const KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-5';
const OUT_DIR = 'docs/research/auto';

function skip(msg) { console.log('reg-draft: ' + msg + ' — skipping (detection-only PR).'); process.exit(0); }

if (!KEY) skip('no ANTHROPIC_API_KEY');

async function readChangesInput() {
  if (process.stdin.isTTY) skip('no change report on stdin');
  let input = '';
  for await (const chunk of process.stdin) input += chunk;
  if (!input.trim()) skip('empty change report on stdin');
  return JSON.parse(input);
}

let date, changes;
try {
  /* The workflow pipes reg-watch-changes.json over stdin. Keeping file access
     outside this network client prevents an accidental file-to-HTTP data path
     while preserving the same reviewed public-source payload. */
  ({ date, changes } = await readChangesInput());
} catch (e) {
  skip('changes input missing/unreadable (' + String(e && e.message || e).slice(0, 120) + ')');
}
/* Draft only for real content changes — an 'unreachable' alert entry has no
   new page text to analyse; it is on the card purely to surface the gap.
   Keep the FULL list for the write-back: filter() returns the same object
   references, so severity mutations flow through, and unreachable entries
   must survive onto the card. */
const allChanges = Array.isArray(changes) ? changes : [];
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
  /* New / removed publications as the page titles and links them — the most
     precise evidence of what was issued or withdrawn. */
  const itemLines = c.items ? [
    'Publications newly listed on the page (' + c.items.addedCount + '):',
    ...c.items.added.map(l => 'NEW ITEM: "' + l.t + '" <' + l.h + '>'),
    'Publications no longer listed (' + c.items.removedCount + '):',
    ...c.items.removed.map(l => 'REMOVED ITEM: "' + l.t + '" <' + l.h + '>'),
    ''
  ] : [];
  const prompt = [
    'You are a UAE-focused AML/CFT regulatory analyst. A monitored source changed. Draft a SHORT reviewer-facing proposal for an MLRO.',
    '',
    'Source: ' + c.name + ' (' + (c.jurisdiction || '') + ')',
    'URL: ' + c.url,
    '',
    ...itemLines,
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
    'Be concise and do NOT invent article or circular numbers that are not visible in the text. This is a proposal for human review, not a final edit.',
    '',
    'Then, for the Asana review card, add exactly these five labelled lines (one line each, plain text, no Markdown).',
    'Use only facts visible in the delta, the listed items or the page text; write "not stated" when the text does not say.',
    'CHANGED: <the specific instrument / publication / entry that was added, amended or withdrawn, with its title and date as printed>',
    'IMPACT: <what it means for a UAE dealer in precious metals and stones (DPMS), or "none — routine site change">',
    'ACTION: <the concrete step to consider, e.g. re-screen customers against the updated list, update a policy section, brief staff, or "none">',
    'INSTRUMENT: <number, date and issuing authority as printed, or "not stated">',
    'EFFECTIVE: <effective / compliance date as printed, or "not stated">',
    '',
    'End your reply with exactly one final line of the form:',
    'SEVERITY: LOW|MEDIUM|HIGH — <one short reason>',
    '(HIGH = new/changed obligations, thresholds, instruments or deadlines; MEDIUM = substantive update worth review; LOW = routine site churn.)'
  ].join('\n');

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: MODEL, max_tokens: 1000, messages: [{ role: 'user', content: prompt }] })
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
for (const c of changes) {
  const text = await draftFor(c);
  const analysis = parseAnalysis(text);
  if (Object.keys(analysis).length) c.analysis = analysis;
  const m = /SEVERITY:[ \t]*(LOW|MEDIUM|HIGH)(?:[ \t]*[—-][ \t]*([^\n]*))?$/im.exec(text);
  if (m) {
    c.severity = m[1].toUpperCase();
    if (m[2]) c.severityReason = m[2].trim().slice(0, 200);
  }
  sections.push(text);
}

/* Persist the (possibly AI-refined) severities so the Asana notify step —
   which runs after this one — renders the final triage labels. */
try {
  writeFileSync(CHANGES_FILE, JSON.stringify({ date, changes: allChanges }, null, 2) + '\n');
} catch (e) {
  console.warn('reg-draft: could not write refined severities back (' + (e && e.message || e) + ')');
}

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
