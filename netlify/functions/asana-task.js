/* Creates an Asana task in the RISK ASSESSMENTS project when an assessment
   is marked Complete. The task is filed into the section matching its risk
   band (LOW / MEDIUM / HIGH / PROHIBITED — created on demand) and assigned,
   so Asana itself raises reminders as the review due date approaches.
   The Asana token lives in the Netlify environment (ASANA_ACCESS_TOKEN)
   and never reaches the browser. */
const { rateLimit } = require('./_ratelimit');
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

/* CORS is applied here, at the function boundary. The wrapper answers the
   browser's preflight (OPTIONS) and stamps the CORS headers onto every response
   the inner handler returns, so the allow-list lives in exactly one place. */
exports.handler = async (event) => {
  const cors = corsHeaders(event);
  if ((event.httpMethod || '').toUpperCase() === 'OPTIONS') {
    return originAllowed(event)
      ? { statusCode: 204, headers: cors, body: '' }
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
  const limited = rateLimit(event, { name: 'asana-task', limit: Number(process.env.RATE_LIMIT_DEFAULT) || 100, windowMs: 60000 });
  if (limited) return limited;

  const token = process.env.ASANA_ACCESS_TOKEN;
  if (!token) return resp(500, { ok: false, error: 'ASANA_ACCESS_TOKEN not configured' });

  /* Accept JSON only. A present, non-JSON Content-Type is rejected (415); a missing
     header is tolerated (some clients omit it). Defence in depth on the body parser. */
  const ctype = String((event.headers && (event.headers['content-type'] || event.headers['Content-Type'])) || '');
  if (ctype && !/application\/json/i.test(ctype)) return resp(415, { ok: false, error: 'content-type must be application/json' });

  let payload;
  try { payload = JSON.parse(event.body || '{}'); }
  catch (e) { return resp(400, { ok: false, error: 'invalid JSON' }); }

  const name = String(payload.name || '').trim().slice(0, 250);
  const notes = String(payload.notes || '').slice(0, 60000);
  const dueOn = /^\d{4}-\d{2}-\d{2}$/.test(String(payload.due_on || '')) ? payload.due_on : null;
  const sectionName = SECTIONS[String(payload.band || '')] || null;
  const gid = /^\d{1,30}$/.test(String(payload.gid || '')) ? String(payload.gid) : null;
  if (!name) return resp(400, { ok: false, error: 'name required' });

  /* The stable per-assessment reference. The display `name` embeds the (mutable)
     outcome+score, so it is NOT a reliable dedup key across a re-score; the ref is.
     Only trust a real ref — the client sends '(no ref)' inside `name` when empty, so
     an empty/placeholder ref falls back to exact-name matching below. */
  const ref = String(payload.ref || '').trim();
  const refSafe = !!ref && ref !== '(no ref)' && ref.length <= 120;

  /* Optional structured values → native Asana custom fields, so the RISK
     ASSESSMENTS project is filterable/reportable and reconciliation can be
     field-level rather than name-parsing. Each maps to an env-configured custom-
     field GID (ASANA_CF_*); the feature is inert until those GIDs are set, and is
     applied best-effort AFTER the task exists so it can never lose a delivery. */
  const tier = sectionName ? String(payload.band) : '';
  const score = (payload.score == null || payload.score === '') ? '' : String(payload.score).slice(0, 40);
  const customFields = buildCustomFields({ ref, tier, score, nextReview: dueOn || '' });

  const project = process.env.ASANA_PROJECT_GID || DEFAULT_PROJECT_GID;
  if (!process.env.ASANA_PROJECT_GID) console.warn('ASANA_PROJECT_GID not set — using hardcoded default project GID');

  /* Dedup: a re-submission of the SAME content within DEDUP_WINDOW_MS returns the
     cached result (absorbs double-clicks). The key includes band and a hash of the
     notes+due_on so an EDITED re-submit misses the cache and its new content is
     written through, rather than being masked by a stale cached gid (lost update). */
  const cacheKey = name + '\x00' + String(payload.band || '') + '\x00' + contentHash(notes + '\x00' + (dueOn || ''));
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
        await applyCustomFields(token, gid, customFields);
        return resp(200, { ok: true, gid, url: upd.body?.data?.permalink_url ?? null, section: section ? sectionName : null, updated: true });
      }
      /* Only a genuine 404 means the remembered task no longer exists — recreate it.
         A transient (429/5xx) or auth (401/403) failure must NOT fall through to a
         create, or a still-existing task gets a duplicate. Surface the status so the
         client retries the SAME reference instead. */
      if (upd.status !== 404) {
        const msg = (upd.body && upd.body.errors && upd.body.errors[0] && upd.body.errors[0].message) || ('asana update failed (' + upd.status + ')');
        return resp(upd.status || 502, { ok: false, error: msg });
      }
      /* 404 → the remembered task was deleted in Asana; fall through to create a fresh one. */
    }

    /* Cross-instance dedup: the in-memory cache misses when two near-simultaneous
       submits land on different (cold-started) function instances, so confirm
       Asana doesn't already hold a task with this exact name before creating one.
       If it does, update it in place instead of duplicating. Best-effort — a
       lookup failure falls through to a normal create. */
    if (!gid) {
      let existing = null;
      /* First try an O(1) idempotency lookup by the task's external id (= ref);
         if unsupported or not found it returns null and we fall back to the stable
         ref-prefix scan (survives a re-score), then exact name. Best-effort — any
         failure never changes the tested behaviour below. */
      try {
        if (refSafe) existing = await findTaskByExternal(token, ref);
        if (!existing) existing = refSafe ? await findTaskByRef(token, project, ref, name) : await findTaskByName(token, project, name);
      } catch (e) { existing = null; }
      if (existing && existing.gid) {
        /* Include `name` so a task found by ref prefix is renamed to the latest
           outcome+score, not left showing the stale band. */
        const upd = await api(token, 'PUT', '/tasks/' + existing.gid, { data: { name, notes, due_on: dueOn } });
        if (upd.ok) {
          if (section) {
            try { await api(token, 'POST', '/sections/' + section + '/addTask', { data: { task: existing.gid } }); }
            catch (e) { section = null; }
          }
          await applyCustomFields(token, existing.gid, customFields);
          const dres = { ok: true, gid: existing.gid, url: (upd.body && upd.body.data && upd.body.data.permalink_url) || existing.permalink_url || null, section: section ? sectionName : null, deduplicated: true };
          _recentCache.set(cacheKey, { ...dres, ts: Date.now() });
          return resp(200, dres);
        }
        /* Found the task but the update failed. A transient/auth failure must not
           spawn a duplicate; only a 404 (deleted between find and PUT) may create. */
        if (upd.status !== 404) {
          const msg = (upd.body && upd.body.errors && upd.body.errors[0] && upd.body.errors[0].message) || ('asana update failed (' + upd.status + ')');
          return resp(upd.status || 502, { ok: false, error: msg });
        }
      }
    }

    const data = { name, notes, projects: [project], assignee: process.env.ASANA_ASSIGNEE || 'me' };
    if (dueOn) data.due_on = dueOn;
    /* Stamp the assessment reference as the task's external id — a stable, unique
       key that survives re-scores and enables O(1) idempotent lookups and
       field-level reconciliation. Set only at creation. */
    if (refSafe) data.external = { gid: ref };
    const made = await api(token, 'POST', '/tasks', { data });
    if (!made.ok) {
      const msg = (made.body && made.body.errors && made.body.errors[0] && made.body.errors[0].message) || ('asana responded ' + made.status);
      return resp(made.status, { ok: false, error: msg });
    }
    /* Guard a malformed 2xx (e.g. a 200 with an empty/non-JSON body): dereferencing
       made.body.data.gid would throw and be masked as a generic 502 'unreachable'. */
    const newGid = made.body && made.body.data && made.body.data.gid;
    if (!newGid) return resp(502, { ok: false, error: 'asana returned no task id' });
    if (section) {
      try { await api(token, 'POST', '/sections/' + section + '/addTask', { data: { task: newGid } }); }
      catch (e) { section = null; /* task stays in the default section */ }
    }
    await applyCustomFields(token, newGid, customFields);
    const result = { ok: true, gid: newGid, url: (made.body.data && made.body.data.permalink_url) || null, section: section ? sectionName : null };
    _recentCache.set(cacheKey, { ...result, ts: Date.now() });
    return resp(200, result);
  } catch (e) {
    return resp(502, { ok: false, error: 'asana unreachable' });
  }
};

