/* FATF Watchdog — compares FATF's published black/grey lists with the app's
   country data and, on any change, creates a review task in the RISK
   ASSESSMENTS Asana project. Detection is automatic; updating scores stays a
   human decision (senior-management approval per the compliance manual).

   Runs in GitHub Actions (.github/workflows/fatf-watchdog.yml).
   Modes: check (default) · seed (record current lists, no alert) · test-alert
   · setup-sections (create the risk-band sections) · digest (monthly
   "Reviews due" task listing clients whose next review falls due)
   · backup-risk-data (commit the Asana risk-data mirror to the repo)
   · probe (diagnostic: print source, classified lists, name contexts).
*/
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
/* Shared Asana client: bounded retry on 429/5xx + the re-run dedup guard. */
import { asana, findRecentDuplicate, listProjectTasks as listTasksIn } from './asana-notify.mjs';

export const STATE_FILE = 'data/fatf-state.json';
const FATF_URL = 'https://www.fatf-gafi.org/en/countries/black-and-grey-lists.html';
const PROJECT_GID = process.env.ASANA_PROJECT_GID || '1216203370612914'; /* HAWKEYE STERLING APP */
/* Regulatory/sanctions changes (FATF list moves) go to the dedicated
   "Ongoing Monitoring" project so all monitoring alerts stay
   together; the client-assessment digest/backup stay in HAWKEYE STERLING APP. */
const REG_PROJECT_GID = process.env.ASANA_REG_PROJECT_GID || '1216203370612914';
/* "FATF list moves" section of that project, so list-change alerts file neatly. */
const REG_FATF_SECTION_GID = process.env.ASANA_FATF_SECTION_GID || '1216203370612916';
const FATF_SKIP_ALERT = Number(process.env.FATF_SKIP_ALERT) || 2; /* consecutive unreachable runs before a monitoring-gap alert */

/* FATF naming → the app's baseline naming */
const ALIASES = {
  "democratic people's republic of korea": 'North Korea',
  'korea (dpr)': 'North Korea',
  'dprk': 'North Korea',
  'iran': 'Islamic Republic of Iran',
  'myanmar': 'Myanmar',
  'burma': 'Myanmar',
  "cote d'ivoire": "Cote D'Ivoire",
  "côte d'ivoire": "Cote D'Ivoire",
  'democratic republic of the congo': 'The Democratic Republic Of Congo',
  'democratic republic of congo': 'The Democratic Republic Of Congo',
  'dr congo': 'The Democratic Republic Of Congo',
  'virgin islands (uk)': 'British Virgin Islands',
  'virgin islands (united kingdom)': 'British Virgin Islands',
  'british virgin islands (uk)': 'British Virgin Islands',
  'lao pdr': "Lao People's Democratic Republic",
  "lao people's democratic republic": "Lao People's Democratic Republic",
  'bosnia and herzegovina': 'Bosnia-Herzegovina',
  'bosnia herzegovina': 'Bosnia-Herzegovina',
  'türkiye': 'Turkey',
  'turkiye': 'Turkey',
  'russia': 'Russian Federation',
  'united arab emirates': 'United Arab Emirates'
};

export function normalize(s) {
  /* hyphens fold to spaces so "Guinea-Bissau" can never half-match as "Guinea" */
  return String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[‐-—-]/g, ' ').replace(/\s+/g, ' ').trim();
}

/* Multi-word names must match across any whitespace run (newlines in HTML). */
function keyToRx(key) {
  return key.split(' ').map(escapeRx).join('\\s+');
}

export function loadBaseline(appJs) {
  /* The COUNTRIES baseline lives in app.js (extracted from index.html so the
     CSP can drop 'unsafe-inline' from script-src). */
  const m = appJs.match(/const COUNTRIES = (\[.*?\]);/s);
  if (!m) throw new Error('COUNTRIES baseline not found in app.js');
  return JSON.parse(m[1]);
}

/* Dictionary-based extraction: scan a text segment for known country names.
   Longest names match first and consume their span, so "Nigeria" cannot also
   count as "Niger", nor "South Sudan" as "Sudan". Robust against FATF page
   redesigns — only the names need to appear. */
