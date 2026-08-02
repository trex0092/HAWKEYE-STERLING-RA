/* Creates an alert task in the HAWKEYE STERLING APP Asana project, assigned and
   due today so it reaches the compliance officer's inbox immediately.
   Used by the alerting steps of ~10 workflows (site-health, freshness-check,
   site-currency, codeql, function-health, eocn-reconcile, …).
   Usage: node scripts/asana-alert.mjs "<title>" "<notes>"

   Delivery goes through asana-notify's shared `asana()` helper, so a 429 /
   5xx / network blip is retried with the same bounded backoff every other
   watcher uses — hardened 2026-08-02: this script previously made exactly one
   attempt, so a single transient failure lost the alert card on the one
   channel whose job is reporting failures. An overall deadline still bounds
   the step: an alert that cannot deliver inside 90s exits non-zero (the
   workflow surfaces the failure) instead of stalling to the job timeout. */
import { asana } from './asana-notify.mjs';

const PROJECT_GID = process.env.ASANA_PROJECT_GID || '1216203370612914'; /* HAWKEYE STERLING APP */
const title = process.argv[2];
const notes = process.argv[3] || '';

if (!process.env.ASANA_ACCESS_TOKEN) { console.error('ASANA_ACCESS_TOKEN missing'); process.exit(1); }
if (!title) { console.error('usage: node scripts/asana-alert.mjs "<title>" "<notes>"'); process.exit(1); }

const DEADLINE_MS = 90000;
const deadline = setTimeout(() => {
  console.error('asana-alert: gave up after ' + DEADLINE_MS + 'ms — alert NOT delivered');
  process.exit(1);
}, DEADLINE_MS);

try {
  const d = await asana('/tasks', {
    method: 'POST',
    body: JSON.stringify({ data: { name: title, notes, projects: [PROJECT_GID], due_on: new Date().toISOString().slice(0, 10), assignee: 'me' } })
  });
  console.log('alert task created: ' + (d?.data?.permalink_url || '(task created; no permalink returned)'));
} catch (e) {
  console.error('asana-alert: ' + String(e && e.message || e).slice(0, 300));
  process.exit(1);
} finally {
  clearTimeout(deadline);
}
