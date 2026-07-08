/* Offline unit tests for the pure parts of scripts/asana-notify.mjs — the
   shared transient-failure policy (retry classification + backoff) and the
   re-run duplicate guard used by every monitoring delivery stream. */
import {
  isRetryable, retryDelayMs, findRecentDuplicate, esc, buildHtmlBody
} from '../scripts/asana-notify.mjs';

let passed = 0, failed = 0;
function check(name, cond) {
  if (cond) { passed++; console.log('  ok  ' + name); }
  else { failed++; console.error('  FAIL ' + name); }
}

/* ── retry classification ── */
check('429 (rate limit) is retryable', isRetryable(429));
check('500/502/503/504 are retryable', [500, 502, 503, 504].every(isRetryable));
check('other 4xx fail fast (400/401/403/404/413)', [400, 401, 403, 404, 413].every(s => !isRetryable(s)));
check('string status codes are tolerated', isRetryable('429') && !isRetryable('404'));

/* ── backoff ── */
check('backoff grows exponentially (1s, 2s, 4s)',
  retryDelayMs(0) === 1000 && retryDelayMs(1) === 2000 && retryDelayMs(2) === 4000);
check('backoff is capped at 8s', retryDelayMs(10) === 8000);
check('Retry-After header wins when present', retryDelayMs(0, '5') === 5000);
check('Retry-After is capped at 30s', retryDelayMs(0, '900') === 30000);
check('garbage Retry-After falls back to backoff', retryDelayMs(1, 'soon') === 2000);

/* ── re-run duplicate guard ── */
const NOW = Date.parse('2026-07-02T08:00:00Z');
const hoursAgo = h => new Date(NOW - h * 3600000).toISOString();
const tasks = [
  { name: 'Sanctions Watch: 2 source(s) changed', created_at: hoursAgo(3), permalink_url: 'https://t/1' },
  { name: 'FATF list change: Kenya', created_at: hoursAgo(80), permalink_url: 'https://t/2' },
  { name: 'Regulatory Watch — 3 source changes', created_at: hoursAgo(24), permalink_url: 'https://t/4' },
  { name: 'Some other card', created_at: hoursAgo(1) }
];
check('identical name inside 6h is a duplicate (task returned with its link)', (() => {
  const d = findRecentDuplicate(tasks, 'Sanctions Watch: 2 source(s) changed', NOW);
  return d && d.permalink_url === 'https://t/1';
})());
check('identical name OLDER than the window is not a duplicate (recurring alerts still file)',
  findRecentDuplicate(tasks, 'FATF list change: Kenya', NOW) === null);
check('REGRESSION: identical title 24h apart is NOT a duplicate — daily watchers may legitimately repeat a title ("3 source changes") on consecutive days',
  findRecentDuplicate(tasks, 'Regulatory Watch — 3 source changes', NOW) === null);
check('different name is never a duplicate',
  findRecentDuplicate(tasks, 'FATF list change: Monaco', NOW) === null);
check('name is compared after the same 250-char clip Asana receives', (() => {
  const long = 'X'.repeat(300);
  const clipped = [{ name: 'X'.repeat(250), created_at: hoursAgo(1), permalink_url: 'https://t/3' }];
  const d = findRecentDuplicate(clipped, long, NOW);
  return d && d.permalink_url === 'https://t/3';
})());
check('missing/garbage created_at is treated as not recent',
  findRecentDuplicate([{ name: 'A' }, { name: 'A', created_at: 'yesterday-ish' }], 'A', NOW) === null);
check('empty/absent task list is safe',
  findRecentDuplicate([], 'A', NOW) === null && findRecentDuplicate(null, 'A', NOW) === null);

/* ── existing helpers still hold ── */
check('esc escapes all five XML-sensitive characters',
  esc('<a href="x">&\'</a>') === '&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;');
check('buildHtmlBody renders the severity triage badge before the change text', (() => {
  const h = buildHtmlBody({ heading: 'x', summary: 's', changes: [{ name: 'FATF', url: 'https://u', status: 'changed', severity: 'HIGH', severityReason: 'new threshold', diff: { addedCount: 1, removedCount: 0, added: ['a new threshold applies to dealers now.'], removed: [] } }] });
  return h.includes('🔴 HIGH (new threshold) — content changed — 1 added / 0 removed') && h.includes('➕ added:');
})());
check('buildHtmlBody produces a single <body> root with escaped content', (() => {
  const h = buildHtmlBody({ heading: 'A & B', summary: 's', changes: [{ name: '<X>', url: 'https://u', status: 'new' }], runLink: 'https://r' });
  return h.startsWith('<body>') && h.endsWith('</body>') && h.includes('&lt;X&gt;') && h.includes('A &amp; B');
})());

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