function escapeRx(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
export function extractCountries(segment, baseline) {
  let text = normalize(segment);
  const dict = [
    ...baseline.map(c => ({ key: normalize(c.name), canonical: c.name })),
    ...Object.entries(ALIASES).map(([a, c]) => ({ key: normalize(a), canonical: c }))
  ].sort((a, b) => b.key.length - a.key.length);
  const found = new Set();
  for (const { key, canonical } of dict) {
    const rx = new RegExp('(^|[^a-z])(' + keyToRx(key) + ')(?=[^a-z]|$)', 'g');
    if (rx.test(text)) {
      found.add(canonical);
      text = text.replace(rx, '$1§');
    }
  }
  return [...found].sort();
}

/* Position-based classification: no slicing (offset bugs are impossible).
   Every country occurrence is classified by whichever section heading most
   recently precedes it in the page; the first classified occurrence of a
   name decides its list. Occurrences before any heading (nav links) are
   ignored. Works on a lowercased copy, which preserves string positions. */
export function classifyCountries(html, baseline) {
  /* lowercase + accent fold + 1:1 hyphen/whitespace fold; headings and
     matches use the SAME folded string, and every fold maps one character
     to one character, so positions stay mutually consistent */
  const lower = String(html || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u2010\u2011\u2012\u2013\u2014-]/g, ' ').replace(/\s/g, ' ');
  const positions = (needle) => {
    const out = []; let i = 0;
    while ((i = lower.indexOf(needle, i)) !== -1) { out.push(i); i += needle.length; }
    return out;
  };
  const blackPosAll = positions('call for action');
  const greyPosAll = positions('increased monitoring');
  /* Terminators close a list region: the "no longer subject to ..."
     delisted headings, and the boilerplate that follows the lists on the
     FATF page ("Find out more ..."). Names governed by a terminator (or
     sitting unreasonably far below their heading - footer/nav links) are
     not current members. The delisted headings embed the same needles
     ("...no longer subject to increased monitoring"), so needle hits
     inside them are dropped. */
  const endPos = [...positions('no longer subject to'), ...positions('find out more'), ...positions('related publication'), ...positions('related material')].sort((a, b) => a - b);
  const insideEndHeading = p => endPos.some(e => p >= e && p - e <= 60);
  const blackPos = blackPosAll.filter(p => !insideEndHeading(p));
  const greyPos = greyPosAll.filter(p => !insideEndHeading(p));
  const MAX_REGION = 20000; /* a 22-row list table is a few KB of HTML; footers sit far beyond */
  if (!blackPos.length || !greyPos.length) throw new Error('FATF page structure changed: section headings not found');
  const dict = [
    ...baseline.map(c => ({ key: normalize(c.name), canonical: c.name })),
    ...Object.entries(ALIASES).map(([a, c]) => ({ key: normalize(a), canonical: c }))
  ].sort((a, b) => b.key.length - a.key.length);
  let masked = lower;
  const black = new Set(), grey = new Set(), decided = new Set();
  for (const { key, canonical } of dict) {
    const rx = new RegExp('(^|[^a-z])(' + keyToRx(key) + ')(?=[^a-z]|$)', 'g');
    let m;
    while ((m = rx.exec(masked)) !== null) {
      if (decided.has(canonical)) break;
      const idx = m.index + m[1].length;
      const lastBlack = [...blackPos].filter(p => p < idx).pop();
      const lastGrey = [...greyPos].filter(p => p < idx).pop();
      const lastEnd = [...endPos].filter(p => p < idx).pop();
      if (lastBlack === undefined && lastGrey === undefined) continue;
      const nearest = Math.max(lastBlack ?? -1, lastGrey ?? -1, lastEnd ?? -1);
      if (lastEnd !== undefined && nearest === lastEnd) continue; /* delisted table / post-list content */
      if (idx - nearest > MAX_REGION) continue; /* far below the heading — footer or nav, not the list */
      const isBlack = (lastBlack ?? -1) > (lastGrey ?? -1);
      (isBlack ? black : grey).add(canonical);
      decided.add(canonical);
    }
    /* mask with same-length filler so shorter names cannot rematch inside */
    masked = masked.replace(rx, (all, p1, p2) => p1 + '#'.repeat(p2.length));
  }
  return { black: [...black].sort(), grey: [...grey].sort() };
}

