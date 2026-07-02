/* Two-way mirror of the on-device ASSESSMENT REGISTER and ACTIVITY LOG to Asana,
   so a summary survives off-device and can be pulled back ("disclosed") on any
   device after login.

   action:"write"  → upserts two dedicated tasks in the HAWKEYE STERLING APP project:
                       • "ASSESSMENT REGISTER (auto-backup)"
                       • "ACTIVITY LOG (auto-backup)"
                     each storing a JSON summary between sheet markers in its notes.
   action:"read"   → finds those two tasks and returns the parsed {register, audit}.

   The Asana token never leaves the server. Modeled on risk-backup.js / asana-task.js
   (same CORS, origin guard and API helper conventions). */
const { rateLimit } = require('./_ratelimit');
const DEFAULT_PROJECT_GID = '1216203370612914'; /* HAWKEYE STERLING APP */
const REG_TASK = 'ASSESSMENT REGISTER (auto-backup)';
const LOG_TASK = 'ACTIVITY LOG (auto-backup)';
/* Both auto-backup tasks are housekeeping mirrors — file them under the ACTIVITY LOG
   section, not the project's default first section (which is LOW RISK (CDD)). */
const LOG_SECTION = 'ACTIVITY LOG';
const SHEET_OPEN = '===HS SHEET===';
const SHEET_CLOSE = '===END===';
const MAX_NOTES = 60000; /* Asana note field practical ceiling */
const MAX_BODY = 2000000; /* reject an absurd request body before it is parsed/normalized (DoS guard) */
const MAX_REGISTER_ITEMS = 10000; /* cap the register array before per-item String() coercion */
const MAX_FIELD = 2000; /* per-field length cap so one giant string can't bloat the mirror */

/* ── pure helpers (exported for unit tests) ───────────────────────────────── */
function buildNotes(kind, data){
  const json = JSON.stringify(data, null, 2);
  return 'Automatic mirror of the in-app ' + kind + '. Do not edit by hand.\n'
    + 'Updated: ' + new Date().toISOString() + '\n\n'
    + SHEET_OPEN + '\n' + json + '\n' + SHEET_CLOSE;
}
function parseSheet(notes){
  const s = String(notes || '');
  const a = s.indexOf(SHEET_OPEN); if(a === -1) return null;
  const b = s.indexOf(SHEET_CLOSE, a + SHEET_OPEN.length); if(b === -1) return null;
  try { return JSON.parse(s.slice(a + SHEET_OPEN.length, b).trim()); } catch(e){ return null; }
}
/* Normalise whatever the client sends into compact, size-bounded structures. */
/* Bound a client string: coerce and clip so one oversized field can't bloat the note. */
function fld(v){ return String(v == null ? '' : v).slice(0, MAX_FIELD); }
function normalizeRegister(reg){
  let items = [];
  if(Array.isArray(reg)) items = reg;
  else if(reg && typeof reg === 'object') items = Object.keys(reg).map(ref => ({ ref, ...(reg[ref] || {}) }));
  /* Cap the item count BEFORE the per-item coercion below, so a huge array can't
     pin CPU/memory (the output-size 413 fires only after this map runs). */
  if(items.length > MAX_REGISTER_ITEMS) items = items.slice(0, MAX_REGISTER_ITEMS);
  return items.map(r => ({
    ref: fld(r.ref),
    entity: fld(r.entity),
    outcome: fld(r.outcome),
    /* Keep a numeric/string total; never let an object through into the mirror. */
    total: (typeof r.total === 'number' || typeof r.total === 'string') ? r.total : '',
    prohibited: !!r.prohibited,
    complete: !!r.complete,
    date: fld(r.date),
    nextReview: fld(r.nextReview),
    jurisdiction: fld(r.jurisdiction),
    activity: fld(r.activity),
    savedAt: fld(r.savedAt)
  })).filter(r => r.ref);
}
function normalizeAudit(audit){
  if(!Array.isArray(audit)) return [];
  return audit.slice(-1000).map(e => ({
    ts: String(e.ts || ''), who: String(e.who || ''), ref: String(e.ref || ''),
    event: String(e.event || ''), detail: String(e.detail || ''), hash: String(e.hash || '')
  }));
}

exports._buildNotes = buildNotes;
exports._parseSheet = parseSheet;
exports._normalizeRegister = normalizeRegister;
exports._normalizeAudit = normalizeAudit;

