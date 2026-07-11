/* Property-based fuzzing (fast-check) of the two CommonJS security primitives
   behind every Netlify function call — the per-IP rate limiter and the
   shared-token gate. These ingest attacker-controlled input (headers, tokens),
   so the invariants must hold for ARBITRARY values, not just fixtures:

     rateLimit     — exactly `limit` requests pass per window; per-IP buckets
                     are isolated; requests without the platform IP header
                     fail CLOSED into one shared bucket; a rejection is a
                     well-formed 429 with a sane Retry-After
     clientIp      — never trusts spoofable headers
     sharedTokenOk — off ⇒ always true; token mode gates the no-Origin path by
                     exact match; strict mode ignores Origin entirely

   Runs in ci.yml's `fuzz` job (needs node_modules — the blocked-egress `test`
   job never installs npm packages) and locally via `npm test`.
   Usage: node test/property-fuzz.test.js */
'use strict';

const fc = require('fast-check');
const { rateLimit, clientIp, _reset } = require('../netlify/functions/_ratelimit.js');
const { sharedTokenOk } = require('../netlify/functions/_auth.js');

let passed = 0, failed = 0;
const check = (name, fn) => {
  try { fn(); passed++; console.log('  ok  ' + name); }
  catch (e) { failed++; console.log('FAIL  ' + name + ' — ' + String(e && e.message).split('\n')[0].slice(0, 220)); }
};

const evFor = (ip) => ({ headers: { 'x-nf-client-connection-ip': ip } });
const RUNS = { numRuns: 200 };

check('rateLimit: exactly `limit` requests pass per window, then well-formed 429s', () => {
  fc.assert(fc.property(fc.integer({ min: 1, max: 50 }), fc.integer({ min: 0, max: 120 }), (limit, n) => {
    _reset();
    const results = [];
    for (let i = 0; i < n; i++) results.push(rateLimit(evFor('10.0.0.1'), { name: 'p', limit, windowMs: 60000 }));
    const allowed = results.filter(r => r === null).length;
    if (allowed !== Math.min(n, limit)) return false;
    return results.slice(Math.min(n, limit)).every(r => {
      if (!r || r.statusCode !== 429) return false;
      const body = JSON.parse(r.body);
      return body.ok === false && body.retry_after_seconds >= 1
        && Number(r.headers['Retry-After']) >= 1 && r.headers['RateLimit-Remaining'] === '0';
    });
  }), RUNS);
});

check('rateLimit: distinct IPs never consume each other\'s quota', () => {
  fc.assert(fc.property(
    fc.integer({ min: 1, max: 20 }),
    fc.array(fc.integer({ min: 0, max: 3 }), { minLength: 20, maxLength: 60 }),
    (limit, seq) => {
      _reset();
      const ips = ['1.1.1.1', '2.2.2.2', '3.3.3.3', '4.4.4.4'];
      const allowedPer = new Map(); const seen = new Map();
      for (const which of seq) {
        const ip = ips[which];
        seen.set(ip, (seen.get(ip) || 0) + 1);
        if (rateLimit(evFor(ip), { name: 'iso', limit, windowMs: 60000 }) === null) {
          allowedPer.set(ip, (allowedPer.get(ip) || 0) + 1);
        }
      }
      return [...seen.entries()].every(([ip, count]) => (allowedPer.get(ip) || 0) === Math.min(count, limit));
    }
  ), RUNS);
});

check('rateLimit/clientIp: spoofable headers fail CLOSED into one shared bucket', () => {
  fc.assert(fc.property(
    fc.integer({ min: 1, max: 10 }),
    fc.array(fc.record({
      'x-forwarded-for': fc.string({ maxLength: 40 }),
      'client-ip': fc.string({ maxLength: 20 }),
    }), { minLength: 1, maxLength: 40 }),
    (limit, headerses) => {
      _reset();
      let allowed = 0;
      for (const headers of headerses) {
        if (clientIp({ headers }) !== 'unknown-shared') return false;
        if (rateLimit({ headers }, { name: 's', limit, windowMs: 60000 }) === null) allowed++;
      }
      return allowed === Math.min(headerses.length, limit);
    }
  ), RUNS);
});

check('sharedTokenOk: feature off ⇒ true for arbitrary events', () => {
  delete process.env.APP_SHARED_TOKEN; delete process.env.APP_STRICT_TOKEN;
  fc.assert(fc.property(fc.dictionary(fc.string({ maxLength: 12 }), fc.string({ maxLength: 20 })), (headers) => {
    return sharedTokenOk({ headers }) === true;
  }), RUNS);
});

check('sharedTokenOk: token mode — no-Origin path requires an exact match; Origin path passes', () => {
  try {
    fc.assert(fc.property(
      fc.string({ minLength: 1, maxLength: 40 }), fc.string({ maxLength: 40 }),
      (token, provided) => {
        process.env.APP_SHARED_TOKEN = token; delete process.env.APP_STRICT_TOKEN;
        if (sharedTokenOk({ headers: { origin: 'https://any.example' } }) !== true) return false;
        if (sharedTokenOk({ headers: {} }) !== false) return false;                       // no origin, no token
        return sharedTokenOk({ headers: { 'x-app-token': provided } }) === (provided === token);
      }
    ), RUNS);
  } finally { delete process.env.APP_SHARED_TOKEN; }
});

check('sharedTokenOk: strict mode ignores Origin — exact token or nothing', () => {
  try {
    fc.assert(fc.property(
      fc.string({ minLength: 1, maxLength: 40 }), fc.string({ maxLength: 40 }),
      (token, provided) => {
        process.env.APP_SHARED_TOKEN = token; process.env.APP_STRICT_TOKEN = '1';
        if (sharedTokenOk({ headers: { origin: 'https://any.example' } }) !== false) return false;
        return sharedTokenOk({ headers: { origin: 'https://x.y', 'x-app-token': provided } }) === (provided === token);
      }
    ), RUNS);
  } finally { delete process.env.APP_SHARED_TOKEN; delete process.env.APP_STRICT_TOKEN; }
});

_reset();
console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
