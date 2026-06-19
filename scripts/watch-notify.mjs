/* CLI bridge: turn a watcher report into one Asana card in the
   Regulations / Governance / Sanctions project.

   Usage: node scripts/watch-notify.mjs "<task title>" <report-file> [changes-file]

   Used by the Regulatory Watch and Sanctions Watch workflows on detected
   changes. Reuses scripts/asana-notify.mjs so every monitored change (circular,
   notification, list entry, guidance update, news) lands as a task.

   When a structured changes file is given (reg-watch-changes.json /
   sanctions-watch-changes.json — {date, mode, changes:[{name,jurisdiction,url,status}]}),
   the card is posted as Asana RICH TEXT (bold heading, bulleted sources, clickable
   links). Otherwise it falls back to the plain-text markdown report.

   Exit codes:
     0  task created in Asana
     3  could not deliver to Asana (no token configured, or the API call failed)
        — the workflow then falls back to opening a labelled GitHub issue so the
        change is never lost. */
import { readFileSync } from 'node:fs';
import { notifyAsana, asanaEnabled, runUrl, buildHtmlBody, REG_PROJECT_GID } from './asana-notify.mjs';

const title = process.argv[2];
const reportFile = process.argv[3];
const changesFile = process.argv[4];

if (!title) {
  console.error('usage: node scripts/watch-notify.mjs "<title>" <report-file> [changes-file]');
  process.exit(2);
}

/* Plain-text report — used as the no-token preview and as the html fallback. */
let report = '';
if (reportFile) {
  try { report = readFileSync(reportFile, 'utf8'); }
  catch (e) { console.warn('watch-notify: could not read report file ' + reportFile + ' (' + e.message + ')'); }
}

/* Structured changes — drive the rich-text body when available. */
let changes = null;
if (changesFile) {
  try {
    const parsed = JSON.parse(readFileSync(changesFile, 'utf8'));
    if (parsed && Array.isArray(parsed.changes)) changes = parsed.changes;
  } catch (e) {
    console.warn('watch-notify: could not read changes file ' + changesFile + ' (' + e.message + '); using plain text.');
  }
}

const link = runUrl();
let html = null;
if (changes && changes.length) {
  const n = changes.length;
  html = buildHtmlBody({
    heading: title,
    summary: n + ' source' + (n === 1 ? '' : 's') + ' changed — review and apply any needed updates.',
    changes,
    runLink: link
  });
}

const notes = [report.trim(), link ? '\nWorkflow run: ' + link : '']
  .filter(Boolean).join('\n');

if (html) {
  console.log('watch-notify: rich-text body built (' + changes.length + ' source(s)).');
  console.log(html);
}

if (!asanaEnabled()) {
  console.error('watch-notify: ASANA_ACCESS_TOKEN not set — cannot create the Asana card; falling back to a GitHub issue.');
  process.exit(3);
}

try {
  const section = process.env.ASANA_SECTION_GID || undefined;
  const url = await notifyAsana(title, notes, { project: REG_PROJECT_GID, html, section });
  console.log('watch-notify: Asana card created' + (url ? ' — ' + url : ''));
  process.exit(0);
} catch (e) {
  console.error('watch-notify: Asana card creation failed (' + (e && e.message || e) + '); falling back to a GitHub issue.');
  process.exit(3);
}
