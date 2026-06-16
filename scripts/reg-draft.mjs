/* Regulatory Watch — optional AI draft step.

   Runs only when an ANTHROPIC_API_KEY secret is present AND reg-watch flagged
   content changes. For each changed source it fetches the current page text and
   asks Claude to draft a reviewer-facing proposal: what appears to have changed
   and which app entries (Q&A answers in assets/super-data.js / risk data in
   index.html) likely need updating, with citations. The proposal is written to
   docs/research/auto/REG-UPDATE-<date>.md and included in the pull request.

   It NEVER edits super-data.js directly — a human reviews and applies. If the
   key is missing or the API errors, it exits 0 so the (detection-only) PR still
   opens. Model id per the repo's Claude usage standard: claude-sonnet-4-6. */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { extractText, CHANGES_FILE } from './reg-watch.mjs';

const KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';
const OUT_DIR = 'docs/research/auto';

function skip(msg) { console.log('reg-draft: ' + msg + ' — skipping (detection-only PR).'); process.exit(0); }

if (!KEY) skip('no ANTHROPIC_API_KEY');
if (!existsSync(CHANGES_FILE)) skip('no changes file');

const { date, changes } = JSON.parse(readFileSync(CHANGES_FILE, 'utf8'));
if (!Array.isArray(changes) || !changes.length) skip('no content changes');

async function fetchText(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 25000);
  try {
    const res = await fetch(url, { signal: ctrl.signal, redirect: 'follow', headers: { 'user-agent': 'HawkeyeSterling-RegWatch/1.0' } });
    const body = await res.text();
    return extractText(body).slice(0, 6000);
  } catch (e) { return '(could not fetch: ' + String(e && e.message || e).slice(0, 120) + ')'; }
  finally { clearTimeout(t); }
}

async function draftFor(c) {
  const pageText = await fetchText(c.url);
  const prompt = [
    'You are a UAE-focused AML/CFT regulatory analyst. A monitored source changed. Draft a SHORT reviewer-facing proposal for an MLRO.',
    '',
    'Source: ' + c.name + ' (' + (c.jurisdiction || '') + ')',
    'URL: ' + c.url,
    '',
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
