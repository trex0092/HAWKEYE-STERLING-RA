/* Site currency — the check that must not be able to pass on a stale site.

   On 30 Jul 2026 the previous probe printed "CURRENT — production serves the
   version at HEAD of main" while production was serving a build 31 commits
   behind. It compared APP_VERSION, a hand-maintained string that had not
   moved since 16 Jul, so it passed by measuring a constant.

   These checks pin the two properties that failure taught us:
     1. the verdict is derived from CONTENT, so it cannot pass on stale bytes;
     2. "could not read the site" is a FAILURE, never a pass — an unverified
        site is not a current site, and that distinction is the whole point.

   Usage: node test/site-currency.test.mjs */
import { decide, discoverServedAssets, firstDivergence, sha256 } from '../scripts/site-currency.mjs';

let passed = 0, failed = 0;
const check = (name, cond) => { if (cond) { passed++; console.log('  ok  ' + name); } else { failed++; console.log('FAIL  ' + name); } };

const NOW = 1_700_000_000;
const at = (secondsAgo) => NOW - secondsAgo;
const opts = { graceSeconds: 86400, now: NOW };

/* ---- the verdict comes from content ---- */
{
  const allMatch = [
    { name: 'app.js', status: 'match', changedAt: at(10) },
    { name: 'index.html', status: 'match', changedAt: at(999999) },
  ];
  const d = decide(allMatch, opts);
  check('every asset matching -> current', d.verdict === 'current' && d.ok === true);
  check('current reports no stale assets', d.stale.length === 0);
}

/* The exact 30 Jul situation: a long-unchanged version string, but the served
   bytes are old. The old probe passed here; this one must not. */
{
  const d = decide([
    { name: 'app.js', status: 'match', changedAt: at(1_200_000) },      // APP_VERSION untouched
    { name: 'advisor.js', status: 'differ', changedAt: at(1_000_000) }, // real code, never published
  ], opts);
  check('stale bytes behind an unchanged version string -> drift', d.verdict === 'drift');
  check('drift is not ok', d.ok === false);
  check('drift names the stale asset', d.stale.some((r) => r.name === 'advisor.js'));
}

/* ---- deploy lag vs genuine drift ---- */
{
  const d = decide([{ name: 'console.js', status: 'differ', changedAt: at(60) }], opts);
  check('a divergence inside the grace window -> lag', d.verdict === 'lag' && d.ok === true);
}
{
  const d = decide([{ name: 'console.js', status: 'differ', changedAt: at(86401) }], opts);
  check('a divergence one second past grace -> drift', d.verdict === 'drift' && d.ok === false);
}
/* The case that makes "lag" honest: one fresh merge must not launder an old
   one. If ANY divergence is old, production is behind, full stop. */
{
  const d = decide([
    { name: 'console.js', status: 'differ', changedAt: at(60) },        // just merged
    { name: 'advisor.js', status: 'differ', changedAt: at(1_000_000) }, // stale for weeks
  ], opts);
  check('one recent divergence does not launder an old one', d.verdict === 'drift');
}
/* An unknown commit date must not be read as "recent". */
{
  const d = decide([{ name: 'app.js', status: 'differ', changedAt: NaN }], opts);
  check('an undatable divergence is drift, not lag', d.verdict === 'drift');
}

/* ---- an asset main ships but production does not serve ---- */
{
  const d = decide([{ name: 'i18n.js', status: 'missing', changedAt: at(1_000_000) }], opts);
  check('an absent asset counts as drift', d.verdict === 'drift' && d.ok === false);
}

