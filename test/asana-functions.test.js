/* Tests the shared Asana api() hardening in the Netlify functions
   (asana-task.js, risk-backup.js):
     - a non-JSON / empty upstream body surfaces the REAL status instead of
       being masked as a generic 502;
     - a hung request is aborted by the timeout and reported as 502;
     - the happy path still returns 200.
   No network: global.fetch is mocked. Usage: node test/asana-functions.test.js */

/* Read at module load by the functions, so set before require(). */
process.env.ASANA_ACCESS_TOKEN = 'test-token';
process.env.ASANA_PROJECT_GID = '0'; /* avoid the default-GID console.warn noise */
process.env.ASANA_TIMEOUT_MS = '50'; /* abort fast so the timeout case is quick */
process.env.ASANA_RETRY_CAP_MS = '5'; /* keep the 429 backoff near-instant in tests */

const path = require('path');
const asanaTask = require(path.join(__dirname, '..', 'netlify', 'functions', 'asana-task.js'));
const riskBackup = require(path.join(__dirname, '..', 'netlify', 'functions', 'risk-backup.js'));
const asanaMirror = require(path.join(__dirname, '..', 'netlify', 'functions', 'asana-mirror.js'));

let passed = 0, failed = 0;
function check(name, cond) {
  if (cond) { passed++; console.log('  ok  ' + name); }
  else { failed++; console.log('FAIL  ' + name); }
}

const origFetch = global.fetch;
const setFetch = (fn) => { global.fetch = fn; };
/* Distinct names dodge the functions' 60 s in-memory dedup cache. */
const event = (body) => ({ httpMethod: 'POST', headers: {}, body: JSON.stringify(body) });

