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
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { extractText, CHANGES_FILE, fetchWithFallback, parseAnalysis } from './reg-watch.mjs';
import {
  draftBudget, validatedReportDate, boundedLines, boundedItems,
  evidenceCount, missingExcerptNotice,
  manualDraftSection, approvedWatchSource, approvedWatchSourceDetails,
  deferredDraftCause, providerStopReason, usageCounts
} from './reg-draft-budget.mjs';

const KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-5';
const OUT_DIR = 'docs/research/auto';
const BUDGET = draftBudget(process.env);
const APPROVED_SOURCES = JSON.parse(readFileSync(new URL('../data/reg-sources.json', import.meta.url), 'utf8')).sources;

function skip(msg) { console.log('reg-draft: ' + msg + ' — skipping (detection-only PR).'); process.exit(0); }

if (!KEY) skip('no ANTHROPIC_API_KEY');

async function readChangesInput() {
  if (process.stdin.isTTY) skip('no change report on stdin');
  let input = '';
  for await (const chunk of process.stdin) {
    input += chunk;
    if (input.length > 2_000_000) throw new Error('change report exceeds 2 MB bound');
  }
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
if (!validatedReportDate(date)) skip('invalid report date (YYYY-MM-DD required)');
/* Draft only for real content changes — an 'unreachable' alert entry has no
   new page text to analyse; it is on the card purely to surface the gap.
   Keep the FULL list for the write-back: filter() returns the same object
   references, so severity mutations flow through, and unreachable entries
   must survive onto the card. */
const allChanges = Array.isArray(changes) ? changes : [];
if (Array.isArray(changes)) {
  changes = changes.filter(c => c && typeof c === 'object' &&
    (c.status === 'new' || c.status === 'changed'));
}
if (!Array.isArray(changes) || !changes.length) skip('no content changes');

async function fetchText(url) {
  /* Same direct→wayback fetch chain as the watcher, so bot-blocked sources
     that were fingerprinted via a snapshot can be drafted from it too. */
  try {
    const res = await fetchWithFallback(url);
    if (!res || !res.ok) return { ok: false, text: '' };
    const text = extractText(res.body).slice(0, BUDGET.pageChars);
    return { ok: !!text.trim(), text };
  } catch (_) {
    return { ok: false, text: '' };
  }
}

async function draftFor(c) {
  if (!approvedWatchSource(c, APPROVED_SOURCES)) {
    return { text: manualDraftSection(c, 'source not approved'), ok: false, attempted: false };
  }
  const page = await fetchText(c.url);
  /* No upstream model call when the primary/archived page could not be
     retrieved: the AI would otherwise be asked to invent the update. */
  if (!page.ok) {
    return { text: manualDraftSection(c, 'input source unavailable'), ok: false, attempted: false };
  }
  const pageText = page.text;
  /* When the watcher itemised the change, hand the actual additions/deletions
     to the analyst prompt — a draft grounded in the delta beats one guessing
     from the full page. */
  const delta = c.diff && typeof c.diff === 'object' && !Array.isArray(c.diff) ? [
    'Detected delta (' + evidenceCount(c.diff.addedCount, c.diff.added) +
      ' added / ' + evidenceCount(c.diff.removedCount, c.diff.removed) + ' removed segments):',
    ...boundedLines(c.diff.added, 'ADDED: ', BUDGET.listEntries, BUDGET.entryChars),
    ...missingExcerptNotice(c.diff.addedCount, c.diff.added, 'added segments'),
    ...boundedLines(c.diff.removed, 'REMOVED: ', BUDGET.listEntries, BUDGET.entryChars),
    ...missingExcerptNotice(c.diff.removedCount, c.diff.removed, 'removed segments'),
    ''
  ] : [];
  /* New / removed publications as the page titles and links them — the most
     precise evidence of what was issued or withdrawn. */
  const itemLines = c.items && typeof c.items === 'object' && !Array.isArray(c.items) ? [
    'Publications newly listed on the page (' +
      evidenceCount(c.items.addedCount, c.items.added) + '):',
    ...boundedItems(c.items.added, 'NEW ITEM: ', BUDGET.listEntries, BUDGET.entryChars),
    ...missingExcerptNotice(c.items.addedCount, c.items.added, 'new publication items'),
    'Publications no longer listed (' +
      evidenceCount(c.items.removedCount, c.items.removed) + '):',
    ...boundedItems(c.items.removed, 'REMOVED ITEM: ', BUDGET.listEntries, BUDGET.entryChars),
    ...missingExcerptNotice(c.items.removedCount, c.items.removed, 'removed publication items'),
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

  /* Bound each paid request, including the time spent reading the response.
     Never retry blindly: a 429/quota failure would repeat for every source. */
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), BUDGET.timeoutMs);
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      signal: ctrl.signal,
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: MODEL, max_tokens: BUDGET.maxTokens, messages: [{ role: 'user', content: prompt }]
      })
    });
    if (!res.ok) {
      /* Error body is examined only for broad category detection and NEVER
         logged, stored in the proposal or surfaced to the caller. */
      const detail = await res.text().catch(() => '');
      const reason = providerStopReason(res.status, detail.slice(0, 2048));
      console.warn('reg-draft: Anthropic request stopped: HTTP ' + res.status + ' (' + reason + ')');
      return { text: manualDraftSection(c, reason), ok: false, attempted: true,
        halt: true, haltReason: reason };
    }
    const data = await res.json();
    const text = ((data && Array.isArray(data.content)) ? data.content : [])
      .filter(b => b && b.type === 'text' && typeof b.text === 'string')
      .map(b => b.text).join('\n').trim();
    if (!text || data.stop_reason === 'max_tokens') {
      return {
        text: manualDraftSection(c, 'provider empty or truncated response'),
        ok: false, attempted: true, usage: usageCounts(data && data.usage)
      };
    }
    return { text, ok: true, attempted: true, usage: usageCounts(data.usage) };
  } catch (_) {
    console.warn('reg-draft: API timeout/network failure; no further billable calls in this run');
    return {
      text: manualDraftSection(c, 'provider timeout or network failure'),
      ok: false, attempted: true, halt: true,
      haltReason: 'provider timeout or network failure'
    };
  } finally {
    clearTimeout(timer);
  }
}

