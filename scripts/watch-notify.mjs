/* CLI bridge: turn a watcher report into one Asana card in the
   Regulations / Governance / Sanctions project.

   Usage: node scripts/watch-notify.mjs "<task title>" <report-file>

   Used by the Regulatory Watch and Sanctions Watch workflows on detected
   changes. Reuses scripts/asana-notify.mjs so every monitored change (circular,
   notification, list entry, guidance update, news) lands as a task.

   Exit codes:
     0  task created in Asana
     3  could not deliver to Asana (no token configured, or the API call failed)
        — the workflow then falls back to opening a labelled GitHub issue so the
        change is never lost. */
import { readFileSync } from 'node:fs';
import { notifyAsana, asanaEnabled, runUrl, REG_PROJECT_GID } from './asana-notify.mjs';

const title = process.argv[2];
const reportFile = process.argv[3];

if (!title) {
  console.error('usage: node scripts/watch-notify.mjs "<title>" <report-file>');
  process.exit(2);
}

let report = '';
if (reportFile) {
  try { report = readFileSync(reportFile, 'utf8'); }
  catch (e) { console.warn('watch-notify: could not read report file ' + reportFile + ' (' + e.message + ')'); }
}

const link = runUrl();
const notes = [report.trim(), link ? '\nWorkflow run: ' + link : '']
  .filter(Boolean).join('\n');

if (!asanaEnabled()) {
  console.error('watch-notify: ASANA_ACCESS_TOKEN not set — cannot create the Asana card; falling back to a GitHub issue.');
  process.exit(3);
}

try {
  const url = await notifyAsana(title, notes, { project: REG_PROJECT_GID });
  console.log('watch-notify: Asana card created' + (url ? ' — ' + url : ''));
  process.exit(0);
} catch (e) {
  console.error('watch-notify: Asana card creation failed (' + (e && e.message || e) + '); falling back to a GitHub issue.');
  process.exit(3);
}