(async () => {
  /* 1. Non-JSON error body → real status (503) surfaced, not a masked 502. */
  setFetch(async () => ({ ok: false, status: 503, json: () => Promise.reject(new Error('Unexpected token < in JSON')) }));
  let res = await asanaTask.handler(event({ name: 'Acme NonJson' }));
  let body = JSON.parse(res.body);
  check('asana-task: non-JSON upstream surfaces status 503 (not 502)', res.statusCode === 503);
  check('asana-task: non-JSON error message carries the real status', body.ok === false && /503/.test(body.error));

  /* 2. Hung request → aborted by the timeout → 502 unreachable, promptly. */
  setFetch((_url, opts) => new Promise((_resolve, reject) => {
    opts.signal.addEventListener('abort', () => { const e = new Error('aborted'); e.name = 'AbortError'; reject(e); });
  }));
  const t0 = Date.now();
  res = await asanaTask.handler(event({ name: 'Acme Hang' }));
  const elapsed = Date.now() - t0;
  body = JSON.parse(res.body);
  check('asana-task: hung request returns 502 unreachable', res.statusCode === 502 && body.error === 'asana unreachable');
  check('asana-task: hung request is aborted promptly (<2s)', elapsed < 2000);

  /* 3. Happy path → 200 with the created task gid. */
  setFetch(async () => ({ ok: true, status: 200, json: () => Promise.resolve({ data: { gid: 'G1', permalink_url: 'https://app.asana.com/0/0/G1' } }) }));
  res = await asanaTask.handler(event({ name: 'Acme Ok' }));
  body = JSON.parse(res.body);
  check('asana-task: happy path returns 200 ok', res.statusCode === 200 && body.ok === true);
  check('asana-task: happy path returns the task gid', body.gid === 'G1');

  /* 4. risk-backup: non-JSON upstream surfaces the real status too. */
  setFetch(async () => ({ ok: false, status: 503, json: () => Promise.reject(new Error('not json')) }));
  res = await riskBackup.handler(event({ sheet: { overrides: { 'Country|Hungary': 3 } } }));
  body = JSON.parse(res.body);
  check('risk-backup: non-JSON upstream surfaces status 503 (not 502)', res.statusCode === 503 && /503/.test(body.error));

  /* 5. risk-backup: happy path — empty lookup page, then create returns a gid. */
  setFetch(async (_url, opts) => (opts.method === 'GET')
    ? { ok: true, status: 200, json: () => Promise.resolve({ data: [] }) }
    : { ok: true, status: 200, json: () => Promise.resolve({ data: { gid: 'B1' } }) });
  res = await riskBackup.handler(event({ sheet: { overrides: { 'Country|Hungary': 3 } } }));
  body = JSON.parse(res.body);
  check('risk-backup: happy path returns 200 with gid', res.statusCode === 200 && body.ok === true && body.gid === 'B1');

  /* 6. asana-task: a same-name task already in Asana → updated in place, not duplicated. */
  setFetch(async (url, opts) => {
    const u = String(url);
    if (opts.method === 'GET' && /\/projects\/.*\/tasks/.test(u)) {
      return { ok: true, status: 200, json: () => Promise.resolve({ data: [{ gid: 'EXIST', name: 'Dup Co', permalink_url: 'u/EXIST' }] }) };
    }
    if (opts.method === 'PUT') return { ok: true, status: 200, json: () => Promise.resolve({ data: { gid: 'EXIST', permalink_url: 'u/EXIST' } }) };
    return { ok: true, status: 200, json: () => Promise.resolve({ data: { gid: 'NEW' } }) }; /* a create would (wrongly) return NEW */
  });
  res = await asanaTask.handler(event({ name: 'Dup Co' }));
  body = JSON.parse(res.body);
  check('asana-task: existing same-name task is updated in place (no duplicate)', res.statusCode === 200 && body.gid === 'EXIST' && body.deduplicated === true);

  /* ── Regression tests for the 2026-07 Asana integration audit fixes ────────── */

  /* A1 (finding #1). Cross-device dedup by REFERENCE: the stored task still carries
     its OLD name (old score/band), but a re-completion elsewhere matches on the ref
     prefix and UPDATES it in place instead of creating a duplicate. */
  {
    let posts = 0;
    setFetch(async (url, opts) => {
      const u = String(url), m = opts && opts.method;
      if (m === 'GET' && /\/sections\?/.test(u)) return { ok: true, status: 200, json: () => Promise.resolve({ data: [{ gid: 's-edd', name: 'HIGH RISK (EDD)' }] }) };
      if (m === 'GET' && /\/tasks\?/.test(u)) return { ok: true, status: 200, json: () => Promise.resolve({ data: [{ gid: 'OLD9', name: 'REF-9 · New Co · SDD 8', permalink_url: 'u/OLD9' }] }) };
      if (m === 'PUT' && /\/tasks\/OLD9$/.test(u)) return { ok: true, status: 200, json: () => Promise.resolve({ data: { gid: 'OLD9', permalink_url: 'u/OLD9' } }) };
      if (/\/addTask$/.test(u)) return { ok: true, status: 200, json: () => Promise.resolve({ data: {} }) };
      if (m === 'POST' && /\/tasks$/.test(u)) { posts++; return { ok: true, status: 200, json: () => Promise.resolve({ data: { gid: 'DUP' } }) }; }
      return { ok: true, status: 200, json: () => Promise.resolve({ data: {} }) };
    });
    const b = JSON.parse((await asanaTask.handler(event({ name: 'REF-9 · New Co · EDD 24', ref: 'REF-9', band: 'EDD' }))).body);
    check('asana-task: a re-scored assessment is matched by ref and updated in place (no cross-device duplicate)', b.gid === 'OLD9' && b.deduplicated === true && posts === 0);
  }

  /* A2 (finding #2). A transient PUT failure on the gid path must NOT create a
     duplicate — only a genuine 404 recreates; a 5xx/429 surfaces the error. */
  {
    let posts = 0;
    setFetch(async (url, opts) => {
      const u = String(url), m = opts && opts.method;
      if (m === 'GET' && /\/sections\?/.test(u)) return { ok: true, status: 200, json: () => Promise.resolve({ data: [{ gid: 's-low', name: 'LOW RISK (CDD)' }] }) };
      if (m === 'PUT' && /\/tasks\/555$/.test(u)) return { ok: false, status: 500, json: () => Promise.resolve({ errors: [{ message: 'server error' }] }) };
      if (m === 'POST' && /\/tasks$/.test(u)) { posts++; return { ok: true, status: 200, json: () => Promise.resolve({ data: { gid: 'DUP' } }) }; }
      return { ok: true, status: 200, json: () => Promise.resolve({ data: {} }) };
    });
    const res2 = await asanaTask.handler(event({ name: 'G Co · CDD 19', gid: '555', band: 'CDD' }));
    const b = JSON.parse(res2.body);
    check('asana-task: a transient PUT failure on the gid path surfaces the error, not a duplicate', res2.statusCode === 500 && b.ok === false && posts === 0);
  }

  /* A3 (finding #3). A transient PUT failure after a name-dedup hit must NOT create
     a duplicate of the task it just found. */
  {
    let posts = 0;
    setFetch(async (url, opts) => {
      const u = String(url), m = opts && opts.method;
      if (m === 'GET' && /\/sections\?/.test(u)) return { ok: true, status: 200, json: () => Promise.resolve({ data: [{ gid: 's-low', name: 'LOW RISK (CDD)' }] }) };
      if (m === 'GET' && /\/tasks\?/.test(u)) return { ok: true, status: 200, json: () => Promise.resolve({ data: [{ gid: 'HIT3', name: 'H Co · CDD 19' }] }) };
      if (m === 'PUT' && /\/tasks\/HIT3$/.test(u)) return { ok: false, status: 502, json: () => Promise.resolve({ errors: [{ message: 'bad gateway' }] }) };
      if (m === 'POST' && /\/tasks$/.test(u)) { posts++; return { ok: true, status: 200, json: () => Promise.resolve({ data: { gid: 'DUP' } }) }; }
      return { ok: true, status: 200, json: () => Promise.resolve({ data: {} }) };
    });
    const res3 = await asanaTask.handler(event({ name: 'H Co · CDD 19', band: 'CDD' }));
    const b = JSON.parse(res3.body);
    check('asana-task: a transient PUT failure after a name-dedup hit surfaces the error, not a duplicate', res3.statusCode === 502 && b.ok === false && posts === 0);
  }

  /* A7 (finding #7). The 60s dedup cache is content-aware: an identical re-submit is
     served from cache, but an EDITED re-submit (same name+band, new notes) is written
     through rather than masked by a stale cached result (no lost update). */
  {
    let posts = 0;
    setFetch(async (url, opts) => {
      const u = String(url), m = opts && opts.method;
      if (m === 'GET' && /\/tasks\?/.test(u)) return { ok: true, status: 200, json: () => Promise.resolve({ data: [] }) };
      if (m === 'POST' && /\/tasks$/.test(u)) { posts++; return { ok: true, status: 200, json: () => Promise.resolve({ data: { gid: 'CACHE1', permalink_url: 'u/CACHE1' } }) }; }
      return { ok: true, status: 200, json: () => Promise.resolve({ data: {} }) };
    });
    await asanaTask.handler(event({ name: 'CACHE Co · A', notes: 'first' }));                 /* create + cache */
    const postsAfter1 = posts;
    const r2b = JSON.parse((await asanaTask.handler(event({ name: 'CACHE Co · A', notes: 'first' }))).body);   /* same → cache hit */
    const postsAfter2 = posts;
    const r3b = JSON.parse((await asanaTask.handler(event({ name: 'CACHE Co · A', notes: 'EDITED' }))).body);  /* edited → miss */
    const postsAfter3 = posts;
    check('asana-task: identical rapid re-submit is served from the dedup cache', r2b.deduplicated === true && postsAfter1 === 1 && postsAfter2 === postsAfter1);
    check('asana-task: an edited re-submit misses the cache and is written through (no lost update)', r3b.deduplicated !== true && postsAfter3 === postsAfter1 + 1);
  }

  /* A9 (finding #9). A 2xx create with an empty/non-JSON body yields a clear error,
     not a TypeError masked as a generic "asana unreachable". */
  {
    setFetch(async (url, opts) => {
      const u = String(url), m = opts && opts.method;
      if (m === 'GET' && /\/tasks\?/.test(u)) return { ok: true, status: 200, json: () => Promise.resolve({ data: [] }) };
      if (m === 'POST' && /\/tasks$/.test(u)) return { ok: true, status: 200, json: () => Promise.reject(new Error('not json')) };
      return { ok: true, status: 200, json: () => Promise.resolve({ data: {} }) };
    });
    const res9 = await asanaTask.handler(event({ name: 'NullBody Co · CDD 19' }));
    const b = JSON.parse(res9.body);
    check('asana-task: a 2xx create with no task id yields a clear error (not a masked crash)', res9.statusCode === 502 && /no task id/.test(b.error));
  }

  /* A11 (finding #11). ensureSection converges on a concurrent create: list miss,
     create races/fails, relist reuses the section that now exists. */
  {
    let sectionGets = 0, filed = 0;
    setFetch(async (url, opts) => {
      const u = String(url), m = opts && opts.method;
      if (m === 'GET' && /\/sections\?/.test(u)) { sectionGets++; return { ok: true, status: 200, json: () => Promise.resolve({ data: sectionGets === 1 ? [] : [{ gid: 's-edd', name: 'HIGH RISK (EDD)' }] }) }; }
      if (m === 'POST' && /\/sections$/.test(u)) return { ok: false, status: 500, json: () => Promise.resolve({ errors: [{ message: 'race' }] }) };
      if (m === 'GET' && /\/tasks\?/.test(u)) return { ok: true, status: 200, json: () => Promise.resolve({ data: [] }) };
      if (/\/sections\/s-edd\/addTask$/.test(u)) { filed++; return { ok: true, status: 200, json: () => Promise.resolve({ data: {} }) }; }
      if (m === 'POST' && /\/tasks$/.test(u)) return { ok: true, status: 200, json: () => Promise.resolve({ data: { gid: 'T11', permalink_url: 'u/T11' } }) };
      return { ok: true, status: 200, json: () => Promise.resolve({ data: {} }) };
    });
    const res11 = await asanaTask.handler(event({ name: 'Race Co · EDD 24', ref: 'RACE-1', band: 'EDD' }));
    const b = JSON.parse(res11.body);
    check('asana-task: a raced section create converges (task filed into the existing section)', res11.statusCode === 200 && b.section === 'HIGH RISK (EDD)' && filed === 1);
  }

  /* A6 (finding #6). asana-mirror read with an expired token (401) surfaces a 401
     with an actionable message, NOT an empty ok:true register (which reads as
     "no backups yet" and silently wipes the Console view). */
  setFetch(async () => ({ ok: false, status: 401, json: () => Promise.resolve({ errors: [{ message: 'Not Authorized' }] }) }));
  {
    const res6 = await asanaMirror.handler(event({ action: 'read' }));
    const b = JSON.parse(res6.body);
    check('asana-mirror: read with an expired token surfaces 401 (not an empty success)', res6.statusCode === 401 && b.ok === false && /ASANA_ACCESS_TOKEN|unauthoriz/i.test(b.error));
  }

  /* ── New capabilities (2026-07): external-id idempotency, custom fields,
     429 backoff, content-type strictness ─────────────────────────────────────── */

  /* B6. A present, non-JSON Content-Type is rejected (415); JSON still works. */
  {
    const res = await asanaTask.handler({ httpMethod: 'POST', headers: { 'content-type': 'text/plain' }, body: JSON.stringify({ name: 'CT Co' }) });
    check('asana-task: a non-JSON content-type is rejected (415)', res.statusCode === 415);
  }

  /* Hardening round 2: content-type gates on the other two functions + raw-body caps. */
  {
    const res = await asanaMirror.handler({ httpMethod: 'POST', headers: { 'content-type': 'text/plain' }, body: '{}' });
    check('asana-mirror: a non-JSON content-type is rejected (415)', res.statusCode === 415);
    const res2 = await riskBackup.handler({ httpMethod: 'POST', headers: { 'content-type': 'text/plain' }, body: '{}' });
    check('risk-backup: a non-JSON content-type is rejected (415)', res2.statusCode === 415);
    const big = '{"name":"' + 'x'.repeat(1100000) + '"}';
    const res3 = await asanaTask.handler({ httpMethod: 'POST', body: big });
    check('asana-task: an oversized body is rejected before parsing (413)', res3.statusCode === 413);
    const res4 = await riskBackup.handler({ httpMethod: 'POST', body: big });
    check('risk-backup: an oversized body is rejected before parsing (413)', res4.statusCode === 413);
  }

  /* A2. A create stamps the assessment reference as the task's external id. */
  {
    let createdBody = null;
    setFetch(async (url, opts) => {
      const u = String(url), m = opts && opts.method;
      if (m === 'GET' && /\/tasks\/external:/.test(u)) return { ok: true, status: 200, json: () => Promise.resolve({ data: {} }) };
      if (m === 'GET' && /\/tasks\?/.test(u)) return { ok: true, status: 200, json: () => Promise.resolve({ data: [] }) };
      if (m === 'POST' && /\/tasks$/.test(u)) { createdBody = JSON.parse(opts.body); return { ok: true, status: 200, json: () => Promise.resolve({ data: { gid: 'EXT1' } }) }; }
      return { ok: true, status: 200, json: () => Promise.resolve({ data: {} }) };
    });
    const res = await asanaTask.handler(event({ name: 'EXT Co · CDD 19', ref: 'EXT-77' }));
    check('asana-task: a create stamps the ref as the task external id', JSON.parse(res.body).ok === true
      && createdBody && createdBody.data.external && createdBody.data.external.gid === 'EXT-77');
  }

  /* A2. An existing task found by external id is updated in place — O(1) dedup,
     no full-project scan, no duplicate. */
  {
    let posts = 0, scanned = false;
    setFetch(async (url, opts) => {
      const u = String(url), m = opts && opts.method;
      if (m === 'GET' && /\/tasks\/external:EXT-9/.test(u)) return { ok: true, status: 200, json: () => Promise.resolve({ data: { gid: 'EGID9', name: 'EXT-9 · Old · SDD 8', permalink_url: 'u/EGID9' } }) };
      if (m === 'GET' && /\/tasks\?/.test(u)) { scanned = true; return { ok: true, status: 200, json: () => Promise.resolve({ data: [] }) }; }
      if (m === 'PUT' && /\/tasks\/EGID9$/.test(u)) return { ok: true, status: 200, json: () => Promise.resolve({ data: { gid: 'EGID9', permalink_url: 'u/EGID9' } }) };
      if (m === 'POST' && /\/tasks$/.test(u)) { posts++; return { ok: true, status: 200, json: () => Promise.resolve({ data: { gid: 'DUP' } }) }; }
      return { ok: true, status: 200, json: () => Promise.resolve({ data: {} }) };
    });
    const b = JSON.parse((await asanaTask.handler(event({ name: 'EXT-9 · New · EDD 24', ref: 'EXT-9' }))).body);
    check('asana-task: a task found by external id is updated in place (O(1), no scan, no duplicate)', b.gid === 'EGID9' && b.deduplicated === true && posts === 0 && scanned === false);
  }

  /* A1. Configured custom-field GIDs are written to the task (best-effort, after
     the task exists so a field error never loses the delivery). */
  {
    process.env.ASANA_CF_REF = '111'; process.env.ASANA_CF_TIER = '222'; process.env.ASANA_CF_SCORE = '333';
    let cfPut = null;
    setFetch(async (url, opts) => {
      const u = String(url), m = opts && opts.method;
      if (m === 'GET' && /\/tasks\/external:/.test(u)) return { ok: true, status: 200, json: () => Promise.resolve({ data: {} }) };
      if (m === 'GET' && /\/tasks\?/.test(u)) return { ok: true, status: 200, json: () => Promise.resolve({ data: [] }) };
      if (m === 'GET' && /\/sections\?/.test(u)) return { ok: true, status: 200, json: () => Promise.resolve({ data: [{ gid: 's-low', name: 'LOW RISK (CDD)' }] }) };
      if (/\/addTask$/.test(u)) return { ok: true, status: 200, json: () => Promise.resolve({ data: {} }) };
      if (m === 'POST' && /\/tasks$/.test(u)) return { ok: true, status: 200, json: () => Promise.resolve({ data: { gid: 'CF1' } }) };
      if (m === 'PUT' && /\/tasks\/CF1$/.test(u)) { cfPut = JSON.parse(opts.body); return { ok: true, status: 200, json: () => Promise.resolve({ data: { gid: 'CF1' } }) }; }
      return { ok: true, status: 200, json: () => Promise.resolve({ data: {} }) };
    });
    const res = await asanaTask.handler(event({ name: 'CF Co · CDD 19', ref: 'CF-1', band: 'CDD', score: 19 }));
    const cf = cfPut && cfPut.data && cfPut.data.custom_fields;
    check('asana-task: configured custom fields (ref/tier/score) are written to the task', JSON.parse(res.body).ok === true
      && cf && cf['111'] === 'CF-1' && cf['222'] === 'CDD' && cf['333'] === '19');
    delete process.env.ASANA_CF_REF; delete process.env.ASANA_CF_TIER; delete process.env.ASANA_CF_SCORE;
  }

  /* B5. A 429 is retried with bounded backoff and then succeeds (no duplicate,
     since a 429 means Asana did not process the request). */
  {
    let posts = 0;
    setFetch(async (url, opts) => {
      const u = String(url), m = opts && opts.method;
      if (m === 'GET' && /\/tasks\?/.test(u)) return { ok: true, status: 200, json: () => Promise.resolve({ data: [] }) };
      if (m === 'POST' && /\/tasks$/.test(u)) {
        posts++;
        return posts === 1
          ? { ok: false, status: 429, json: () => Promise.resolve({ errors: [{ message: 'rate limited' }] }) }
          : { ok: true, status: 200, json: () => Promise.resolve({ data: { gid: 'R429' } }) };
      }
      return { ok: true, status: 200, json: () => Promise.resolve({ data: {} }) };
    });
    const res = await asanaTask.handler(event({ name: 'Retry Co · CDD 19' }));
    const b = JSON.parse(res.body);
    check('asana-task: a 429 is retried with backoff and then succeeds', res.statusCode === 200 && b.gid === 'R429' && posts === 2);
  }

  global.fetch = origFetch;
  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
})();