/* Abort a hung Asana call rather than letting it block until the platform kills
   the function. Overridable via ASANA_TIMEOUT_MS (kept small in tests). */
const ASANA_TIMEOUT_MS = Number(process.env.ASANA_TIMEOUT_MS) || 15000;
/* Bounded auto-retry for HTTP 429 (rate limit) only — a 429 means Asana did NOT
   process the request, so retrying is safe even for a POST. 5xx is NOT retried
   (a create may have succeeded server-side, so a retry could duplicate). */
const ASANA_MAX_RETRIES = Number.isFinite(Number(process.env.ASANA_MAX_RETRIES)) && process.env.ASANA_MAX_RETRIES !== ''
  ? Number(process.env.ASANA_MAX_RETRIES) : 2;
const ASANA_RETRY_CAP_MS = Number(process.env.ASANA_RETRY_CAP_MS) || 2000;

async function api(token, method, path, body) {
  let attempt = 0;
  while (true) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), ASANA_TIMEOUT_MS);
    let r;
    try {
      r = await fetch('https://app.asana.com/api/1.0' + path, {
        method,
        signal: ctrl.signal,
        headers: {
          Authorization: 'Bearer ' + token,
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: body ? JSON.stringify(body) : undefined
      });
    } finally {
      clearTimeout(timer);
    }
    /* Asana normally returns JSON; tolerate an empty or non-JSON body (e.g. a 5xx
       gateway page) so the caller surfaces the real status instead of throwing. */
    const d = await r.json().catch(() => null);
    if (r.status === 429 && attempt < ASANA_MAX_RETRIES) {
      const ra = r.headers && r.headers.get ? Number(r.headers.get('retry-after')) : NaN;
      const waitMs = Math.min(ASANA_RETRY_CAP_MS, (Number.isFinite(ra) && ra > 0) ? ra * 1000 : 250 * Math.pow(2, attempt));
      attempt++;
      await new Promise(res => setTimeout(res, waitMs));
      continue;
    }
    return { ok: r.ok, status: r.status, body: d };
  }
}