/* ── handler ──────────────────────────────────────────────────────────────── */
exports.handler = async (event) => {
  const cors = corsHeaders(event);
  if ((event.httpMethod || '').toUpperCase() === 'OPTIONS') {
    return originAllowed(event) ? { statusCode: 204, headers: cors, body: '' }
                                : resp(403, { ok: false, error: 'origin not allowed' }, cors);
  }
  const res = await handle(event);
  res.headers = { ...(res.headers || {}), ...cors };
  return res;
};

const handle = async (event) => {
  if (event.httpMethod !== 'POST') return resp(405, { ok: false, error: 'method not allowed' });
  if (!originAllowed(event)) return resp(403, { ok: false, error: 'origin not allowed' });

  /* Per-IP rate limit (normal endpoint): default 100 req/min, tunable via env. */
  const limited = rateLimit(event, { name: 'asana-mirror', limit: Number(process.env.RATE_LIMIT_DEFAULT) || 100, windowMs: 60000 });
  if (limited) return limited;

  const token = process.env.ASANA_ACCESS_TOKEN;
  if (!token) return resp(500, { ok: false, error: 'ASANA_ACCESS_TOKEN not configured' });

  /* Accept JSON only (same gate as asana-task.js). A present, non-JSON Content-Type
     is rejected; the browser callers (fetch + sendBeacon Blob) all send JSON. */
  const ctype = String((event.headers && (event.headers['content-type'] || event.headers['Content-Type'])) || '');
  if (ctype && !/application\/json/i.test(ctype)) return resp(415, { ok: false, error: 'content-type must be application/json' });

  /* Reject an oversized body before JSON.parse + normalization so a single request
     cannot pin CPU/memory (the output-size 413 below fires only AFTER normalizing). */
  if (String(event.body || '').length > MAX_BODY) return resp(413, { ok: false, error: 'request body too large' });

  let payload;
  try { payload = JSON.parse(event.body || '{}'); }
  catch (e) { return resp(400, { ok: false, error: 'invalid JSON' }); }

  const project = process.env.ASANA_PROJECT_GID || DEFAULT_PROJECT_GID;
  const action = payload.action === 'read' ? 'read' : 'write';

  try {
    if (action === 'read') {
      const reg = await findTask(token, project, REG_TASK);
      const log = await findTask(token, project, LOG_TASK);
      return resp(200, {
        ok: true,
        register: reg ? (parseSheet(reg.notes) || []) : [],
        audit: log ? (parseSheet(log.notes) || []) : []
      });
    }

    /* write */
    const register = normalizeRegister(payload.register);
    const audit = normalizeAudit(payload.audit);
    const regNotes = buildNotes('assessment register', register);
    const logNotes = buildNotes('activity log', audit);
    if (regNotes.length > MAX_NOTES || logNotes.length > MAX_NOTES) {
      return resp(413, { ok: false, error: 'backup too large for a single Asana note' });
    }
    /* Resolve the ACTIVITY LOG section once; a section problem must never lose a backup. */
    let section = null;
    try { section = await ensureSection(token, project, LOG_SECTION); } catch (e) { section = null; }
    const r1 = await upsertTask(token, project, REG_TASK, regNotes, section);
    const r2 = await upsertTask(token, project, LOG_TASK, logNotes, section);
    if (!r1.ok || !r2.ok) return resp(502, { ok: false, error: 'asana write failed' });
    return resp(200, { ok: true, register: { gid: r1.gid }, audit: { gid: r2.gid }, counts: { register: register.length, audit: audit.length } });
  } catch (e) {
    /* An expired/revoked token is actionable — surface it distinctly so a read does
       not look like "no backups yet" and a write does not look like a generic outage. */
    if (e && e.status === 401) return resp(401, { ok: false, error: 'Asana token unauthorized — rotate ASANA_ACCESS_TOKEN' });
    return resp(502, { ok: false, error: 'asana unreachable' });
  }
};

/* Find a task by exact name within the project (handles pagination). Returns null
   only when the task genuinely does not exist. An UPSTREAM error (401 expired token,
   429, 5xx) THROWS with the status attached, so callers surface a real failure
   instead of masking it as "no backup found yet" (which on read returns an empty
   register, indistinguishable from a token failure). */
