/* FATF Watchdog — compares FATF's published black/grey lists with the app's
   country data and, on any change, creates a review task in the RISK
   ASSESSMENTS Asana project. Detection is automatic; updating scores stays a
   human decision (senior-management approval per the compliance manual).

   Runs in GitHub Actions (.github/workflows/fatf-watchdog.yml).
   Modes: check (default) · seed (record current lists, no alert) · test-alert.
*/
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

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

export function splitFatfPage(html) {
  const lower = normalize(html);
  const blackAt = lower.indexOf('call for action');
  const greyAt = lower.indexOf('increased monitoring');
  if (blackAt === -1 || greyAt === -1) throw new Error('FATF page structure changed: section headings not found');
  const first = Math.min(blackAt, greyAt), second = Math.max(blackAt, greyAt);
  const seg1 = html.slice(first, second), seg2 = html.slice(second);
  return blackAt < greyAt ? { black: seg1, grey: seg2 } : { black: seg2, grey: seg1 };
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

/* fatf-gafi.org sits behind bot protection that 403s datacenter IPs, so we
   try the live page first and fall back to the Internet Archive's latest
   snapshot of the same page. For a monthly cadence the snapshot lag is
   negligible, and the alert only prompts a human to check the official
   source anyway. */
async function fetchFatfHtml() {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en'
  };
  try {
    const r = await fetch(FATF_URL, { headers, redirect: 'follow' });
    if (r.ok) { console.log('source: fatf-gafi.org (live)'); return await r.text(); }
    console.log('direct fetch returned ' + r.status + ' — falling back to the Web Archive');
  } catch (e) {
    console.log('direct fetch failed (' + e.message + ') — falling back to the Web Archive');
  }
  /* Attempt 2: Wayback availability API gives the closest snapshot URL. */
  try {
    const av = await fetch('https://archive.org/wayback/available?url=' + encodeURIComponent(FATF_URL), { headers });
    console.log('wayback availability API: ' + av.status);
    if (av.ok) {
      const j = await av.json();
      const closest = j && j.archived_snapshots && j.archived_snapshots.closest;
      if (closest && closest.url) {
        const snapUrl = closest.url.replace(/^http:/, 'https:');
        const s = await fetch(snapUrl, { headers, redirect: 'follow' });
        console.log('snapshot ' + (closest.timestamp || '') + ' fetch: ' + s.status);
        if (s.ok) { console.log('source: web.archive.org snapshot ' + (closest.timestamp || '')); return await s.text(); }
      } else {
        console.log('availability API returned no snapshot');
      }
    }
  } catch (e) {
    console.log('wayback availability attempt failed (' + e.message + ')');
  }
  /* Attempt 3: the /web/<year>/ redirect form. */
  const wb = await fetch('https://web.archive.org/web/2026/' + FATF_URL, { headers, redirect: 'follow' });
  console.log('wayback /web/2026/ form: ' + wb.status);
  if (!wb.ok) throw new Error('FATF page unavailable directly and via the Web Archive (' + wb.status + ')');
  console.log('source: web.archive.org (year-redirect snapshot)');
  return await wb.text();
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

async function findAffected(changedCountries) {
  const affected = [];
  let path = '/projects/' + PROJECT_GID + '/tasks?limit=100&opt_fields=name,notes';
  while (path) {
    const d = await asana(path);
    for (const t of d.data || []) {
      for (const c of changedCountries) {
        if ((t.notes || '').includes('Jurisdiction: ' + c)) { affected.push(t.name + ' (' + c + ')'); break; }
      }
    }
    path = d.next_page ? '/projects/' + PROJECT_GID + '/tasks?limit=100&opt_fields=name,notes&offset=' + d.next_page.offset : null;
  }
  return affected;
}

async function createTask(name, notes) {
  const due = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const d = await asana('/tasks', { method: 'POST', body: JSON.stringify({ data: { name, notes, projects: [PROJECT_GID], due_on: due } }) });
  return d.data.permalink_url;
}

export async function main(mode) {
  if (!process.env.ASANA_ACCESS_TOKEN) throw new Error('ASANA_ACCESS_TOKEN secret is not configured in GitHub Actions');

  if (mode === 'test-alert') {
    const url = await createTask('[TEST] FATF Watchdog connectivity check', 'The watchdog can reach Asana and create tasks. Close this task. Created ' + new Date().toISOString().slice(0, 10) + '.');
    console.log('test task created: ' + url);
    return;
  }

  const baseline = loadBaseline(readFileSync('index.html', 'utf8'));
  const html = await fetchFatfHtml();
  const segments = splitFatfPage(html);
  const current = {
    black: extractCountries(segments.black, baseline),
    grey: extractCountries(segments.grey, baseline)
  };
  /* Safety: a sudden empty/tiny list means the page changed shape, not mass delisting. */
  if (current.black.length < 1 || current.grey.length < 5) {
    throw new Error('FATF parse safety stop: black=' + current.black.length + ' grey=' + current.grey.length + ' — page structure likely changed');
  }
  console.log('FATF now — black:', current.black.join(', '), '| grey:', current.grey.length, 'countries');

  if (mode === 'seed' || !existsSync(STATE_FILE)) {
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
  const notes = buildAlert(diff, baseline, affected, today);
  const url = await createTask('FATF list change: ' + changed.join(', '), notes);
  console.log('alert task created: ' + url);
  writeFileSync(STATE_FILE, JSON.stringify({ ...current, updated: new Date().toISOString().slice(0, 10) }, null, 2) + '\n');
}

if (process.argv[1] && process.argv[1].endsWith('fatf-watchdog.mjs')) {
  main(process.argv[2] || 'check').catch(e => { console.error(e.message); process.exit(1); });
}