/* Build the { <custom-field-gid>: <text value> } map from the env-configured GIDs.
   Only text values that have both a configured GID and a non-empty value are
   included; returns null when nothing is configured (feature stays inert). */
function buildCustomFields({ ref, tier, score, nextReview }) {
  const pairs = [
    [process.env.ASANA_CF_REF, ref],
    [process.env.ASANA_CF_TIER, tier],
    [process.env.ASANA_CF_SCORE, score],
    [process.env.ASANA_CF_NEXT_REVIEW, nextReview]
  ];
  const out = {};
  for (const [gidRaw, val] of pairs) {
    const g = String(gidRaw || '').trim();
    if (g && val != null && val !== '') out[g] = String(val);
  }
  return Object.keys(out).length ? out : null;
}

/* Best-effort: write custom fields on an existing task AFTER it is created/updated,
   so a custom-field type mismatch or permission error can never lose the task
   itself (same principle as section filing). No-op when nothing is configured. */
async function applyCustomFields(token, gid, customFields) {
  if (!customFields || !gid) return;
  try { await api(token, 'PUT', '/tasks/' + gid, { data: { custom_fields: customFields } }); }
  catch (e) { /* leave the task without the fields rather than fail the delivery */ }
}

/* Best-effort O(1) idempotency lookup: Asana can address a task by its external id
   as `external:<id>`. Any non-200 (unsupported, not found, error) returns null so
   the caller falls back to the paginated ref scan — behaviour never regresses. */