async function findTask(token, project, name) {
  let path = '/projects/' + project + '/tasks?limit=100&opt_fields=name,notes';
  let it = 0;
  while (path && it < 50) {
    it++;
    const page = await api(token, 'GET', path);
    if (!page.ok) { const e = new Error('asana read failed'); e.status = page.status; throw e; }
    const hit = (page.body.data || []).find(t => String(t.name || '') === name);
    if (hit) return hit;
    path = (page.body.next_page && page.body.next_page.offset)
      ? '/projects/' + project + '/tasks?limit=100&opt_fields=name,notes&offset=' + page.body.next_page.offset : null;
  }
  return null;
}

/* Update the dedicated task in place, or create it if missing (no duplicates), then file it
   into `section`. Filing both places new tasks and self-heals existing ones a user dragged
   elsewhere; a section error must never lose the backup. */
async function upsertTask(token, project, name, notes, section) {
  const found = await findTask(token, project, name);
  let gid = null, updated = false;
  if (found && found.gid) {
    const upd = await api(token, 'PUT', '/tasks/' + found.gid, { data: { notes } });
    if (upd.ok) { gid = found.gid; updated = true; }
  }
  if (!gid) {
    const made = await api(token, 'POST', '/tasks', { data: { name, notes, projects: [project] } });
    /* Guard a malformed 2xx (empty/non-JSON body) so made.body.data.gid can't throw. */
    if (!made.ok || !(made.body && made.body.data && made.body.data.gid)) return { ok: false };
    gid = made.body.data.gid;
  }
  if (section) {
    try { await api(token, 'POST', '/sections/' + section + '/addTask', { data: { task: gid } }); }
    catch (e) { /* leave the task where it is rather than lose it */ }
  }
  return { ok: true, gid, updated };
}

/* Find the section by name (case-insensitive) or create it. Mirrors asana-task.js:
   on a create failure/race, re-list and reuse the section that now exists. */
async function ensureSection(token, project, name) {
  const list = await api(token, 'GET', '/projects/' + project + '/sections?limit=100');
  if (list.ok) {
    const hit = (list.body.data || []).find(s => String(s.name || '').trim().toUpperCase() === name.toUpperCase());
    if (hit) return hit.gid;
  }
  const made = await api(token, 'POST', '/projects/' + project + '/sections', { data: { name } });
  if (made.ok && made.body && made.body.data) return made.body.data.gid;
  const relist = await api(token, 'GET', '/projects/' + project + '/sections?limit=100');
  if (relist.ok) {
    const hit = (relist.body.data || []).find(s => String(s.name || '').trim().toUpperCase() === name.toUpperCase());
    if (hit) return hit.gid;
  }
  return null;
}

/* Abort a hung Asana call rather than letting it pin the function until the
   platform kills it. Overridable via ASANA_TIMEOUT_MS (kept small in tests). */
const ASANA_TIMEOUT_MS = Number(process.env.ASANA_TIMEOUT_MS) || 15000;

async function api(token, method, path, body) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ASANA_TIMEOUT_MS);
  let r;
  try {
    r = await fetch('https://app.asana.com/api/1.0' + path, {
      method,
      signal: ctrl.signal,
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: body ? JSON.stringify(body) : undefined
    });
  } finally {
    clearTimeout(timer);
  }
  const d = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, body: d };
}

/* ── CORS / origin (identical policy to risk-backup.js) ───────────────────── */
const PRIMARY_ORIGIN = process.env.PRIMARY_ORIGIN || 'https://hawkeye-sterling-ra.netlify.app';
function allowedOrigins() {
  const extra = String(process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  return [PRIMARY_ORIGIN, ...extra];
}
function originAllowed(event) {
  const h = (event && event.headers) || {};
  const origin = h.origin || h.Origin;
  if (!origin) return true;
  const host = h.host || h.Host || '';
  const originHost = String(origin).replace(/^[a-z]+:\/\//i, '').split('/')[0];
  if (host && originHost === host) return true;
  return allowedOrigins().includes(origin);
}
function corsHeaders(event) {
  const h = (event && event.headers) || {};
  const origin = h.origin || h.Origin;
  const headers = { 'Vary': 'Origin' };
  if (origin && originAllowed(event)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS';
    headers['Access-Control-Allow-Headers'] = 'Content-Type';
    headers['Access-Control-Max-Age'] = '86400';
  }
  return headers;
}
function resp(statusCode, obj, extra) {
  return { statusCode, headers: { 'Content-Type': 'application/json', ...(extra || {}) }, body: JSON.stringify(obj) };
}
