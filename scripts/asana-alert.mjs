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
   workflow surfaces the failure) instead of stalling to the job timeout.

   2026-09-25: added an idempotency guard. Every caller's title is a STATIC
   string describing an ONGOING condition ("FUNCTION DOWN: Netlify functions
   failed health check", "CONTROL STALE: ..."), never a dated/one-off event,
   so a second alert with the identical title is never new information —
   it's the same unfixed problem. Without this guard, a persisting condition
   across several scheduled runs filed a fresh duplicate every time it ran:
   found and confirmed still open when this was added — freshness-check's
   "CONTROL STALE" (4 open), function-health's "FUNCTION DOWN" (4 open), and
   site-currency's "PRODUCTION DRIFT" (2 open), the same pattern eocn-
   reconcile's alert (fixed separately, same day) had independently grown.
   This is deliberately NOT the 6-hour-windowed duplicate guard asana-
   notify.mjs's notifyAsana() already has (used by Regulatory/Sanctions
   Watch, where an identical title genuinely can recur as a distinct event a
   day later): here, an existing OPEN task with the exact same title is
   always the SAME still-unresolved problem, not a new occurrence of it, so
   there's no time window to age out of — skip while it stays open, file
   again the first run after it's closed. */
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
  let existing = null, offset = '';
  for (;;) {
    const path = '/tasks?project=' + PROJECT_GID + '&completed_since=now'
      + '&opt_fields=name,permalink_url&limit=100' + (offset ? '&offset=' + offset : '');
    const d = await asana(path);
    existing = (d.data || []).find(t => t && t.name === title) || null;
    if (existing) break;
    offset = d.next_page && d.next_page.offset;
    if (!offset) break;
  }
  if (existing) {
    console.log('alert already open (' + (existing.permalink_url || existing.gid)
      + ') — not filing a duplicate: "' + title + '"');
  } else {
    const d = await asana('/tasks', {
      method: 'POST',
      body: JSON.stringify({ data: { name: title, notes, projects: [PROJECT_GID], due_on: new Date().toISOString().slice(0, 10), assignee: 'me' } })
    });
    console.log('alert task created: ' + (d?.data?.permalink_url || '(task created; no permalink returned)'));
  }
} catch (e) {
  console.error('asana-alert: ' + String(e && e.message || e).slice(0, 300));
  process.exit(1);
} finally {
  clearTimeout(deadline);
}
