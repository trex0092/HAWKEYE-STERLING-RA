/* Delivery watchdog — did TODAY's Daily AML/CFT Screening Report actually
   reach Asana, independent of whether the run that produced it exited 0?

   WHY THIS EXISTS, AND WHY FRESHNESS CHECK DOES NOT ALREADY COVER IT
   -------------------------------------------------------------------
   screen.py's EOCN review gate (enforce_eocn_review_gate) deliberately
   sys.exit(3)s AFTER a fully successful screening + delivery, so the
   weekly-adverse-media.yml run conclusion is "failure" on a day that
   delivered fine. Freshness Check asks the Actions API for a SUCCESSFUL run
   inside the cadence window -- which the EOCN gate makes permanently false
   regardless of delivery, for as long as the EOCN review stays overdue. That
   is already known and intentionally left as-is pending the EOCN
   reconciliation. This watchdog checks the actual deliverable instead of the
   exit code: did a "Daily AML/CFT Screening Report" task get FILED in Asana
   today? That signal is independent of the gate, and of which attempt
   (scheduled or a control-retry.yml self-healing pass) produced it.

   CONTEXT (2026-09-08 sample)
   ----------------------------
   The run that files this report was killed mid-flight ("the runner has
   received a shutdown signal") on 12 of 18 recent attempts (67%). Cause not
   identified: job timeout (350min, not close), step timeout (none exists),
   console silence (ruled out directly -- a heartbeat-instrumented run was
   still killed), a public GitHub incident (no record at any failure
   timestamp), and harden-runner egress volume (a longer, heavier run
   completed with a clean egress audit) were all checked and ruled out.
   Every sampled day still delivered, via the self-healing retry passes. This
   watchdog exists for the day that doesn't -- a killed run alone produces no
   distinct alert beyond the red badges that are already expected daily
   because of the EOCN gate, so without this check a true delivery gap would
   look identical to an ordinary day.

   Runs once, late in the UTC day (see the workflow's cron comment) so every
   scheduled run and both self-healing retry passes have had their chance. */
import { listProjectTasks } from './asana-notify.mjs';

// "Sanctions/Media/PEP - Monitoring" -- where DeliveryAgent files the report
// (see screen.py's Asana delivery step; the same task is mirrored into
// "Follow Ups" too, but this project is the stable, dedicated home to read).
const PROJECT_GID = process.env.SCREENING_PROJECT_GID || '1213914392047129';
const TITLE_PREFIX = 'Daily AML/CFT Screening Report';

async function main() {
  if (!process.env.ASANA_ACCESS_TOKEN) {
    console.error('delivery-watchdog: ASANA_ACCESS_TOKEN missing -- cannot verify delivery; treating as a failure (an unread day is not a delivered day).');
    process.exit(2);
  }

  const today = new Date().toISOString().slice(0, 10); // UTC date, matching Asana's created_at
  let tasks;
  try {
    tasks = await listProjectTasks(PROJECT_GID);
  } catch (e) {
    console.error('delivery-watchdog: could not read Asana project ' + PROJECT_GID + ' (' + String(e && e.message || e).slice(0, 200) + ') -- delivery is UNVERIFIABLE, which is not the same as delivered.');
    process.exit(2);
  }

  const todays = tasks.filter(t => {
    const name = String((t && t.name) || '');
    if (!name.startsWith(TITLE_PREFIX)) return false;
    return String((t && t.created_at) || '').slice(0, 10) === today;
  });

  if (todays.length) {
    console.log('delivery-watchdog: OK -- ' + todays.length + ' report(s) filed today (' + today + '): '
      + todays.map(t => t.permalink_url || t.name).join(', '));
    return;
  }

  console.error('delivery-watchdog: NO "' + TITLE_PREFIX + '" task found for today (' + today
    + ') in project ' + PROJECT_GID + ' -- the daily sanctions/PEP/adverse-media screening has NOT '
    + 'been evidenced as delivered.');
  process.exitCode = 1;
}

await main();