/* ---- unreadable is a failure, not a pass ---- */
{
  const d = decide([
    { name: 'app.js', status: 'match', changedAt: at(10) },
    { name: 'sw.js', status: 'error', detail: 'timed out', changedAt: at(10) },
  ], opts);
  check('an unreadable asset -> unverifiable', d.verdict === 'unverifiable');
  check('unverifiable is NOT ok (an unread site is not a current site)', d.ok === false);
  check('unverifiable names what could not be read', d.unreadable.some((r) => r.name === 'sw.js'));
}
/* A total outage must not resolve to "current" via an empty stale list. */
{
  const d = decide([
    { name: 'app.js', status: 'error', detail: 'HTTP 503', changedAt: at(10) },
    { name: 'index.html', status: 'error', detail: 'HTTP 503', changedAt: at(10) },
  ], opts);
  check('a site-wide outage is unverifiable, not current', d.verdict === 'unverifiable' && d.ok === false);
}

/* ---- the asset list is discovered, not hardcoded ---- */
{
  const assets = discoverServedAssets();
  check('discovery finds the app entry points', ['index.html', 'console.html', 'advisor.html'].every((f) => assets.includes(f)));
  check('discovery finds the page logic', ['app.js', 'console.js', 'advisor.js', 'i18n.js', 'sw.js'].every((f) => assets.includes(f)));
  check('discovery finds the stylesheets', ['app.css', 'console.css', 'advisor.css'].every((f) => assets.includes(f)));
  /* The #338 lesson: a hardcoded list acquires a blind spot exactly where a new
     file hides. Every served root asset must come from disk. */
  check('discovery covers every root html/js/css file', assets.length >= 13);
  check('discovery excludes non-served roots', !assets.includes('package.json') && !assets.includes('README.md'));
}

/* ---- hashing is over raw bytes ---- */
{
  check('sha256 is stable', sha256(Buffer.from('hawkeye')) === sha256(Buffer.from('hawkeye')));
  check('sha256 separates a one-byte change', sha256(Buffer.from('hawkeye')) !== sha256(Buffer.from('hawkeyf')));
}

/* ---- a divergence names itself ----
   2026-08-04: the three HTML shells diverged for hours behind hash-only rows;
   the injector's own markup would have identified it in one line. The excerpt
   must show the divergent bytes, stay bounded, and stay printable. */
{
  check('identical buffers -> no excerpt', firstDivergence(Buffer.from('same'), Buffer.from('same')) === null);
}
{
  const repo = Buffer.from('<head>\n<meta charset="utf-8">\n</head>');
  const live = Buffer.from('<head>\n<meta charset="utf-8">\n<script data-injected-by="edge"></script>\n</head>');
  const e = firstDivergence(repo, live);
  check('the live snippet shows the injected markup', e !== null && e.live.includes('data-injected-by="edge"'));
  /* Both sides share the '<' that opens the next tag; the split is one past it. */
  check('the divergence offset is where the buffers split', e.at === repo.indexOf('</head>') + 1);
  check('byte totals expose an injection as growth', e.repoBytes === repo.length && e.liveBytes === live.length && e.liveBytes > e.repoBytes);
  check('newlines are literalised so the snippet stays one line', !e.repo.includes('\n') && !e.live.includes('\n'));
}
{
  /* A pure append (same prefix) still excerpts: at == shorter length. */
  const repo = Buffer.from('<body></body>');
  const live = Buffer.from('<body></body><!-- edge stamp -->');
  const e = firstDivergence(repo, live);
  check('an appended mutation is excerpted at the old end', e.at === repo.length && e.live.includes('edge stamp'));
}
{
  /* Multi-megabyte bodies must not flood the log. */
  const big = 'x'.repeat(2_000_000);
  const e = firstDivergence(Buffer.from(big + 'AAA'), Buffer.from(big + 'BBB'), { cap: 160 });
  check('excerpts stay capped on huge bodies', e.repo.length <= 160 && e.live.length <= 160);
}
{
  /* Binary garbage becomes printable dots, never raw control bytes. */
  const e = firstDivergence(Buffer.from('ok'), Buffer.from([0x6f, 0x6b, 0x00, 0x07, 0x1b]));
  check('non-printables are made printable', e !== null && !/[\x00-\x1f]/.test(e.live));
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
