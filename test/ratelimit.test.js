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

  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
})();
