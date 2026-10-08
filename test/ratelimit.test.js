/* Tests the shared per-IP rate limiter (netlify/functions/_ratelimit.js) and its
   integration into the function handlers.
     - under the limit → null (request proceeds);
     - at the limit → 429 with a clear message + Retry-After / RateLimit-* headers;
     - the window is per-IP (a different IP is not throttled);
     - brain-soul (sensitive endpoint) enforces the stricter limit BEFORE doing
       any work — no Anthropic key needed to observe the 429.
   No network. Usage: node test/ratelimit.test.js */

process.env.ASANA_ACCESS_TOKEN = 'test-token';
process.env.ASANA_PROJECT_GID = '0';

const path = require('path');
const RL = require(path.join(__dirname, '..', 'netlify', 'functions', '_ratelimit.js'));
const brainSoul = require(path.join(__dirname, '..', 'netlify', 'functions', 'brain-soul.js'));
const quota = require(path.join(__dirname, '..', 'netlify', 'functions', '_shared-quota.js'));

let passed = 0, failed = 0;
function check(name, cond) {
  if (cond) { passed++; console.log('  ok  ' + name); }
  else { failed++; console.log('FAIL  ' + name); }
}

const evFrom = (ip, body) => ({
  httpMethod: 'POST',
  headers: { 'x-nf-client-connection-ip': ip, origin: 'https://hawkeye-sterling-ra.netlify.app', host: 'hawkeye-sterling-ra.netlify.app' },
  body: JSON.stringify(body || {})
});

