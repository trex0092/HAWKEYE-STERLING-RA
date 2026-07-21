/* Daily Compliance Brief — one consolidated Asana task each morning that rolls
   up the last 24h of monitoring (FATF list moves, sanctions list changes,
   customer-screening hits, regulatory changes, site/function health) plus the
   current standing posture. It ALWAYS files — "all clear" on a quiet day — so
   there is a daily record that monitoring ran, not just an alert when something
   breaks. Idempotent: only one brief per calendar day.

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
export const REG_PROJECT_GID = process.env.ASANA_REG_PROJECT_GID || '1213914392047129';
export const RISK_PROJECT_GID = process.env.ASANA_PROJECT_GID || '1216203370612914';
/* Optional: file the brief under a section so it lands in its own column. */
const BRIEF_SECTION_GID = process.env.ASANA_BRIEF_SECTION_GID || '';
const LOOKBACK_HOURS = Number(process.env.BRIEF_LOOKBACK_HOURS) || 24;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function dateLabel(d) { return d.getUTCDate() + ' ' + MONTHS[d.getUTCMonth()] + ' ' + d.getUTCFullYear(); }

export function isHealthAlert(name) { return /\b(SITE|FUNCTION) DOWN\b|health check/i.test(String(name || '')); }

/* Sort the day's new tasks into the categories the brief reports on. The brief's
   own tasks and the risk-data backup task are never counted. Categorisation is
   by the stable name prefixes the individual watchers use. */
export function categorize(tasks) {
  const b = { fatf: [], screen: [], watch: [], regulatory: [], health: [], other: [] };
  for (const t of tasks) {
    const n = String(t.name || '');
    if (/^Daily Compliance Brief/i.test(n)) continue;       /* never count our own briefs */
    if (/^RISK DATA SHEET/i.test(n)) continue;              /* the auto-backup mirror task */
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

export function buildBrief(b, fatf, label, lookbackHours) {
  const line = t => '  • ' + String(t.name || '') + (t.permalink_url ? '\n    ' + t.permalink_url : '');
  const block = (title, arr) => arr.length ? title + ' (' + arr.length + '):\n' + arr.map(line).join('\n') : title + ': no change';
  const total = totalItems(b);
  const head = total === 0
    ? '✅ ALL CLEAR — no new monitoring alerts in the last ' + lookbackHours + 'h.'
    : '⚠ ' + total + ' new monitoring item' + (total === 1 ? '' : 's') + ' in the last ' + lookbackHours + 'h — review below.';
  const out = [
    head, '',
    '— Activity in the last ' + lookbackHours + 'h —',
    block('FATF list moves', b.fatf),
    block('Sanctions — customer screening hits', b.screen),
    block('Sanctions — list changes (OFAC/UN/EU/UK/EOCN)', b.watch),
    block('Regulatory changes', b.regulatory),
    block('Site / function health', b.health)
  ];
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
  const cutoff = now.getTime() - LOOKBACK_HOURS * 3600 * 1000;

  /* Idempotent: skip if today's brief already exists. */
  const regTasks = await listTasks(REG_PROJECT_GID, 'name,created_at,permalink_url');
  if (regTasks.some(t => String(t.name || '') === title)) { console.log('brief already exists: ' + title); return; }

  /* The HAWKEYE STERLING APP project also holds non-alert items (assessment
     templates, the backup mirror), so take ONLY health alerts from it; the REG
     project is all monitoring alerts and is taken in full. */
  const riskTasks = (await listTasks(RISK_PROJECT_GID, 'name,created_at,permalink_url')).filter(t => isHealthAlert(t.name));
  const recent = [...regTasks, ...riskTasks].filter(t => {
    const ts = Date.parse(t.created_at || '');
    return Number.isFinite(ts) && ts >= cutoff;
  });

  const buckets = categorize(recent);
  const notes = buildBrief(buckets, readFatfState(), label, LOOKBACK_HOURS);
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