/* Domain-invariant sanity check on a parsed pair of lists, so a broken source
   (e.g. a page whose "current" section was not isolated and that scoops up every
   historically-listed country) can never raise a false alert or overwrite the
   saved state. The FATF "call for action" list is tiny — only ever
   ~3 jurisdictions (Iran, Myanmar, DPRK) — the grey list runs ~20-30, and the
   two are always disjoint. A pair that violates these bounds is a parse failure,
   not a real list this large, so we stop loudly rather than persist garbage. */
export function assertPlausible(current) {
  const overlap = current.black.filter(c => current.grey.includes(c));
  if (current.black.length < 1 || current.black.length > 5
    || current.grey.length < 5 || current.grey.length > 40
    || overlap.length) {
    throw new Error('FATF parse safety stop: black=' + current.black.length
      + ' grey=' + current.grey.length + ' overlap=' + overlap.length
      + ' — the source/page structure looks unreliable; not alerting or persisting');
  }
}

export function diffLists(prev, curr) {
  const d = (a, b) => b.filter(x => !a.includes(x));
  return {
    blackAdded: d(prev.black, curr.black),
    blackRemoved: d(curr.black, prev.black),
    greyAdded: d(prev.grey, curr.grey),
    greyRemoved: d(curr.grey, prev.grey)
  };
}

export function buildAlert(diff, baseline, affected, today) {
  const score = name => {
    const c = baseline.find(x => x.name === name);
    return c ? c.score + ' (' + ['', 'Low', 'Medium', 'High'][c.score] + ')' + (c.cfa ? ', CFA flagged' : '') : 'not in the app country list';
  };
  const lines = [];
  for (const n of diff.blackAdded) lines.push('FATF added ' + n + ' to the BLACK list (call for action) on ' + today + '. The app currently scores it ' + score(n) + '. Set the CFA flag and score 3 via the Risk Data panel — relationships from this jurisdiction are outside risk appetite.');
  for (const n of diff.blackRemoved) lines.push('FATF removed ' + n + ' from the BLACK list on ' + today + '. The app currently scores it ' + score(n) + '. Review whether the CFA flag should be lifted; senior management approval applies.');
  for (const n of diff.greyAdded) lines.push('FATF added ' + n + ' to the grey list (increased monitoring) on ' + today + '. The app currently scores it ' + score(n) + '. Review and update via the Risk Data panel.');
  for (const n of diff.greyRemoved) lines.push('FATF removed ' + n + ' from the grey list on ' + today + '. The app currently scores it ' + score(n) + '. Review whether the score or any override should be relaxed.');
  let notes = lines.join('\n\n');
  notes += '\n\nAffected assessments in this project (matched on their Jurisdiction line): ';
  notes += affected.length ? '\n- ' + affected.join('\n- ') + '\n\nRe-assess these entities (event-driven review per the Know Your Customer procedure): open the app, redo the assessment for each entity, sign and Complete — a fresh task with the new review date will be created here.' : 'none found.';
  notes += '\n\nProcess: apply interim changes in the app via ⚙ Risk Data (a reason is mandatory), then Export Sheet and import it on every assessor machine. For permanent adoption, have the baseline updated in the repository.';
  return notes;
}

/* A capture older than this many days is treated as possibly pre-plenary and
   rejected: it could pre-date a just-published FATF list change and so mask it.
   Used to confirm that a forced archive capture is genuinely fresh. */
export const SNAPSHOT_STALE_DAYS = 7;

/* Whole days since an archive capture. Timestamp is YYYYMMDDhhmmss (UTC); an
   unparseable value is treated as infinitely stale so it never masks a change. */
export function snapshotAgeDays(ts, now = Date.now()) {
  const m = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(String(ts || ''));
  if (!m) return Infinity;
  return (now - Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6])) / 86400000;
}

/* The only authoritative source is the official FATF page. It 403s our
   datacenter runner directly, so when that fails we (2) ask archive.org to fetch
   the live page *now* (Save Page Now) and (3) failing that, take archive.org's
   most recent existing capture — but only if it is fresh. Every source is
   FATF's own HTML; the only thing we refuse is STALE data, because diffing the
   saved state against a pre-plenary capture would raise reversed/false alerts.
   When no fresh authoritative capture is reachable (e.g. archive.org is briefly
   down) the caller SKIPS the run cleanly rather than alerting, persisting, or
   failing red. Alerts still tell the officer to verify on fatf-gafi.org.
   Returns { html, source } on success, or null when nothing fresh is reachable. */
