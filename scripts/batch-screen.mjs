#!/usr/bin/env node
/* Ad-hoc batch name screening — screen an arbitrary list of names against the
   SAME lists and matcher the daily control uses, with NO Asana dependency and
   NO state: prospects, walk-in customers, supplier shortlists, or any name
   the analyst wants checked before it ever reaches the Customer Database.

   Usage:
     node scripts/batch-screen.mjs names.csv            # report to stdout
     node scripts/batch-screen.mjs names.csv -o out.md  # report to a file
   Input: a CSV whose header row names a `name` column (any other columns are
   ignored), or a plain list with one name per line. UTF-8.

   Doctrine (inherited from the daily control):
   - Degrade loudly: if the core lists cannot load, the run EXITS RED — an
     ad-hoc screen against missing lists must never print a clean report.
   - A possible name match is not confirmation: results carry the same
     four-eyes / identifier-disambiguation note as the daily report.
   - This tool reads lists and prints a report. It writes no state, opens no
     cases, and never contacts Asana. */
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { buildIndex, screenName } from './sanctions-match.mjs';
import {
  loadSanctionsLists, resolveThreshold, resolvePhoneticMode,
  SANCTIONS_SOURCES_FILE, GOVERNANCE_NOTE,
} from './sanctions-screen.mjs';

/* Parse the input into names. Header-aware CSV (a `name` column) or one name
   per line; blank lines and a lone header row are dropped. Pure. */
export function parseNamesInput(text) {
  const lines = String(text || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (!lines.length) return [];
  const header = lines[0].toLowerCase().split(',').map(c => c.trim().replace(/^"|"$/g, ''));
  const nameCol = header.indexOf('name');
  if (nameCol >= 0 && header.length >= 1) {
    return lines.slice(1)
      .map(l => (l.split(',')[nameCol] || '').trim().replace(/^"|"$/g, ''))
      .filter(Boolean);
  }
  return lines.map(l => (l.split(',')[0] || '').trim().replace(/^"|"$/g, '')).filter(Boolean);
}

/* Markdown report from screen results. Pure — offline-testable. */
export function buildBatchReport(rows, meta) {
  const L = [];
  const A = (s) => L.push(s);
  A(`# Ad-hoc Batch Screening Report — ${meta.date}`);
  A('');
  A('Prepared for the MLRO and Compliance function. Automated detection;');
  A('every determination remains subject to human review (four-eyes).');
  A('');
  A(`Names screened: ${rows.length} · Match threshold: ${meta.threshold} · `
    + `Lists loaded: ${meta.listsLoaded}${meta.failures.length ? ` · LISTS FAILED: ${meta.failures.length}` : ''}`);
  if (meta.failures.length) {
    A('');
    A('> ⚠ Reduced coverage — the following lists did NOT load and their');
    A('> designations were NOT screened: ' + meta.failures.join('; '));
  }
  A('');
  const flagged = rows.filter(r => r.lists && r.lists.length);
  A(`**${flagged.length} of ${rows.length} name(s) returned a potential match.**`);
  A('');
  A('| Name | Result | Band | Score | Matched on |');
  A('| --- | --- | --- | --- | --- |');
  /* Escape backslashes BEFORE pipes: a value containing "\|" would otherwise
     re-arm the pipe after escaping and garble the table row (CodeQL js/
     incomplete-sanitization). */
  const cell = (v) => String(v ?? '').replace(/\\/g, '\\\\').replace(/\|/g, '\\|');
  for (const r of rows) {
    const hits = (r.lists || []).map(h =>
      `${h.list} — "${h.hitName}" (${h.score}${h.confidence ? ` · ${h.confidence}` : ''}${h.mechanism ? ` · ${h.mechanism}` : ''})`).join('<br>');
    A(`| ${cell(r.name)} | ${cell(r.lists && r.lists.length ? r.recommendation : 'clear')} | `
      + `${cell(r.lists && r.lists.length ? r.band : '—')} | ${cell(r.lists && r.lists.length ? r.topScore : '—')} | ${cell(hits || 'no list match')} |`);
  }
  A('');
  A(meta.governanceNote || '');
  A('');
  A('This is an ad-hoc screening record: it opens no cases and updates no');
  A('state. If a screened name becomes a customer, the daily control takes');
  A('over from onboarding. Retain with the file it was produced for.');
  return L.join('\n');
}

async function main(argv) {
  if (!argv.length || argv[0] === '-h' || argv[0] === '--help') {
    console.log('usage: node scripts/batch-screen.mjs <names.csv|names.txt> [-o report.md]');
    return 0;
  }
  const path = argv[0];
  let out = null;
  const oi = argv.indexOf('-o');
  if (oi >= 0) {
    if (oi + 1 >= argv.length) { console.error('error: -o needs a path'); return 2; }
    out = argv[oi + 1];
  }
  let names;
  try { names = parseNamesInput(readFileSync(path, 'utf8')); }
  catch (e) { console.error('error: cannot read input: ' + (e && e.message || e)); return 2; }
  if (!names.length) { console.error('error: no names found in input'); return 2; }

  const cfg = {
    sourcesFile: SANCTIONS_SOURCES_FILE,
    extraFile: process.env.SANCTIONS_EXTRA_FILE || 'data/sanctions-extra.json',
    listTimeoutMs: Number(process.env.SCREEN_LIST_TIMEOUT_MS) || 60000,
  };
  const threshold = resolveThreshold(process.env.SCREEN_MATCH_THRESHOLD);
  const phonMode = resolvePhoneticMode(process.env.SCREEN_PHONETIC);
  console.error(`batch-screen: loading lists for ${names.length} name(s)…`);
  const loaded = await loadSanctionsLists(cfg);
  if (!loaded.lists.length || loaded.degraded) {
    /* Degrade loudly: a clean-looking report against missing lists is the one
       output this tool must never produce. */
    console.error('batch-screen: core lists failed to load — refusing to screen. Notes: '
      + (loaded.notes || []).join('; '));
    return 1;
  }
  const index = buildIndex(loaded.lists);
  const rows = names.map(name => ({ name, ...screenName(name, index, threshold, phonMode) }));
  const report = buildBatchReport(rows, {
    date: new Date().toISOString().slice(0, 10),
    threshold,
    listsLoaded: loaded.lists.length,
    failures: (loaded.notes || []),
    governanceNote: GOVERNANCE_NOTE,
  });
  if (out) {
    writeFileSync(out, report + '\n');
    console.error(`batch-screen: report written to ${out}`);
  } else {
    console.log(report);
  }
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).then(c => process.exit(c));
}
