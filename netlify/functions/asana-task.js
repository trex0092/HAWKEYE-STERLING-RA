/* Creates an Asana task in the RISK ASSESSMENTS project when an assessment
   is marked Complete. The task is filed into the section matching its risk
   band (LOW / MEDIUM / HIGH / PROHIBITED — created on demand) and assigned,
   so Asana itself raises reminders as the review due date approaches.
   The Asana token lives in the Netlify environment (ASANA_ACCESS_TOKEN)
   and never reaches the browser. */
const DEFAULT_PROJECT_GID = '1215653768729951'; /* RISK ASSESSMENTS */

/* Module-level dedup cache: if the same assessment ref is submitted again within
   60 s (e.g. double-click or UI bug) return the cached result instead of creating
   a second task. The cache is ephemeral and resets on each cold-start. */
const _recentCache = new Map(); /* key: ref string → {gid, url, section, ts} */
const DEDUP_WINDOW_MS = 60 * 1000;
const SECTIONS = {
  CDD: 'LOW RISK (CDD)',
  SDD: 'MEDIUM RISK (SDD)',
  EDD: 'HIGH RISK (EDD)',
  PROHIBITED: 'PROHIBITED (DO NOT ONBOARD)'
};

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return resp(405, { ok: false, error: 'method not allowed' });

  const token = process.env.ASANA_ACCESS_TOKEN;
  if (!token) return resp(500, { ok: false, error: 'ASANA_ACCESS_TOKEN not configured' });

  let payload;
  try { payload = JSON.parse(event.body || '{}'); }
  catch (e) { return resp(400, { ok: false, error: 'invalid JSON' }); }

  const name = String(payload.name || '').trim().slice(0, 250);
  const notes = String(payload.notes || '').slice(0, 60000);
  const dueOn = /^\d{4}-\d{2}-\d{2}$/.test(String(payload.due_on || '')) ? payload.due_on : null;
  const sectionName = SECTIONS[String(payload.band || '')] || null;
  const gid = /^\d{1,30}$/.test(String(payload.gid || '')) ? String(payload.gid) : null;
  if (!name) return resp(400, { ok: false, error: 'name required' });

  const project = process.env.ASANA_PROJECT_GID || DEFAULT_PROJECT_GID;
  if (!process.env.ASANA_PROJECT_GID) console.warn('ASANA_PROJECT_GID not set — using hardcoded default project GID');

  /* Dedup: a re-submission of the same name within DEDUP_WINDOW_MS returns the cached result. */
  const cacheKey = name;
  const cached = _recentCache.get(cacheKey);
  if (cached && !gid && (Date.now() - cached.ts) < DEDUP_WINDOW_MS) {
    return resp(200, { ok: true, gid: cached.gid, url: cached.url, section: cached.section, deduplicated: true });
  }

  try {
    /* Resolve the risk-band section first; a section problem must never lose the task. */
    let section = null;
    if (sectionName) {
      try { section = await ensureSection(token, project, sectionName); } catch (e) { section = null; }
    }

    if (gid) {
      /* Re-completion of an already-delivered reference: update the existing
         task (one task per reference). due_on null clears a stale date, e.g.
         when an assessment turned prohibited. */
      const upd = await api(token, 'PUT', '/tasks/' + gid, { data: { name, notes, due_on: dueOn } });
      if (upd.ok) {
        if (section) {
          try { await api(token, 'POST', '/sections/' + section + '/addTask', { data: { task: gid } }); }
          catch (e) { section = null; }
        }
        return resp(200, { ok: true, gid, url: upd.body.data.permalink_url, section: section ? sectionName : null, updated: true });
      }
      /* The remembered task was deleted in Asana or is inaccessible — create a fresh one. */
    }

    const data = { name, notes, projects: [project], assignee: process.env.ASANA_ASSIGNEE || 'me' };
    if (dueOn) data.due_on = dueOn;
    const made = await api(token, 'POST', '/tasks', { data });
    if (!made.ok) {
      const msg = (made.body && made.body.errors && made.body.errors[0] && made.body.errors[0].message) || ('asana responded ' + made.status);
      return resp(made.status, { ok: false, error: msg });
    }
    if (section) {
      try { await api(token, 'POST', '/sections/' + section + '/addTask', { data: { task: made.body.data.gid } }); }
      catch (e) { section = null; /* task stays in the default section */ }
    }
    const result = { ok: true, gid: made.body.data.gid, url: made.body.data.permalink_url, section: section ? sectionName : null };
    _recentCache.set(cacheKey, { ...result, ts: Date.now() });
    return resp(200, result);
  } catch (e) {
    return resp(502, { ok: false, error: 'asana unreachable' });
  }
};

async function api(token, method, path, body) {
  const r = await fetch('https://app.asana.com/api/1.0' + path, {
    method,
    headers: {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const d = await r.json();
  return { ok: r.ok, status: r.status, body: d };
}

/* Find the section by name (case-insensitive) or create it. */
async function ensureSection(token, project, name) {
  const list = await api(token, 'GET', '/projects/' + project + '/sections?limit=100');
  if (list.ok) {
    const hit = (list.body.data || []).find(s => String(s.name || '').trim().toUpperCase() === name.toUpperCase());
    if (hit) return hit.gid;
  }
  const made = await api(token, 'POST', '/projects/' + project + '/sections', { data: { name } });
  return made.ok ? made.body.data.gid : null;
}

function resp(statusCode, obj) {
  return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(obj) };
}