async function fetchFatfSegments() {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en'
  };
  /* 1. The official FATF page, fetched directly. */
  try {
    const r = await fetch(FATF_URL, { headers, redirect: 'follow' });
    console.log('fatf-gafi.org direct: ' + r.status);
    if (r.ok) return { html: await r.text(), source: 'fatf-gafi.org (live)' };
  } catch (e) { console.log('fatf direct error: ' + e.message); }
  /* 2. The same official page, captured fresh via archive.org Save Page Now.
        archive.org reaches fatf-gafi.org even though our runner is 403'd, and the
        response is FATF's own HTML. Anonymous SPN is rate-limited and often
        returns a transient 5xx/429, so retry with backoff. We trust the result
        only when SPN redirected to a genuinely fresh /web/<timestamp>/ capture —
        never an interstitial or an old snapshot it fell back to. */
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const r = await fetch('https://web.archive.org/save/' + FATF_URL, { headers, redirect: 'follow' });
      console.log('archive.org Save Page Now (attempt ' + attempt + '): ' + r.status + ' -> ' + r.url);
      if (r.ok) {
        const ts = (/\/web\/(\d{14})\//.exec(r.url || '') || [])[1] || '';
        const age = snapshotAgeDays(ts);
        if (ts && age <= SNAPSHOT_STALE_DAYS) {
          return { html: await r.text(), source: 'fatf-gafi.org via archive.org Save Page Now ' + ts };
        }
        console.log('Save Page Now did not yield a fresh timestamped capture (ts=' + (ts || 'none') + ') — not trusting it');
        break; /* a clean 200 without a fresh capture won't improve on retry */
      }
      if (r.status !== 429 && r.status < 500) break; /* only 429/5xx are worth retrying */
    } catch (e) { console.log('save-page-now error (attempt ' + attempt + '): ' + e.message); }
    if (attempt < 3) await new Promise(res => setTimeout(res, attempt * 8000)); /* 8s, then 16s */
  }
  /* 3. archive.org's most recent existing capture of the official page, via the
        availability API — used only when it is fresh (a recent crawl), so it is
        an authoritative current capture and never a pre-plenary one. */
  try {
    const av = await fetch('https://archive.org/wayback/available?url=' + encodeURIComponent(FATF_URL), { headers });
    console.log('wayback availability API: ' + av.status);
    if (av.ok) {
      const closest = (await av.json())?.archived_snapshots?.closest;
      const ts = closest && closest.timestamp;
      const age = snapshotAgeDays(ts);
      console.log('latest existing snapshot: ' + (ts || 'none') + (ts ? ' (' + Math.round(age) + 'd old)' : ''));
      if (closest && closest.url && ts && age <= SNAPSHOT_STALE_DAYS) {
        const s = await fetch(closest.url.replace(/^http:/, 'https:'), { headers, redirect: 'follow' });
        console.log('fetch snapshot ' + ts + ': ' + s.status);
        if (s.ok) return { html: await s.text(), source: 'fatf-gafi.org via web.archive.org snapshot ' + ts };
      }
    }
  } catch (e) { console.log('wayback availability error: ' + e.message); }
  /* No fresh authoritative capture reachable. Signal a clean skip — do NOT diff
     against stale or third-party data (it would raise reversed/false alerts) and
     do NOT fail red over a transient archive outage. */
  return null;
}


async function listProjectTasks(fields) {
  const out = [];
  const base = '/projects/' + PROJECT_GID + '/tasks?limit=100&opt_fields=' + (fields || 'name,notes');
  let path = base;
  while (path) {
    const d = await asana(path);
    out.push(...(d.data || []));
    path = d.next_page ? base + '&offset=' + d.next_page.offset : null;
  }
  return out;
}

async function findAffected(changedCountries) {
  const affected = [];
  for (const t of await listProjectTasks('name,notes')) {
    for (const c of changedCountries) {
      if ((t.notes || '').includes('Jurisdiction: ' + c)) { affected.push(t.name + ' (' + c + ')'); break; }
    }
  }
  return affected;
}

