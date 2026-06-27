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

const path = require('path');
const asanaTask = require(path.join(__dirname, '..', 'netlify', 'functions', 'asana-task.js'));
const riskBackup = require(path.join(__dirname, '..', 'netlify', 'functions', 'risk-backup.js'));

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

  global.fetch = origFetch;
  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
})();
