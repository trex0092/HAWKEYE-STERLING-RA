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
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';

export const STATE_FILE = 'data/fatf-state.json';
const FATF_URL = 'https://www.fatf-gafi.org/en/countries/black-and-grey-lists.html';
const PROJECT_GID = process.env.ASANA_PROJECT_GID || '1215653768729951'; /* RISK ASSESSMENTS */
/* Regulatory/sanctions changes (FATF list moves) go to the dedicated
   "Regulations / Governance / Sanctions" project so all monitoring alerts stay
   together; the client-assessment digest/backup stay in RISK ASSESSMENTS. */
const REG_PROJECT_GID = process.env.ASANA_REG_PROJECT_GID || '1215844297069727';
/* "FATF list moves" section of that project, so list-change alerts file neatly. */
const REG_FATF_SECTION_GID = process.env.ASANA_FATF_SECTION_GID || '1215844241048837';

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

export function loadBaseline(indexHtml) {
  const m = indexHtml.match(/const COUNTRIES = (\[.*?\]);/s);
  if (!m) throw new Error('COUNTRIES baseline not found in index.html');
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
   (e.g. a Wikipedia mirror whose "current" section was not isolated and that
   scoops up every historically-listed country) can never raise a false alert or
   overwrite the saved state. The FATF "call for action" list is tiny — only ever
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

/* A Wayback snapshot older than this is treated as possibly pre-plenary: it
   could pre-date a just-published FATF list change and so mask it. When the
   closest snapshot is staler than this, we prefer the faster-updating Wikipedia
   mirror and fall back to the stale snapshot only if Wikipedia is unreachable. */
export const SNAPSHOT_STALE_DAYS = 7;

/* Whole days since a Wayback capture. Timestamp is YYYYMMDDhhmmss (UTC); an
   unparseable value is treated as infinitely stale so it never masks a change. */
export function snapshotAgeDays(ts, now = Date.now()) {
  const m = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(String(ts || ''));
  if (!m) return Infinity;
  return (now - Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6])) / 86400000;
}

/* fatf-gafi.org 403s datacenter IPs, and archive.org now 403s runner IPs for
   page content (its JSON API still answers). Sources, in order of preference:
   1. fatf-gafi.org live page;
   2. the Wayback snapshot named by the availability API — but only when it is
      recent; a stale snapshot can pre-date a just-published plenary, so it is
      held aside and used only if Wikipedia also fails (see SNAPSHOT_STALE_DAYS);
   3. Wikipedia's FATF blacklist/greylist articles via the Wikimedia REST API
      (explicitly automation-friendly; editors update it within hours of a
      plenary), reading only the "Current" sections.
   Alerts always tell the officer to verify on the official FATF site. */
export function sliceCurrentSection(html, marker) {
  const lower = html.toLowerCase();
  let i = lower.indexOf('id="current');
  if (i === -1) i = lower.indexOf(marker);
  if (i === -1) throw new Error('wikipedia structure changed: current-list section not found');
  const j = lower.indexOf('<h2', i + 10);
  return html.slice(i, j === -1 ? undefined : j);
}

async function fetchFatfSegments() {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en'
  };
  /* 1. Official page */
  try {
    const r = await fetch(FATF_URL, { headers, redirect: 'follow' });
    console.log('fatf-gafi.org direct: ' + r.status);
    if (r.ok) {
      return { html: await r.text(), source: 'fatf-gafi.org (live)' };
    }
  } catch (e) { console.log('fatf direct error: ' + e.message); }
  /* 2. Wayback snapshot via the availability API — trusted only when recent.
        A stale snapshot is held aside as a last-resort fallback (staleFallback)
        rather than returned, so it cannot mask a just-published plenary. */
  let staleFallback = null;
  try {
    const av = await fetch('https://archive.org/wayback/available?url=' + encodeURIComponent(FATF_URL), { headers });
    console.log('wayback availability API: ' + av.status);
    if (av.ok) {
      const j = await av.json();
      const closest = j && j.archived_snapshots && j.archived_snapshots.closest;
      if (closest && closest.url) {
        const s = await fetch(closest.url.replace(/^http:/, 'https:'), { headers, redirect: 'follow' });
        console.log('wayback snapshot ' + (closest.timestamp || '') + ': ' + s.status);
        if (s.ok) {
          const age = snapshotAgeDays(closest.timestamp);
          const src = 'web.archive.org snapshot ' + (closest.timestamp || '');
          if (age <= SNAPSHOT_STALE_DAYS) return { html: await s.text(), source: src };
          console.log('wayback snapshot is ' + Math.round(age) + 'd old (> ' + SNAPSHOT_STALE_DAYS + 'd) — preferring Wikipedia mirror');
          staleFallback = { html: await s.text(), source: src + ' [stale; verify on fatf-gafi.org]' };
        }
      }
    }
  } catch (e) { console.log('wayback attempt error: ' + e.message); }
  /* 3. Wikipedia mirror via the Wikimedia REST API */
  try {
    const wikiHeaders = { ...headers, 'Api-User-Agent': 'hawkeye-sterling-ra-fatf-watchdog/1.0 (compliance list monitoring)' };
    const get = async (title) => {
      const r = await fetch('https://en.wikipedia.org/api/rest_v1/page/html/' + title, { headers: wikiHeaders, redirect: 'follow' });
      console.log('wikipedia ' + title + ': ' + r.status);
      if (!r.ok) throw new Error('wikipedia ' + title + ' returned ' + r.status);
      return await r.text();
    };
    const blackSeg = sliceCurrentSection(await get('FATF_blacklist'), 'call for action');
    const greySeg = sliceCurrentSection(await get('FATF_greylist'), 'increased monitoring');
    return { blackSeg, greySeg, source: 'en.wikipedia.org mirror (verify on fatf-gafi.org)' };
  } catch (e) {
    console.log('wikipedia attempt error: ' + e.message);
    /* Wikipedia unreachable: a stale Wayback snapshot beats no signal at all. */
    if (staleFallback) { console.log('using stale wayback snapshot as last resort'); return staleFallback; }
    throw e;
  }
}