async function createTask(name, notes, due, project, section) {
  due = due || new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const target = project || PROJECT_GID;
  /* Re-run idempotency: a workflow retry after a successful post (e.g. the
     state commit failed) must not file the same alert twice. Best-effort. */
  try {
    const dup = findRecentDuplicate(await listTasksIn(target), name, Date.now());
    if (dup) { console.log('watchdog: identical task already filed within 6h — skipping ("' + name + '")'); return dup.permalink_url; }
  } catch (e) { console.warn('watchdog: duplicate check failed (' + (e && e.message || e) + ') — posting anyway'); }
  /* Assigned so the alert reaches the compliance officer's Asana inbox. */
  const d = await asana('/tasks', { method: 'POST', body: JSON.stringify({ data: { name, notes, projects: [target], due_on: due, assignee: 'me' } }) });
  /* File under a section when given so the project stays organised. Non-fatal. */
  if (section && d.data && d.data.gid) {
    try { await asana('/sections/' + section + '/addTask', { method: 'POST', body: JSON.stringify({ data: { task: d.data.gid } }) }); }
    catch (e) { console.warn('watchdog: could not move task to section ' + section + ' (' + (e && e.message || e) + ')'); }
  }
  return d.data.permalink_url;
}

/* Client tasks are named "<ref> · <entity> · <band> <score>"; everything else
   in the project (backlog, QA, FATF alerts, digests) is ignored. Returns one
   line per client whose next review falls on or before monthEnd, oldest first. */
export function collectReviewsDue(tasks, today, monthEnd) {
  const dmy = iso => iso.split('-').reverse().join('/');
  return (tasks || [])
    .filter(t => !t.completed
      && /^\d{4}-\d{2}-\d{2}$/.test(String(t.due_on || ''))
      && / · (CDD|SDD|EDD) \d+$/.test(String(t.name || ''))
      && t.due_on <= monthEnd)
    .sort((a, b) => a.due_on.localeCompare(b.due_on))
    .map(t => '- ' + t.name + ': review due ' + dmy(t.due_on) + (t.due_on < today ? ' (OVERDUE)' : ''));
}

/* Pulls the JSON sheet out of the auto-backup task's notes (written by
   netlify/functions/risk-backup.js between the marker lines). */
export function extractSheet(notes) {
  const m = /===RISK DATA SHEET===\n([\s\S]*?)\n===END===/.exec(String(notes || ''));
  if (!m) return null;
  try {
    const s = JSON.parse(m[1]);
    return (s && typeof s === 'object' && s.overrides && typeof s.overrides === 'object') ? s : null;
  } catch (e) { return null; }
}

