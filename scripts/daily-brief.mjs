/* Daily Compliance Brief — one consolidated Asana task each morning that rolls
   up monitoring since the previous brief (FATF list moves, sanctions list
   changes, customer-screening hits, regulatory changes, site/function health)
   plus the current standing posture. It ALWAYS files — "all clear" on a quiet
   day — so there is a daily record that monitoring ran, not just an alert when
   something breaks. Idempotent: only one brief per calendar day.

   The window is anchored to the previous brief rather than a fixed 24h, so
   cron jitter and missed runs cannot open an unreported gap between two briefs
   that both look clean. See resolveWindow.

   Each line links to the underlying alert task (filed by the individual
   watchers), so the brief is a digest, not a replacement for the detail.

   Runs in GitHub Actions (.github/workflows/daily-brief.yml).
   Needs the ASANA_ACCESS_TOKEN repository secret. */
import { readFileSync, existsSync } from 'node:fs';
/* Shared Asana client: bounded retry on 429/5xx so a transient blip never
   drops the day's brief (idempotency is by exact-title check below). */
import { asana } from './asana-notify.mjs';

/* The "Ongoing Monitoring" project holds the monitoring
   alerts; the HAWKEYE STERLING APP project holds the site/function-health alerts. */
export const REG_PROJECT_GID = process.env.ASANA_REG_PROJECT_GID || '1216203370612914';
export const RISK_PROJECT_GID = process.env.ASANA_PROJECT_GID || '1216203370612914';
/* Optional: file the brief under a section so it lands in its own column. */
const BRIEF_SECTION_GID = process.env.ASANA_BRIEF_SECTION_GID || '';
/* Nominal cadence — used only when no previous brief can be found to anchor to. */
const LOOKBACK_HOURS = Number(process.env.BRIEF_LOOKBACK_HOURS) || 24;
/* Ceiling on a catch-up window, so a long outage cannot make one brief try to
   render months of alerts. When the ceiling bites, the brief says so. */
const MAX_LOOKBACK_HOURS = Number(process.env.BRIEF_MAX_LOOKBACK_HOURS) || 168;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function dateLabel(d) { return d.getUTCDate() + ' ' + MONTHS[d.getUTCMonth()] + ' ' + d.getUTCFullYear(); }

export function isHealthAlert(name) { return /\b(SITE|FUNCTION) DOWN\b|health check/i.test(String(name || '')); }
export function isBrief(name) { return /^Daily Compliance Brief/i.test(String(name || '')); }

/* Choose the window this brief reports on.

   A fixed "now − 24h" cutoff assumes consecutive briefs are exactly 24h apart.
   They are not: GitHub's scheduler delays cron by hours, and the delay varies
   run to run. Measured over 30 consecutive briefs — every one of them a SUCCESS,
   no run missed — 14 of the 29 gaps exceeded 24h, up to 25.93h. Every hour past
   24 was a window whose alerts appeared in NO brief, while the next brief still
   printed "✅ ALL CLEAR — no new monitoring alerts in the last 24h": counted as
   covered, actually uncovered, silent. 8.37h went unreported that way in a month
   of clean runs; a single missed run adds a full day on top.

   So anchor to the previous brief's own creation time instead. Coverage is then
   contiguous by construction — jitter and missed runs are absorbed rather than
   dropped, and a boundary alert is reported twice rather than not at all. */
export function resolveWindow(now, tasks, { nominalHours = 24, maxHours = 168 } = {}) {
  const nowMs = now.getTime();
  let prior = null;
  for (const t of tasks || []) {
    if (!isBrief(t.name)) continue;
    const ts = Date.parse(t.created_at || '');
    /* A brief stamped in the future would produce a negative window; ignore it. */
    if (!Number.isFinite(ts) || ts > nowMs) continue;
    if (prior === null || ts > prior) prior = ts;
  }
  const capMs = nowMs - maxHours * 3600 * 1000;
  if (prior === null) {
    /* Distinct from the plain-number form used by callers that state a window
       outright: here we WANTED an anchor and could not find one, which the
       brief says rather than presenting the fallback as a measured window. */
    return { cutoff: nowMs - nominalHours * 3600 * 1000, hours: nominalHours, anchor: 'no-prior-brief', priorBriefAt: null, capped: false };
  }
  const capped = prior < capMs;
  const cutoff = capped ? capMs : prior;
  return {
    cutoff,
    hours: (nowMs - cutoff) / 3600000,
    anchor: 'previous-brief',
    priorBriefAt: new Date(prior).toISOString(),
    capped
  };
}