const sections = [];
const usageTotal = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
let apiCalls = 0, successful = 0, deferred = 0, providerHaltReason = null;
for (const c of changes) {
  if (!c || typeof c !== 'object') continue;
  const reviewed = approvedWatchSourceDetails(c, APPROVED_SOURCES);
  // Canonical source metadata is derived from the reviewed registry on EVERY
  // path, including provider-paused and locally budget-exhausted entries.
  const trusted = reviewed ? { ...c, ...reviewed } : null;
  const reason = deferredDraftCause(providerHaltReason, apiCalls, BUDGET.maxCalls);
  const result = !trusted
    ? { text: manualDraftSection(null, 'source not approved'), ok: false, attempted: false }
    : reason
      ? { text: manualDraftSection(trusted, reason), ok: false, attempted: false }
      : await draftFor(trusted);
  if (result.attempted) apiCalls++;
  if (result.ok) successful++; else deferred++;
  if (result.halt) providerHaltReason = result.haltReason || 'provider error';
  if (result.usage) for (const key of Object.keys(usageTotal)) usageTotal[key] += result.usage[key];
  const text = result.text;
  /* Only a COMPLETE provider response may propose a severity adjustment. */
  if (result.ok) {
    const analysis = parseAnalysis(text);
    if (Object.keys(analysis).length) c.analysis = analysis;
    const m = /SEVERITY:[ \t]*(LOW|MEDIUM|HIGH)(?:[ \t]*[—-][ \t]*([^\n]*))?$/im.exec(text);
    if (m) {
      c.severity = m[1].toUpperCase();
      if (m[2]) c.severityReason = m[2].trim().slice(0, 200);
    }
  }
  sections.push(text);
}
console.log('reg-draft: provider calls=' + apiCalls + '/' + BUDGET.maxCalls +
  ' successful=' + successful + ' manual-review=' + deferred +
  ' tokens=input:' + usageTotal.input + ',output:' + usageTotal.output +
  ',cacheRead:' + usageTotal.cacheRead + ',cacheWrite:' + usageTotal.cacheWrite);

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
