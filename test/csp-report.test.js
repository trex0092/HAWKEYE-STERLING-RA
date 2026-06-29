/* Tests the CSP violation collector (netlify/functions/csp-report.js):
   non-POST is rejected, valid reports (report-uri and report-to shapes) return
   204, oversized bodies are capped, and per-IP rate limiting kicks in.
   No network. Usage: node test/csp-report.test.js */
const path = require('path');
const fn = require(path.join(__dirname, '..', 'netlify', 'functions', 'csp-report.js'));
const rl = require(path.join(__dirname, '..', 'netlify', 'functions', '_ratelimit.js'));

let passed = 0, failed = 0;
const check = (n, c) => { if (c) { passed++; console.log('  ok  ' + n); } else { failed++; console.log('FAIL  ' + n); } };

/* Silence the function's console.warn logging during the test run. */
const origWarn = console.warn; console.warn = () => {};

const ev = (method, body, ip) => ({
  httpMethod: method,
  headers: { 'x-nf-client-connection-ip': ip || '203.0.113.1' },
  body: body == null ? '' : (typeof body === 'string' ? body : JSON.stringify(body)),
});

(async () => {
  rl._reset();
  let r = await fn.handler(ev('GET'));
  check('GET is rejected 405', r.statusCode === 405);

  r = await fn.handler(ev('OPTIONS'));
  check('OPTIONS preflight returns 204', r.statusCode === 204);

  rl._reset();
  r = await fn.handler(ev('POST', { 'csp-report': { 'violated-directive': 'style-src', 'blocked-uri': 'inline', 'document-uri': 'https://x/' } }, '203.0.113.2'));
  check('report-uri shape accepted → 204', r.statusCode === 204);

  rl._reset();
  r = await fn.handler(ev('POST', [{ type: 'csp-violation', body: { effectiveDirective: 'script-src', blockedURL: 'inline', documentURL: 'https://x/' } }], '203.0.113.3'));
  check('report-to (array) shape accepted → 204', r.statusCode === 204);

  rl._reset();
  r = await fn.handler(ev('POST', 'not json at all', '203.0.113.4'));
  check('unparseable body still 204 (no retry storm)', r.statusCode === 204);

  rl._reset();
  r = await fn.handler(ev('POST', 'x'.repeat(20 * 1024), '203.0.113.5'));
  check('oversized body rejected 413', r.statusCode === 413);

  /* Rate limit: same IP, default 60/min → the 61st is throttled. */
  rl._reset();
  const ip = '203.0.113.99';
  let last;
  for (let i = 0; i < 61; i++) last = await fn.handler(ev('POST', { 'csp-report': {} }, ip));
  check('per-IP rate limit returns 429 after the window fills', last.statusCode === 429);

  console.warn = origWarn;
  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
})();