/* How the window is described in the brief. The nominal cadence is stated as
   "24h"; anything materially wider is named as a catch-up so the reader can see
   the brief covered extra ground rather than assuming a routine day. */
export function windowLabel(w) {
  const h = Math.round((w.hours + Number.EPSILON) * 10) / 10;
  if (w.anchor !== 'previous-brief') return 'last ' + h + 'h';
  return 'last ' + h + 'h (since the previous brief)';
}

/* Sort the day's new tasks into the categories the brief reports on. The brief's
   own tasks and the risk-data backup task are never counted. Categorisation is
   by the stable name prefixes the individual watchers use. */
/* Routine scheduled output that shares the REG project with real alerts. These
   are reports and reminders the pipeline files on a fixed cadence — counting
   them as "new monitoring items" makes the ✅ ALL CLEAR headline unreachable on
   any day a sibling report runs, and dresses routine paperwork up as signal. */
const ROUTINE_TASKS = [
  /^📅 Weekly Compliance Summary/i,          /* weekly-summary.mjs */
  /^Adverse-media methodology review/i,      /* quarterly-review.mjs */
  /^AI Governance & Platform Report/i,       /* governance-report.mjs */
  /^\[TEST\] /,                              /* connectivity self-tests */
  / — due \d{4}-\d{2}-\d{2}$/               /* compliance-calendar.mjs reminders */
];

export function categorize(tasks) {
  const b = { fatf: [], screen: [], watch: [], regulatory: [], health: [], other: [] };
  for (const t of tasks) {
    const n = String(t.name || '');
    if (/^Daily Compliance Brief/i.test(n)) continue;       /* never count our own briefs */
    if (/^RISK DATA SHEET/i.test(n)) continue;              /* the auto-backup mirror task */
    if (ROUTINE_TASKS.some(re => re.test(n))) continue;     /* scheduled reports, not alerts */
    /* Unanchored like every sibling branch: the watchdog's monitoring-gap
       alert is titled "⚠ FATF monitoring GAP — …", which a ^-anchored match
       misfiled under "Other monitoring". */
    if (/FATF/i.test(n)) b.fatf.push(t);
    else if (/Sanctions Screen/i.test(n)) b.screen.push(t);
    else if (/Sanctions Watch/i.test(n)) b.watch.push(t);
    else if (isHealthAlert(n)) b.health.push(t);
    else if (/regulat/i.test(n)) b.regulatory.push(t);
    else b.other.push(t);
  }
  return b;
}

export function totalItems(b) {
  return b.fatf.length + b.screen.length + b.watch.length + b.regulatory.length + b.health.length + b.other.length;
}

export function buildBrief(b, fatf, label, window) {
  /* Accept a bare hour count for the nominal case. */
  const w = typeof window === 'number'
    ? { hours: window, anchor: 'nominal', priorBriefAt: null, capped: false }
    : window;
  const span = windowLabel(w);
  const line = t => '  • ' + String(t.name || '') + (t.permalink_url ? '\n    ' + t.permalink_url : '');
  const block = (title, arr) => arr.length ? title + ' (' + arr.length + '):\n' + arr.map(line).join('\n') : title + ': no change';
  const total = totalItems(b);
  const head = total === 0
    ? '✅ ALL CLEAR — no new monitoring alerts in the ' + span + '.'
    : '⚠ ' + total + ' new monitoring item' + (total === 1 ? '' : 's') + ' in the ' + span + ' — review below.';
  const out = [head];
  /* Degrade loudly: the window was truncated, so some activity is in no brief.
     Never let that pass as a clean day. */
  if (w.capped) {
    out.push('', '⚠ COVERAGE GAP — the previous brief was filed ' + (w.priorBriefAt || 'an unknown time')
      + ', longer ago than the ' + Math.round(w.hours) + 'h ceiling this brief can report on.'
      + ' Activity between that brief and the start of this window appears in NO brief and must be reviewed directly in Asana.');
  } else if (w.anchor === 'no-prior-brief') {
    /* Either the genuine first brief, or brief history has gone missing. Both
       are worth knowing: without an anchor this window is assumed, not measured. */
    out.push('', 'ℹ No previous brief was found to anchor to, so this brief reports a nominal '
      + Math.round(w.hours) + 'h window rather than one measured from the last brief.'
      + ' Expected on the first brief; otherwise the brief history is missing and coverage before this window is unconfirmed.');
  }
  out.push(
    '',
    '— Activity in the ' + span + ' —',
    block('FATF list moves', b.fatf),
    block('Sanctions — customer screening hits', b.screen),
    block('Sanctions — list changes (OFAC/UN/EU/UK/EOCN)', b.watch),
    block('Regulatory changes', b.regulatory),
    block('Site / function health', b.health)
  );
  if (b.other.length) out.push(block('Other monitoring', b.other));
  out.push('', '— Standing posture —');
  if (fatf) {
    out.push('FATF: ' + fatf.black.length + ' call-for-action (' + fatf.black.join(', ') + '); '
      + fatf.grey.length + ' grey-listed jurisdiction' + (fatf.grey.length === 1 ? '' : 's')
      + '. Last recorded list change ' + (fatf.updated || 'unknown') + '.');
  }
  out.push('Daily monitoring active: customer sanctions screening, sanctions-list watch (OFAC/UN/EU/UK/EOCN), FATF list watch, regulatory-source watch, and site/function health.');
  out.push('', 'Generated automatically. Each item links to its own task with the full detail.');
  return out.join('\n');
}