async function findTaskByExternal(token, ref) {
  const r = await api(token, 'GET', '/tasks/external:' + encodeURIComponent(ref) + '?opt_fields=name,permalink_url');
  return (r.ok && r.body && r.body.data && r.body.data.gid) ? r.body.data : null;
}

/* Find an existing task by EXACT name within the project (paginated) — the
   authoritative cross-instance dedup check, since the in-memory cache cannot see
   other (cold-started) function instances. Returns the task or null. */
async function findTaskByName(token, project, name) {
  let path = '/projects/' + project + '/tasks?limit=100&opt_fields=name,permalink_url';
  let it = 0;
  while (path && it < 50) {
    it++;
    const page = await api(token, 'GET', path);
    if (!page.ok || !page.body) return null;
    const data = Array.isArray(page.body.data) ? page.body.data : [];
    const hit = data.find(t => String(t.name || '') === name);
    if (hit) return hit;
    const off = page.body.next_page && page.body.next_page.offset;
    path = off ? '/projects/' + project + '/tasks?limit=100&opt_fields=name,permalink_url&offset=' + off : null;
  }
  return null;
}

/* Find the one task for a REFERENCE. A task's display name embeds the mutable
   outcome+score ("<ref> · <entity> · <band> <score>"), so an exact-name match
   misses after a re-score and would spawn a duplicate on another device. Match
   instead on the stable "<ref> · " prefix, preferring an exact-name hit when one
   exists. The trailing " · " delimiter stops ref "AC-1" from matching "AC-12".
   Paginated; returns the task or null. */
async function findTaskByRef(token, project, ref, name) {
  const prefix = ref + ' · ';
  let path = '/projects/' + project + '/tasks?limit=100&opt_fields=name,permalink_url';
  let it = 0, candidate = null;
  while (path && it < 50) {
    it++;
    const page = await api(token, 'GET', path);
    if (!page.ok || !page.body) return candidate;
    const data = Array.isArray(page.body.data) ? page.body.data : [];
    const exact = data.find(t => String(t.name || '') === name);
    if (exact) return exact;
    if (!candidate) candidate = data.find(t => String(t.name || '').startsWith(prefix)) || null;
    const off = page.body.next_page && page.body.next_page.offset;
    path = off ? '/projects/' + project + '/tasks?limit=100&opt_fields=name,permalink_url&offset=' + off : null;
  }
  return candidate;
}

/* Find the section by name (case-insensitive) or create it. If the create fails
   or races a concurrent first-time create (two completions of a brand-new band at
   once), re-list and reuse the section that now exists so both racers converge on
   one section instead of duplicating it. */
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

/* Cheap, stable, non-cryptographic string hash (djb2) — used only to make the
   double-click dedup cache key sensitive to the task's content. */
function contentHash(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/* The site's own production origin. Same-origin requests (prod + Netlify deploy
   previews) are matched against the request host below, so this is the canonical
   public domain used when no host is available. Override the whole allow-list
   with the ALLOWED_ORIGINS env var (e.g. a custom domain). */
const PRIMARY_ORIGIN = process.env.PRIMARY_ORIGIN || 'https://hawkeye-sterling-ra.netlify.app';

/* The full set of browser origins permitted to call this function. */
function allowedOrigins() {
  const extra = String(process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  return [PRIMARY_ORIGIN, ...extra];
}

/* Cross-origin guard: a browser only sends Origin on cross-site requests, so a
   missing Origin (server-to-server, curl, the GitHub Action, same-origin form
   posts) is allowed. When present, the request must be same-origin as the
   function host or appear in the allow-list — otherwise it is rejected (403). */
function originAllowed(event) {
  const h = (event && event.headers) || {};
  const origin = h.origin || h.Origin;
  if (!origin) return true;
  const host = h.host || h.Host || '';
  const originHost = String(origin).replace(/^[a-z]+:\/\//i, '').split('/')[0];
  if (host && originHost === host) return true;
  return allowedOrigins().includes(origin);
}

/* CORS response headers. The request's Origin is reflected back ONLY when it
   passes the guard, so a disallowed origin receives no Access-Control-Allow-Origin
   and the browser blocks the response. `Vary: Origin` keeps caches honest. */
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
