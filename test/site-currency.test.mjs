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
import { assessDeploymentIntegrity, decide, discoverServedAssets, firstDivergence, isDeployRelevantPath, sha256 } from '../scripts/site-currency.mjs';

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

/* ---- complete deployment evidence must not be inferred from a marker ---- */
{
  const CURRENT = 'a'.repeat(40);
  const OLDER = 'b'.repeat(40);
  const match = decide([{name:'index.html',status:'match',changedAt:at(900000)}],opts);
  const absent = decide([{name:'telemetry.js',status:'missing',changedAt:at(900000)}],opts);
  const unavailable = decide([{name:'sw.js',status:'error',changedAt:at(900000)}],opts);
  const recentlyModified = decide([{name:'app.js',status:'differ',changedAt:at(10)}],opts);

  check('matching deploy SHA AND matching files are provably current',
    assessDeploymentIntegrity({expectedCommit:CURRENT,markerCommit:CURRENT,
      assetDecision:match}).verdict==='current');
  check('matching deploy SHA does NOT excuse missing telemetry.js',
    !assessDeploymentIntegrity({expectedCommit:CURRENT,markerCommit:CURRENT,
      assetDecision:absent}).ok);
  check('matching deploy SHA does NOT excuse unreadable root JavaScript',
    assessDeploymentIntegrity({expectedCommit:CURRENT,markerCommit:CURRENT,
      assetDecision:unavailable}).verdict==='integrity_failure');
  check('matching deploy SHA does NOT excuse mutated files as grace-window lag',
    assessDeploymentIntegrity({expectedCommit:CURRENT,markerCommit:CURRENT,
      assetDecision:recentlyModified,graceSeconds:86400}).verdict==='integrity_failure');

  check('stale deploy SHA and stale Netlify function fails despite matching root HTML',
    assessDeploymentIntegrity({expectedCommit:CURRENT,markerCommit:OLDER,
      changedPaths:['netlify/functions/brain-soul.js'],changedAtSeconds:[at(900000)],
      assetDecision:match,graceSeconds:86400,now:NOW}).verdict==='drift');
  check('stale deploy SHA and RECENT changed function is classified only as lag',
    assessDeploymentIntegrity({expectedCommit:CURRENT,markerCommit:OLDER,
      changedPaths:['netlify/functions/brain-soul.js'],changedAtSeconds:[at(60)],
      assetDecision:match,graceSeconds:86400,now:NOW}).verdict==='lag');
  check('zero lag budget cannot falsely call stale Function deployment current',
    assessDeploymentIntegrity({expectedCommit:CURRENT,markerCommit:OLDER,
      changedPaths:['netlify/functions/brain-soul.js'],changedAtSeconds:[at(1)],
      assetDecision:match,graceSeconds:0,now:NOW}).ok===false);
  check('a single old function amongst recent files defeats deploy lag',
    assessDeploymentIntegrity({expectedCommit:CURRENT,markerCommit:OLDER,
      changedPaths:['app.js','netlify/functions/brain-soul.js'],
      changedAtSeconds:[at(60),at(900000)],
      assetDecision:match,graceSeconds:86400,now:NOW}).verdict==='drift');
  check('unable to date a changed Function is NOT treated as harmless lag',
    assessDeploymentIntegrity({expectedCommit:CURRENT,markerCommit:OLDER,
      changedPaths:['netlify/functions/brain-soul.js'],changedAtSeconds:[NaN],
      assetDecision:match,graceSeconds:86400,now:NOW}).verdict==='drift');
  check('unavailable GitHub compare API is UNVERIFIABLE, not CURRENT',
    assessDeploymentIntegrity({expectedCommit:CURRENT,markerCommit:OLDER,
      changedPaths:null,assetDecision:match}).verdict==='unverifiable');
  check('docs-only commits require matching root assets before passing',
    assessDeploymentIntegrity({expectedCommit:CURRENT,markerCommit:OLDER,
      changedPaths:[],assetDecision:match}).verdict==='current' &&
    assessDeploymentIntegrity({expectedCommit:CURRENT,markerCommit:OLDER,
      changedPaths:[],assetDecision:absent}).verdict==='integrity_failure' &&
    assessDeploymentIntegrity({expectedCommit:CURRENT,markerCommit:OLDER,
      changedPaths:[],assetDecision:recentlyModified}).verdict==='integrity_failure');
  check('a missing deploy marker cannot verify even byte-identical static HTML',
    assessDeploymentIntegrity({expectedCommit:CURRENT,markerCommit:null,
      assetDecision:match}).verdict==='unverifiable');
  check('an invalid deploy marker cannot verify Netlify Function freshness',
    assessDeploymentIntegrity({expectedCommit:CURRENT,markerCommit:'not-sha',
      assetDecision:match}).ok===false);
  check('local asset-only probes remain usable when no expected commit is given',
    assessDeploymentIntegrity({expectedCommit:'',markerCommit:null,
      assetDecision:match}).verdict==='current');
  check('no more than 100 path histories may be excused by the grace window',
    assessDeploymentIntegrity({expectedCommit:CURRENT,markerCommit:OLDER,
      changedPaths:Array(101).fill('netlify/functions/example.js'),
      changedAtSeconds:Array(101).fill(at(1)),
      assetDecision:match,graceSeconds:86400,now:NOW}).verdict==='drift');
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
  check('legal and missing-page assets are covered by exact-byte verification',
    ['privacy-policy.html', 'terms.html', '404.html'].every(name => assets.includes(name)));
  check('live site probe includes the browser-fetched country suggestions and robots.txt',
    assets.includes('data/country-score-suggested.json') && assets.includes('robots.txt'));
  check('discovery excludes non-served roots and ephemeral state',
    !assets.includes('package.json') && !assets.includes('README.md') &&
    !assets.includes('data/run-metrics.json') && !assets.includes('data/grc-metrics.json'));
}

/* ---- hashing is over raw bytes ---- */
{
  check('sha256 is stable', sha256(Buffer.from('hawkeye')) === sha256(Buffer.from('hawkeye')));
  check('sha256 separates a one-byte change', sha256(Buffer.from('hawkeye')) !== sha256(Buffer.from('hawkeyf')));
}

/* ---- deploy relevance classifier ---- */
{
  check('served root HTML is deploy-relevant', isDeployRelevantPath('index.html'));
  check('served root JS is deploy-relevant', isDeployRelevantPath('app.js'));
  check('Netlify config is deploy-relevant', isDeployRelevantPath('netlify.toml'));
  check('Netlify functions are deploy-relevant', isDeployRelevantPath('netlify/functions/brain-soul.js'));
  check('assets are deploy-relevant', isDeployRelevantPath('assets/logo.svg'));
  check('browser-read country suggestions are deploy-relevant, but proposals do not become approvals',
    isDeployRelevantPath('data/country-score-suggested.json'));
  check('published robots.txt is deploy-relevant', isDeployRelevantPath('robots.txt'));
  check('legal and 404 root pages remain deploy-relevant',
    ['privacy-policy.html','terms.html','404.html'].every(isDeployRelevantPath));
  check('unrelated transient JSON state is NOT deploy-relevant',
    !isDeployRelevantPath('data/temporary-transaction-state.json'));
  check('workflow-only changes are not deploy-relevant', !isDeployRelevantPath('.github/workflows/ci.yml'));
  check('docs-only changes are not deploy-relevant', !isDeployRelevantPath('README.md'));
  check('screening data-only changes are not deploy-relevant', !isDeployRelevantPath('data/sanctions-country-coverage.json'));
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