/* ---- I/O below; the functions above are pure and unit-tested. ---- */

async function listTasks(projectGid, fields) {
  const out = [];
  const base = '/projects/' + projectGid + '/tasks?limit=100&opt_fields=' + fields;
  let path = base;
  while (path) {
    const d = await asana(path);
    out.push(...(d.data || []));
    path = d.next_page ? base + '&offset=' + d.next_page.offset : null;
  }
  return out;
}

export function readFatfState(file = 'data/fatf-state.json') {
  if (!existsSync(file)) return null;
  try {
    const s = JSON.parse(readFileSync(file, 'utf8'));
    return (s && Array.isArray(s.black) && Array.isArray(s.grey)) ? s : null;
  } catch { return null; }
}

async function main() {
  if (!process.env.ASANA_ACCESS_TOKEN) throw new Error('ASANA_ACCESS_TOKEN secret is not configured in GitHub Actions');
  const now = new Date();
  const label = dateLabel(now);
  const title = 'Daily Compliance Brief — ' + label;

  /* Idempotent: skip if today's brief already exists. */
  const regTasks = await listTasks(REG_PROJECT_GID, 'name,created_at,permalink_url');
  if (regTasks.some(t => String(t.name || '') === title)) { console.log('brief already exists: ' + title); return; }

  /* Window anchored to the previous brief, not a fixed 24h — see resolveWindow.
     Reached only after the idempotency check above, so every brief found here is
     genuinely a prior one. */
  const win = resolveWindow(now, regTasks, { nominalHours: LOOKBACK_HOURS, maxHours: MAX_LOOKBACK_HOURS });
  const cutoff = win.cutoff;
  console.log('window: ' + win.hours.toFixed(2) + 'h, anchor=' + win.anchor
    + (win.priorBriefAt ? ', prior brief ' + win.priorBriefAt : '') + (win.capped ? ', CAPPED' : ''));

  /* The HAWKEYE STERLING APP project also holds non-alert items (assessment
     templates, the backup mirror), so take ONLY health alerts from it; the REG
     project is all monitoring alerts and is taken in full. */
  const riskTasks = (await listTasks(RISK_PROJECT_GID, 'name,created_at,permalink_url')).filter(t => isHealthAlert(t.name));
  const recent = [...regTasks, ...riskTasks].filter(t => {
    const ts = Date.parse(t.created_at || '');
    return Number.isFinite(ts) && ts >= cutoff;
  });

  const buckets = categorize(recent);
  const notes = buildBrief(buckets, readFatfState(), label, win);
  const today = now.toISOString().slice(0, 10);
  const made = await asana('/tasks', { method: 'POST', body: JSON.stringify({ data: { name: title, notes, projects: [REG_PROJECT_GID], due_on: today, assignee: 'me' } }) });
  if (BRIEF_SECTION_GID && made.data && made.data.gid) {
    try { await asana('/sections/' + BRIEF_SECTION_GID + '/addTask', { method: 'POST', body: JSON.stringify({ data: { task: made.data.gid } }) }); }
    catch (e) { console.warn('daily-brief: could not move task to section (' + (e && e.message || e) + ')'); }
  }
  console.log('brief created (' + totalItems(buckets) + ' item(s)): ' + (made.data && made.data.permalink_url));
}

if (process.argv[1] && process.argv[1].endsWith('daily-brief.mjs')) {
  main().catch(e => { console.error(e.message); process.exit(1); });
}
