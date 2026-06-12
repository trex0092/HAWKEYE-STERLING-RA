/* FATF Watchdog — compares FATF's published black/grey lists with the app's
   country data and, on any change, creates a review task in the RISK
   ASSESSMENTS Asana project. Detection is automatic; updating scores stays a
   human decision (senior-management approval per the compliance manual).

   Runs in GitHub Actions (.github/workflows/fatf-watchdog.yml).
   Modes: check (default) · seed (record current lists, no alert) · test-alert
   · setup-sections (create the risk-band sections) · digest (monthly
   "Reviews due" task listing clients whose next review falls due).
*/
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';

export const STATE_FILE = 'data/fatf-state.json';
const FATF_URL = 'https://www.fatf-gafi.org/en/countries/black-and-grey-lists.html';
const PROJECT_GID = process.env.ASANA_PROJECT_GID || '1215653768729951'; /* RISK ASSESSMENTS */

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
  'lao pdr': "Lao People's Democratic Republic",
  "lao people's democratic republic": "Lao People's Democratic Republic",
  'türkiye': 'Turkey',
  'turkiye': 'Turkey',
  'russia': 'Russian Federation',
  'united arab emirates': 'United Arab Emirates'
};

export function normalize(s) {
  return String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
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
    const rx = new RegExp('(^|[^a-z])(' + escapeRx(key) + ')(?=[^a-z]|$)', 'g');
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
  /* lowercase + accent fold; headings and matches use the SAME folded
     string, so positions stay mutually consistent */
  const lower = String(html || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  const positions = (needle) => {
    const out = []; let i = 0;
    while ((i = lower.indexOf(needle, i)) !== -1) { out.push(i); i += needle.length; }
    return out;
  };
  const blackPos = positions('call for action');
  const greyPos = positions('increased monitoring');
  if (!blackPos.length || !greyPos.length) throw new Error('FATF page structure changed: section headings not found');
  const dict = [
    ...baseline.map(c => ({ key: normalize(c.name), canonical: c.name })),
    ...Object.entries(ALIASES).map(([a, c]) => ({ key: normalize(a), canonical: c }))
  ].sort((a, b) => b.key.length - a.key.length);
  let masked = lower;
  const black = new Set(), grey = new Set(), decided = new Set();
  for (const { key, canonical } of dict) {
    const rx = new RegExp('(^|[^a-z])(' + escapeRx(key) + ')(?=[^a-z]|$)', 'g');
    let m;
    while ((m = rx.exec(masked)) !== null) {
      if (decided.has(canonical)) break;
      const idx = m.index + m[1].length;
      const lastBlack = [...blackPos].filter(p => p < idx).pop();
      const lastGrey = [...greyPos].filter(p => p < idx).pop();
      if (lastBlack === undefined && lastGrey === undefined) continue;
      const isBlack = lastGrey === undefined || (lastBlack !== undefined && lastBlack > lastGrey);
      (isBlack ? black : grey).add(canonical);
      decided.add(canonical);
    }
    /* mask with same-length filler so shorter names cannot rematch inside */
    masked = masked.replace(rx, (all, p1, p2) => p1 + '#'.repeat(p2.length));
  }
  return { black: [...black].sort(), grey: [...grey].sort() };
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

/* fatf-gafi.org 403s datacenter IPs, and archive.org now 403s runner IPs for
   page content (its JSON API still answers). Sources, in order of preference:
   1. fatf-gafi.org live page;
   2. the Wayback snapshot named by the availability API;
   3. Wikipedia's FATF blacklist/greylist articles via the Wikimedia REST API
      (explicitly automation-friendly), reading only the "Current" sections.
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
  /* 2. Wayback snapshot via the availability API */
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
          return { html: await s.text(), source: 'web.archive.org snapshot ' + (closest.timestamp || '') };
        }
      }
    }
  } catch (e) { console.log('wayback attempt error: ' + e.message); }
  /* 3. Wikipedia mirror via the Wikimedia REST API */
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
  if (!r.ok) throw new Error('Asana ' + r.status + ': ' + JSON.stringify(d.errors || d).slice(0, 300));
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

async function createTask(name, notes, due) {
  due = due || new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  /* Assigned so the alert reaches the compliance officer's Asana inbox. */
  const d = await asana('/tasks', { method: 'POST', body: JSON.stringify({ data: { name, notes, projects: [PROJECT_GID], due_on: due, assignee: 'me' } }) });
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

export async function main(mode) {
  if (!process.env.ASANA_ACCESS_TOKEN) throw new Error('ASANA_ACCESS_TOKEN secret is not configured in GitHub Actions');

  if (mode === 'test-alert') {
    const url = await createTask('[TEST] FATF Watchdog connectivity check', 'The watchdog can reach Asana and create tasks. Close this task. Created ' + new Date().toISOString().slice(0, 10) + '.');
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
  /* Safety: a sudden empty/tiny list means the page changed shape, not mass delisting. */
  if (current.black.length < 1 || current.grey.length < 5) {
    throw new Error('FATF parse safety stop: black=' + current.black.length + ' grey=' + current.grey.length + ' — page structure likely changed');
  }
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
  const url = await createTask('FATF list change: ' + changed.join(', '), notes);
  console.log('alert task created: ' + url);
  writeFileSync(STATE_FILE, JSON.stringify({ ...current, updated: new Date().toISOString().slice(0, 10) }, null, 2) + '\n');
}

if (process.argv[1] && process.argv[1].endsWith('fatf-watchdog.mjs')) {
  main(process.argv[2] || 'check').catch(e => { console.error(e.message); process.exit(1); });
}
