/* Compliance Calendar — files lead-time Asana reminders for DATED
   compliance-programme duties from data/compliance-calendar.json.

   The estate watches list CONTENT continuously (sanctions-watch,
   fatf-watchdog, regulatory-watch), but calendar duties — the annual
   governance-pack review, the AI-awareness training refresh, FATF plenary
   pre-briefs — fall due whether or not anything changes, and lived only in
   document footers ("reviewed annually") nobody re-reads. This script turns
   the registry into due-dated Asana tasks inside each duty's lead window.

   Occurrence model (registry shapes):
     one-off  : { id, title, date: 'YYYY-MM-DD', leadDays, ... }
     recurring: { id, title, anchor: 'YYYY-MM-DD', everyMonths, leadDays, ... }
   Optional on both: graceDays (default 7), provisional: true (external body
   sets the date — the task tells the owner to confirm it), owner, notes[].

   A duty is DUE when today falls inside [occurrence − leadDays,
   occurrence + graceDays]; the grace tail means a weekly cron that straddles
   the date still files — late, but loudly — instead of skipping silently.
   Recurring occurrences are computed FROM THE ANCHOR (month-end clamped), so
   Jan 31 yields Feb 28 then Mar 31, never a chained-clamp drift to Mar 28.

   Idempotent like scorecard-milestone.mjs: the task title embeds the
   occurrence date and an exact-title check across the whole project skips
   anything already filed, so weekly re-fires inside a window never duplicate.

   Runs in GitHub Actions (.github/workflows/compliance-calendar.yml).
   The decision logic is pure and offline-tested; only main() touches the
   network. Needs the ASANA_ACCESS_TOKEN secret. */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import {
  notifyAsana, asanaEnabled, ensureSection, listProjectTasks, runUrl, REG_PROJECT_GID
} from './asana-notify.mjs';

export const SECTION_NAME = 'Compliance Calendar';
export const CALENDAR_FILE = 'data/compliance-calendar.json';
export const DEFAULT_GRACE_DAYS = 7;

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export function loadCalendar(root = ROOT) {
  const parsed = JSON.parse(readFileSync(join(root, CALENDAR_FILE), 'utf8'));
  return Array.isArray(parsed.events) ? parsed.events : [];
}

/* Whole days from `fromDay` to `toDay` (YYYY-MM-DD each; positive = future). */
export function daysBetween(fromDay, toDay) {
  const a = Date.parse(fromDay + 'T00:00:00Z');
  const b = Date.parse(toDay + 'T00:00:00Z');
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((b - a) / 86400000);
}

/* 'YYYY-MM-DD' + n months, month-end clamped (Jan 31 + 1 → Feb 28/29). */
export function addMonths(day, months) {
  const [y, m, d] = day.split('-').map(Number);
  const total = (m - 1) + months;
  const ty = y + Math.floor(total / 12);
  const tm = ((total % 12) + 12) % 12; // 0-based target month
  const lastDay = new Date(Date.UTC(ty, tm + 1, 0)).getUTCDate();
  const td = Math.min(d, lastDay);
  return `${ty}-${String(tm + 1).padStart(2, '0')}-${String(td).padStart(2, '0')}`;
}

/* Occurrences of one event DUE today — inside [occ − lead, occ + grace].
   For recurring events both the occurrence just past (grace tail) and the
   next one (lead window) can qualify: at most two, chronological order. */
export function dueOccurrences(event, today) {
  const lead = Number(event.leadDays) || 0;
  const grace = event.graceDays == null ? DEFAULT_GRACE_DAYS : Number(event.graceDays);
  const inWindow = (occ) => {
    const until = daysBetween(today, occ); // > 0 → future
    return until !== null && until <= lead && until >= -grace;
  };

  if (event.date) return inWindow(event.date) ? [event.date] : [];
  if (!event.anchor || !Number(event.everyMonths)) return [];

  /* Walk k = 0, 1, 2… from the anchor to the first occurrence ≥ today,
     keeping the one before it (the grace-tail candidate). */
  let k = 0, next = event.anchor, prev = null;
  while (daysBetween(today, next) < 0) {
    prev = next;
    k += 1;
    if (k > 1200) return []; // > 100 years of monthly occurrences — bad data, not a loop
    next = addMonths(event.anchor, Number(event.everyMonths) * k);
  }
  const due = [];
  if (prev && inWindow(prev)) due.push(prev);
  if (inWindow(next)) due.push(next);
  return due;
}

/* Task title — embeds the occurrence date: the forever-dedup key. */
export function buildTaskTitle(event, occurrence) {
  return `${event.title} — due ${occurrence}`;
}

export function buildTaskNotes(event, occurrence, link) {
  const L = [];
  L.push('COMPLIANCE CALENDAR — ' + event.title);
  L.push(`Due: ${occurrence} (filed ${event.leadDays || 0} days ahead). Owner: ${event.owner || 'MLRO'}.`);
  if (event.provisional) {
    L.push('Date is PROVISIONAL (set by an external body) — confirm it and, if it moved, edit data/compliance-calendar.json.');
  }
  L.push('');
  for (const n of event.notes || []) L.push('☐ ' + n);
  L.push('');
  L.push(`Registry: data/compliance-calendar.json (id: ${event.id}) — edit dates and scope there; the weekly`);
  L.push('Compliance Calendar workflow files each occurrence once (deduped by exact task title).');
  if (link) L.push('\nFiled automatically — workflow run: ' + link);
  return L.join('\n');
}

/* UTC calendar date (YYYY-MM-DD) of "now". */
export function todayUtc(now) {
  return (now || new Date()).toISOString().slice(0, 10);
}

async function main() {
  if (!asanaEnabled()) {
    console.error('compliance-calendar: ASANA_ACCESS_TOKEN not set — cannot file reminders.');
    process.exit(3);
  }
  const today = todayUtc();
  const events = loadCalendar();
  const due = events.flatMap(e => dueOccurrences(e, today).map(occ => ({ event: e, occ })));
  if (!due.length) {
    console.log(`compliance-calendar: ${events.length} registry event(s), nothing due within a lead window on ${today}.`);
    return;
  }

  const existing = await listProjectTasks(REG_PROJECT_GID);
  const titles = new Set(existing.map(t => String(t.name || '')));
  let filed = 0, skipped = 0;
  let section = null;
  for (const { event, occ } of due) {
    const title = buildTaskTitle(event, occ);
    if (titles.has(title)) {
      skipped++;
      console.log('compliance-calendar: already filed — ' + title);
      continue;
    }
    if (!section) section = await ensureSection(REG_PROJECT_GID, SECTION_NAME);
    const url = await notifyAsana(title, buildTaskNotes(event, occ, runUrl()), {
      project: REG_PROJECT_GID, section, due: occ,
    });
    filed++;
    console.log('compliance-calendar: filed — ' + title + (url ? ' — ' + url : ''));
  }
  console.log(`compliance-calendar: done — ${filed} filed, ${skipped} already present, of ${due.length} due occurrence(s).`);
}

if (process.argv[1] && process.argv[1].endsWith('compliance-calendar.mjs')) {
  main().catch(e => { console.error(e.message); process.exit(1); });
}