async function asana(path, opts = {}) {
  const r = await fetch('https://app.asana.com/api/1.0' + path, {
    ...opts,
    headers: {
      Authorization: 'Bearer ' + process.env.ASANA_ACCESS_TOKEN,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(opts.headers || {})
    }
  });
  const d = await r.json();
  if (!r.ok) {
    if (r.status === 401) throw new Error('Asana 401 Unauthorized — ASANA_ACCESS_TOKEN may have expired or been revoked. Rotate it in GitHub Settings → Secrets → ASANA_ACCESS_TOKEN.');
    throw new Error('Asana ' + r.status + ': ' + JSON.stringify(d.errors || d).slice(0, 300));
  }
  return d;
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
  /* Assigned so the alert reaches the compliance officer's Asana inbox. */
  const d = await asana('/tasks', { method: 'POST', body: JSON.stringify({ data: { name, notes, projects: [project || PROJECT_GID], due_on: due, assignee: 'me' } }) });
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
    const label = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][now.getMonth()] + ' ' + now.getFullYear();
    const title = 'Reviews due: ' + label;
    const today = now.toISOString().slice(0, 10);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const monthEnd = end.getFullYear() + '-' + String(end.getMonth() + 1).padStart(2, '0') + '-' + String(end.getDate()).padStart(2, '0');
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
    const baseline = loadBaseline(readFileSync('index.html', 'utf8'));
    const fetched = await fetchFatfSegments();
    console.log('source: ' + fetched.source);
    const current = fetched.html
      ? classifyCountries(fetched.html, baseline)
      : { black: extractCountries(fetched.blackSeg, baseline), grey: extractCountries(fetched.greySeg, baseline) };
    console.log('black: ' + current.black.join(', '));
    console.log('grey (' + current.grey.length + '): ' + current.grey.join(', '));
    const flat = (fetched.html || (String(fetched.blackSeg) + ' ||GREY|| ' + String(fetched.greySeg)))
      .replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
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

  const baseline = loadBaseline(readFileSync('index.html', 'utf8'));
  const fetched = await fetchFatfSegments();
  console.log('list source: ' + fetched.source);
  const source = fetched.source;
  const current = fetched.html
    ? classifyCountries(fetched.html, baseline)
    : { black: extractCountries(fetched.blackSeg, baseline), grey: extractCountries(fetched.greySeg, baseline) };
  /* Safety: an empty/tiny list, an implausibly large "black" list, or black/grey
     overlap all mean the source was parsed wrong — stop before alerting or persisting. */
  assertPlausible(current);
  console.log('FATF now — black:', current.black.join(', '), '| grey:', current.grey.length, 'countries');

  if (mode === 'seed' || !existsSync(STATE_FILE)) {
    mkdirSync('data', { recursive: true }); /* git does not keep empty dirs */
    writeFileSync(STATE_FILE, JSON.stringify({ ...current, updated: new Date().toISOString().slice(0, 10) }, null, 2) + '\n');
    console.log('state seeded — no alert on the first run');
    return;
  }

  const prev = JSON.parse(readFileSync(STATE_FILE, 'utf8'));
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