(async () => {
  // 1. Sliding window: first `limit` calls pass, the next is blocked.
  RL._reset();
  const ev = evFrom('1.2.3.4');
  let blocked = null;
  for (let i = 0; i < 5; i++) {
    const r = RL.rateLimit(ev, { name: 'unit', limit: 5, windowMs: 60000 });
    if (r) blocked = r;
  }
  check('under the limit (5/5) all allowed → null', blocked === null);
  const sixth = RL.rateLimit(ev, { name: 'unit', limit: 5, windowMs: 60000 });
  check('6th request over the limit → 429', sixth && sixth.statusCode === 429);

  // 2. The 429 carries a clear message and the standard headers.
  const body = JSON.parse(sixth.body);
  check('429 body says Too Many Requests', body.ok === false && body.error === 'Too Many Requests');
  check('429 message is clear (Spanish, mentions the limit)', /límite de 5/.test(body.message));
  check('429 sets Retry-After header', Number(sixth.headers['Retry-After']) >= 1);
  check('429 sets RateLimit-Limit=5 and Remaining=0',
    sixth.headers['RateLimit-Limit'] === '5' && sixth.headers['RateLimit-Remaining'] === '0');

  // 3. Per-IP isolation: a different IP is unaffected by the first IP's burst.
  const other = RL.rateLimit(evFrom('9.9.9.9'), { name: 'unit', limit: 5, windowMs: 60000 });
  check('a different IP is not throttled', other === null);

  // 4. Window names are independent (asana-task vs brain-soul keyed separately).
  const diffName = RL.rateLimit(ev, { name: 'other-endpoint', limit: 5, windowMs: 60000 });
  check('a different endpoint name has its own bucket', diffName === null);

  // 5. Integration: brain-soul enforces its stricter limit and returns 429
  //    BEFORE checking the Anthropic key (no key configured here → would be 503
  //    if the limiter were not hit first).
  RL._reset();
  delete process.env.ANTHROPIC_API_KEY;
  process.env.RATE_LIMIT_BRAIN_SOUL = '3';
  let last;
  for (let i = 0; i < 4; i++) last = await brainSoul.handler(evFrom('5.5.5.5', { question: 'hi' }));
  check('brain-soul: 4th request over the 3/min limit → 429', last.statusCode === 429);
  check('brain-soul: 429 stamped with CORS (Access-Control-Allow-Origin present)',
    !!last.headers['Access-Control-Allow-Origin']);


  // 6. Opt-in shared quota is a SECOND, fleet-wide contract with an atomic
  // remote counter. The simulated responses prove fail-closed client behavior
  // only; no actual quota backend is present or certified.
  const originalFetch = global.fetch;
  const sharedNames = [
    'SHARED_RATE_LIMIT_ENABLED', 'SHARED_RATE_LIMIT_URL',
    'SHARED_RATE_LIMIT_AUTH_TOKEN', 'SHARED_RATE_LIMIT_KEY_SECRET',
    'RATE_LIMIT_BRAIN_SOUL'
  ];
  const originalEnv = Object.fromEntries(sharedNames.map(k => [k, process.env[k]]));
  const quotaEvent = evFrom('192.0.2.77', { question: 'Synthetic compliance question' });
  try {
    let calls = 0, lastRequest;
    global.fetch = async (url, options) => {
      calls++;
      lastRequest = { url, options };
      return { status: 200, text: async () => JSON.stringify({ allowed: true }) };
    };
    process.env.SHARED_RATE_LIMIT_ENABLED = '0';
    check('shared quota is disabled by default and never calls an outside provider',
      await quota.enforceSharedQuota(quotaEvent, { name: 'brain-soul', limit: 10, windowMs: 60000 }) === null && calls === 0);

    process.env.SHARED_RATE_LIMIT_ENABLED = '1';
    process.env.SHARED_RATE_LIMIT_URL = 'https://quota.example.test/v1/check';
    process.env.SHARED_RATE_LIMIT_AUTH_TOKEN = 'synthetic-offline-access-value-123456789';
    process.env.SHARED_RATE_LIMIT_KEY_SECRET = 'synthetic-offline-hmac-value-123456789';
    const opts = { name: 'brain-soul', limit: 10, windowMs: 60000 };
    const allowed = await quota.enforceSharedQuota(quotaEvent, opts);
    const sent = JSON.parse(lastRequest.options.body);
    check('shared quota checks approved HTTPS endpoint before permit',
      allowed === null && calls === 1 &&
      lastRequest.url === process.env.SHARED_RATE_LIMIT_URL &&
      lastRequest.options.method === 'POST' &&
      lastRequest.options.redirect === 'error');
    check('quota request contains only an HMAC pseudonym and bounded counter parameters',
      /^[0-9a-f]{64}$/.test(sent.key) && sent.limit === 10 && sent.window_ms === 60000 &&
      !JSON.stringify(sent).includes('192.0.2.77') &&
      !JSON.stringify(sent).includes('Synthetic compliance question'));
    check('shared quota provider receives credentials via server-side Authorization',
      lastRequest.options.headers.Authorization === 'Bearer ' + process.env.SHARED_RATE_LIMIT_AUTH_TOKEN);

    global.fetch = async () => { calls++; return {
      status: 200, text: async () => JSON.stringify({ allowed: false, retry_after_seconds: 31 })
    }; };
    const denied = await quota.enforceSharedQuota(quotaEvent, opts);
    check('atomic remote deny yields HTTP 429 with retry metadata',
      denied.statusCode === 429 && denied.headers['Retry-After'] === '31' &&
      JSON.parse(denied.body).retry_after_seconds === 31);

    delete process.env.SHARED_RATE_LIMIT_KEY_SECRET;
    const before = calls;
    const noSecret = await quota.enforceSharedQuota(quotaEvent, opts);
    check('enabled shared quota refuses to proceed without an HMAC key',
      noSecret.statusCode === 503 && calls === before);
    process.env.SHARED_RATE_LIMIT_KEY_SECRET = 'synthetic-offline-hmac-value-123456789';

    process.env.SHARED_RATE_LIMIT_URL = 'http://127.0.0.1/internal';
    const badUrl = await quota.enforceSharedQuota(quotaEvent, opts);
    check('misconfigured insecure or local quota origin fails before fetch',
      badUrl.statusCode === 503 && calls === before);
    process.env.SHARED_RATE_LIMIT_URL = 'https://quota.example.test/v1/check';

    process.env.SHARED_RATE_LIMIT_ENABLED = 'truue';
    const typo = await quota.enforceSharedQuota(quotaEvent, opts);
    check('typo in shared quota security switch fails closed rather than disabling quota',
      typo.statusCode === 503 && calls === before);
    process.env.SHARED_RATE_LIMIT_ENABLED = 'on';

    global.fetch = async () => { calls++; return {
      status: 503, text: async () => 'upstream failed'
    }; };
    check('quota provider outage fails closed',
      (await quota.enforceSharedQuota(quotaEvent, opts)).statusCode === 503);

    global.fetch = async () => { calls++; return {
      status: 200, text: async () => JSON.stringify({ allowed: 'yes' })
    }; };
    check('malformed provider decision cannot become an allow',
      (await quota.enforceSharedQuota(quotaEvent, opts)).statusCode === 503);

    global.fetch = async () => { calls++; throw Error('offline network failure'); };
    check('quota network exception fails closed without leaking error detail',
      (await quota.enforceSharedQuota(quotaEvent, opts)).statusCode === 503);

    // Integration: it is hit BEFORE the billed Anthropic request, even if the
    // optional provider is unavailable and the local limiter has capacity.
    RL._reset();
    process.env.RATE_LIMIT_BRAIN_SOUL = '10';
    let countAtIntegration = calls;
    const res = await brainSoul.handler(evFrom('192.0.2.88', { question: 'Synthetic check' }));
    check('Advisor with enabled shared-quota outage returns 503 before model work',
      res.statusCode === 503 && calls === countAtIntegration + 1 &&
      /Shared rate limiter unavailable/.test(res.body));
  } finally {
    global.fetch = originalFetch;
    for (const name of sharedNames) {
      if (originalEnv[name] === undefined) delete process.env[name];
      else process.env[name] = originalEnv[name];
    }
    RL._reset();
  }

  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
})();