export async function main(mode) {
  if (!process.env.ASANA_ACCESS_TOKEN) throw new Error('ASANA_ACCESS_TOKEN secret is not configured in GitHub Actions');

  if (mode === 'test-alert') {
    const url = await createTask('[TEST] FATF Watchdog connectivity check', 'The watchdog can reach Asana and create tasks. Close this task. Created ' + new Date().toISOString().slice(0, 10) + '.', undefined, REG_PROJECT_GID, REG_FATF_SECTION_GID);
    console.log('test task created: ' + url);
    return;
  }

  if (mode === 'digest') {
    /* Monthly "Reviews due" digest: one task naming every client whose next
       review falls due this month (or is still open from before). Idempotent:
       skipped if this month's digest already exists, silent when nothing is due. */
    const now = new Date();
    // Compute the month window entirely in UTC so `today` (ISO/UTC) and the
    // month label/end never disagree near a month boundary in a non-UTC TZ
    // (`today` was UTC while the month math used local time).
    const label = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][now.getUTCMonth()] + ' ' + now.getUTCFullYear();
    const title = 'Reviews due: ' + label;
    const today = now.toISOString().slice(0, 10);
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
    const monthEnd = end.getUTCFullYear() + '-' + String(end.getUTCMonth() + 1).padStart(2, '0') + '-' + String(end.getUTCDate()).padStart(2, '0');
    const tasks = await listProjectTasks('name,due_on,completed');
    if (tasks.some(t => String(t.name || '') === title)) { console.log('digest already exists: ' + title); return; }
    const lines = collectReviewsDue(tasks, today, monthEnd);
    if (!lines.length) { console.log('no client reviews due in ' + label + ' - staying silent'); return; }
    const notes = 'Customer risk reviews falling due in ' + label + ', including any still open from earlier months:\n\n'
      + lines.join('\n')
      + '\n\nFor each client: open the app, open the client from the Register, run Re-assess, complete the assessment, and close its Asana task. The dates above mirror each assessment\'s Next Review Date.'
      + '\nApp: https://hawkeye-sterling-ra.netlify.app';
    const url = await createTask(title, notes, monthEnd);
    console.log('digest task created (' + lines.length + ' client' + (lines.length === 1 ? '' : 's') + '): ' + url);
    return;
  }

  if (mode === 'probe') {
    /* Diagnostic: print what the source chain returns and how it classifies,
       so list discrepancies can be traced to source content vs parsing. */
    const baseline = loadBaseline(readFileSync('app.js', 'utf8'));
    const fetched = await fetchFatfSegments();
    if (!fetched) { console.log('no fresh authoritative FATF capture reachable — nothing to probe. Verify manually on ' + FATF_URL); return; }
    console.log('source: ' + fetched.source);
    const current = classifyCountries(fetched.html, baseline);
    console.log('black: ' + current.black.join(', '));
    console.log('grey (' + current.grey.length + '): ' + current.grey.join(', '));
    const flat = fetched.html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
    for (const probe of ['virgin islands', 'congo', 'guinea', 'sudan', 'no longer subject', 'find out more']) {
      const fl = flat.toLowerCase();
      let i = -1, n = 0;
      while ((i = fl.indexOf(probe, i + 1)) !== -1 && n < 6) {
        n++;
        console.log('probe "' + probe + '" #' + n + ': …' + flat.slice(Math.max(0, i - 70), i + 90) + '…');
      }
      if (!n) console.log('probe "' + probe + '": absent');
    }
    return;
  }

  if (mode === 'backup-risk-data') {
    /* Commit the officer's override sheet (mirrored into Asana by the app on
       every change) to the repository, so the browser-held risk data has an
       off-device backup with a git audit trail. */
    const tasks = await listProjectTasks('name,notes');
    const mirror = tasks.find(t => String(t.name || '') === 'RISK DATA SHEET (auto-backup)');
    if (!mirror) { console.log('no risk-data mirror task yet - nothing to back up'); return; }
    const sheet = extractSheet(mirror.notes);
    if (!sheet) throw new Error('risk-data mirror task exists but its sheet could not be parsed - check the task notes');
    mkdirSync('data', { recursive: true });
    writeFileSync('data/risk-overrides-backup.json', JSON.stringify(sheet, null, 2) + '\n');
    console.log('risk-data sheet backed up to data/risk-overrides-backup.json (sheet updated ' + (sheet.updatedAt || 'unknown') + ')');
    return;
  }

  if (mode === 'setup-sections') {
    /* One-time helper: ensure the four risk-band sections exist so completed
       assessments file into them (see netlify/functions/asana-task.js). */
    const names = ['LOW RISK (CDD)', 'MEDIUM RISK (SDD)', 'HIGH RISK (EDD)', 'PROHIBITED (DO NOT ONBOARD)'];
    const existing = ((await asana('/projects/' + PROJECT_GID + '/sections?limit=100')).data || [])
      .map(s => String(s.name || '').trim().toUpperCase());
    for (const n of names) {
      if (existing.includes(n.toUpperCase())) { console.log('section exists: ' + n); continue; }
      await asana('/projects/' + PROJECT_GID + '/sections', { method: 'POST', body: JSON.stringify({ data: { name: n } }) });
      console.log('section created: ' + n);
    }
    return;
  }

  const baseline = loadBaseline(readFileSync('app.js', 'utf8'));
  const fetched = await fetchFatfSegments();
  if (!fetched) {
    /* No fresh authoritative capture this run (e.g. archive.org briefly down).
       Skip cleanly: never diff against stale data, never fail red. BUT count
       consecutive skips — a source that stays unreachable run after run means the
       FATF list is going UNMONITORED, which must be surfaced, not silently green. */
    console.log('no fresh authoritative FATF capture reachable this run — skipping (state unchanged). Verify manually on ' + FATF_URL);
    try {
      /* read-and-catch (no existsSync pre-check) — avoids a TOCTOU race between
         the check and the read; a missing/garbled file simply starts a fresh {}. */
      let st = {};
      try { st = JSON.parse(readFileSync(STATE_FILE, 'utf8')); } catch { st = {}; }
      st.skipStreak = (Number(st.skipStreak) || 0) + 1;
      st.lastSkip = new Date().toISOString().slice(0, 10);
      mkdirSync('data', { recursive: true });
      writeFileSync(STATE_FILE, JSON.stringify(st, null, 2) + '\n');
      if (st.skipStreak >= FATF_SKIP_ALERT && REG_PROJECT_GID) {
        const url = await createTask(
          '⚠ FATF monitoring GAP — list source unreachable ' + st.skipStreak + ' consecutive run(s)',
          'The FATF black/grey-list watchdog could not reach an authoritative capture (direct + archive) for '
          + st.skipStreak + ' consecutive runs. FATF list moves may be UNDETECTED. Verify manually on ' + FATF_URL
          + ' and check the source endpoints.', undefined, REG_PROJECT_GID, REG_FATF_SECTION_GID);
        console.log('FATF monitoring-gap alert filed (skipStreak=' + st.skipStreak + '): ' + url);
      }
    } catch (e) { console.error('FATF skip-streak bookkeeping failed: ' + e.message); }
    return;
  }
  console.log('list source: ' + fetched.source);
  const source = fetched.source;
  /* Source reachable again → clear any accumulated skip-streak so a later gap
     alerts fresh. Read-and-catch (no existsSync pre-check — TOCTOU-safe): a
     missing state file simply means there is no streak to clear. */
  try {
    const st = JSON.parse(readFileSync(STATE_FILE, 'utf8'));
    if (st.skipStreak) { st.skipStreak = 0; writeFileSync(STATE_FILE, JSON.stringify(st, null, 2) + '\n'); }
  } catch (e) { /* no state yet / unreadable — nothing to reset */ }
  const current = classifyCountries(fetched.html, baseline);
  /* Safety: an empty/tiny list, an implausibly large "black" list, or black/grey
     overlap all mean the source was parsed wrong — stop before alerting or persisting. */
  assertPlausible(current);
  console.log('FATF now — black:', current.black.join(', '), '| grey:', current.grey.length, 'countries');

  /* Read-and-catch (no existsSync pre-check — TOCTOU-safe). Seed when there is
     no usable PRIOR LIST STATE: missing/garbled file, or a file that carries only
     skip-streak bookkeeping (written by an unreachable-source run before any
     seed) — diffing against a list-less state would read as "everything added". */
  let prev = null;
  try { prev = JSON.parse(readFileSync(STATE_FILE, 'utf8')); } catch { prev = null; }
  if (mode === 'seed' || !prev || !Array.isArray(prev.black)) {
    mkdirSync('data', { recursive: true }); /* git does not keep empty dirs */
    writeFileSync(STATE_FILE, JSON.stringify({ ...current, updated: new Date().toISOString().slice(0, 10) }, null, 2) + '\n');
    console.log('state seeded — no alert on the first run');
    return;
  }

  const diff = diffLists(prev, current);
  const changed = [...diff.blackAdded, ...diff.blackRemoved, ...diff.greyAdded, ...diff.greyRemoved];
  if (!changed.length) { console.log('no FATF list changes — staying silent'); return; }

  const today = new Date().toISOString().slice(0, 10).split('-').reverse().join('/');
  const affected = await findAffected(changed);
  const notes = buildAlert(diff, baseline, affected, today) + '\n\nDetected via: ' + source + '. Verify on the official FATF site before acting.';
  const url = await createTask('FATF list change: ' + changed.join(', '), notes, undefined, REG_PROJECT_GID, REG_FATF_SECTION_GID);
  console.log('alert task created: ' + url);
  writeFileSync(STATE_FILE, JSON.stringify({ ...current, updated: new Date().toISOString().slice(0, 10) }, null, 2) + '\n');
}

if (process.argv[1] && process.argv[1].endsWith('fatf-watchdog.mjs')) {
  main(process.argv[2] || 'check').catch(e => { console.error(e.message); process.exit(1); });
}
