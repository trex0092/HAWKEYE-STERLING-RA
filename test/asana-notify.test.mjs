/* Offline unit tests for the pure parts of scripts/asana-notify.mjs — the
   shared transient-failure policy (retry classification + backoff) and the
   re-run duplicate guard used by every monitoring delivery stream. */
import {
  isRetryable, retryDelayMs, findRecentDuplicate, esc, buildHtmlBody, notifyAsana,
  fitAsanaHtml, ASANA_HTML_MAX_BYTES, fitAsanaText, fitAsanaName, ASANA_NAME_MAX_BYTES,
  listProjectTasks, ASANA_PAGE_CAP
} from '../scripts/asana-notify.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

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
/* The comparator must apply the EXACT transform the writer applies, or an
   over-long title never matches its own re-run. Pinning both to fitAsanaName
   keeps them in step; a bare 250-CHARACTER clip on either side would drift the
   moment a designated name is non-Latin (Asana counts bytes). */
check('name is compared after the same clip Asana actually receives', (() => {
  const long = 'X'.repeat(300);
  const filed = [{ name: fitAsanaName(long), created_at: hoursAgo(1), permalink_url: 'https://t/3' }];
  const d = findRecentDuplicate(filed, long, NOW);
  return d && d.permalink_url === 'https://t/3';
})());
check('a re-run of a non-Latin title dedups against the byte-capped card on file', (() => {
  const long = 'إشعار عقوبات — ' + 'محمد بن عبد الله '.repeat(40);
  const filed = [{ name: fitAsanaName(long), created_at: hoursAgo(1), permalink_url: 'https://t/4' }];
  return Buffer.byteLength(fitAsanaName(long), 'utf8') <= ASANA_NAME_MAX_BYTES
    && (findRecentDuplicate(filed, long, NOW) || {}).permalink_url === 'https://t/4';
})());
check('missing/garbage created_at is treated as not recent',
  findRecentDuplicate([{ name: 'A' }, { name: 'A', created_at: 'yesterday-ish' }], 'A', NOW) === null);
check('empty/absent task list is safe',
  findRecentDuplicate([], 'A', NOW) === null && findRecentDuplicate(null, 'A', NOW) === null);

/* ── dedupPrefix — count-bearing titles ── */
const digestTasks = [
  { name: '🛡️ Sanctions Screen — 2026-07-02 — 2 new match(es) · 325 screened', created_at: hoursAgo(2), permalink_url: 'https://t/9' }
];
check('dedupPrefix: a re-run with DIFFERENT counts still dedups on the stable date prefix', (() => {
  const d = findRecentDuplicate(digestTasks, '🛡️ Sanctions Screen — 2026-07-02 — 3 new match(es) · 326 screened',
    NOW, 6, '🛡️ Sanctions Screen — 2026-07-02');
  return d && d.permalink_url === 'https://t/9';
})());
check('dedupPrefix: a different DAY\'s prefix never matches (daily digests still file daily)',
  findRecentDuplicate(digestTasks, '🛡️ Sanctions Screen — 2026-07-03 — no new matches · 325 screened',
    NOW, 6, '🛡️ Sanctions Screen — 2026-07-03') === null);
check('dedupPrefix: outside the window the same-prefix card is not a duplicate',
  findRecentDuplicate([{ name: '🛡️ Sanctions Screen — 2026-07-02 — x', created_at: hoursAgo(8) }],
    '🛡️ Sanctions Screen — 2026-07-02 — y', NOW, 6, '🛡️ Sanctions Screen — 2026-07-02') === null);
check('without dedupPrefix exact-match semantics are unchanged',
  findRecentDuplicate(digestTasks, '🛡️ Sanctions Screen — 2026-07-02 — 3 new match(es) · 326 screened', NOW) === null);

/* ── existing helpers still hold ── */
check('esc escapes all five XML-sensitive characters',
  esc('<a href="x">&\'</a>') === '&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;');
check('esc strips XML-invalid control characters escaping cannot save (Asana xml_parsing_error, observed live 2026-08-05)',
  esc('A' + String.fromCharCode(0) + 'B' + String.fromCharCode(26) + 'C' + String.fromCharCode(11) + 'D') === 'ABCD'
  && esc('tab\tand\nnewline stay') === 'tab\tand\nnewline stay');
check('esc drops unpaired surrogates but keeps real astral pairs',
  esc('X' + String.fromCharCode(0xD800) + 'Y') === 'XY'
  && esc('X' + String.fromCharCode(0xDC00) + 'Y') === 'XY'
  && esc('ok \u{1F6E1} shield') === 'ok \u{1F6E1} shield');
check('buildHtmlBody renders the severity triage badge before the change text', (() => {
  const h = buildHtmlBody({ heading: 'x', summary: 's', changes: [{ name: 'FATF', url: 'https://u', status: 'changed', severity: 'HIGH', severityReason: 'new threshold', diff: { addedCount: 1, removedCount: 0, added: ['a new threshold applies to dealers now.'], removed: [] } }] });
  return h.includes('🔴 HIGH (new threshold) — content changed — 1 added / 0 removed') && h.includes('➕ added:');
})());
check('buildHtmlBody produces a single <body> root with escaped content', (() => {
  const h = buildHtmlBody({ heading: 'A & B', summary: 's', changes: [{ name: '<X>', url: 'https://u', status: 'new' }], runLink: 'https://r' });
  return h.startsWith('<body>') && h.endsWith('</body>') && h.includes('&lt;X&gt;') && h.includes('A &amp; B');
})());

/* ── MIRROR: one card, two project memberships ──
   #305 routed every pipeline Asana card to the HAWKEYE STERLING APP project.
   The law-change queue is worked from a DIFFERENT project, so from 22 Jul 2026
   the Regulatory Watch card was filed correctly and still read as "nothing
   arrived" to its reader. Mirroring is additive: the #305 destination keeps
   receiving the card, and it also appears where it is worked. One task, so
   there is no duplicate to reconcile and no dedup interaction. */
async function capturePayload(opts) {
  const orig = globalThis.fetch;
  const prevTok = process.env.ASANA_ACCESS_TOKEN;
  process.env.ASANA_ACCESS_TOKEN = 'test-token';
  let captured = null;
  globalThis.fetch = async (url, init) => {
    if (String(url).includes('/tasks') && init && init.method === 'POST') {
      captured = JSON.parse(init.body).data;
      return { ok: true, status: 201, json: async () => ({ data: { gid: 'T1', permalink_url: 'https://p' } }), text: async () => '' };
    }
    return { ok: true, status: 200, json: async () => ({ data: [] }), text: async () => '' };
  };
  try { await notifyAsana('Regulatory Watch — 3 source changes', 'body', opts); }
  finally {
    globalThis.fetch = orig;
    if (prevTok === undefined) delete process.env.ASANA_ACCESS_TOKEN;
    else process.env.ASANA_ACCESS_TOKEN = prevTok;
  }
  return captured;
}

const APP = '1216203370612914', APP_SEC = '1216203370612916';
const MON = '1213914392047129', MON_SEC = '1216203873114460';

const mirrored = await capturePayload({ project: APP, section: APP_SEC, mirror: [{ project: MON, section: MON_SEC }] });
check('a mirrored card still reaches the primary (#305) project',
  mirrored.projects.includes(APP));
check('a mirrored card ALSO reaches the queue it is worked from',
  mirrored.projects.includes(MON));
const mships = mirrored.memberships || [];
check('the mirror is filed under its own section, not the project default',
  mships.some(m => m.project === MON && m.section === MON_SEC));
check('the primary keeps its own section membership',
  mships.some(m => m.project === APP && m.section === APP_SEC));
check('mirroring creates ONE task, not two (no duplicate to reconcile)',
  Array.isArray(mirrored.projects) && mirrored.projects.length === 2);

/* Absent a mirror the payload must be byte-identical to the old behaviour —
   every other delivery stream shares this function. */
const plain = await capturePayload({ project: APP, section: APP_SEC });
check('no mirror configured leaves the payload exactly as before',
  plain.projects.length === 1 && plain.projects[0] === APP && plain.memberships === undefined);

/* A mirror pointing at the primary must not produce a self-membership. */
const self = await capturePayload({ project: APP, mirror: [{ project: APP, section: APP_SEC }] });
check('a mirror equal to the primary is deduped away',
  self.projects.length === 1 && self.memberships === undefined);

/* A mirror without a section still joins the project (default section). */
const noSec = await capturePayload({ project: APP, mirror: [{ project: MON }] });
check('a sectionless mirror still joins the project',
  noSec.projects.includes(MON) && (noSec.memberships || []).some(m => m.project === MON && !('section' in m)));


/* Every ALERT stream that lands in the app project must also reach the queue
   the MLRO works from. Asserted by inspecting the workflows, because the bug
   was never in the code — notifyAsana did the right thing with what it was
   given; the workflows simply never gave it a mirror, and the step names/
   comments claimed otherwise. */
{
  const ROOT2 = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const MON = '1213914392047129';
  const mirrorRe = new RegExp(`ASANA_MIRROR_PROJECT_GID:\\s*\\$\\{\\{[^}]*${MON}`);
  for (const wf of ['regulatory-watch.yml', 'sanctions-watch.yml', 'sanctions-screen.yml']) {
    const y = readFileSync(join(ROOT2, '.github/workflows', wf), 'utf8');
    /* Match the ASSIGNMENT, not the bare identifier: the explanatory comment
       above it says "Clear ASANA_MIRROR_PROJECT_GID to disable", so an
       includes() on the name alone passes even with the env line deleted —
       caught by a negative control that failed to fail. */
    check(`${wf} mirrors its alert into the MLRO queue`, mirrorRe.test(y));
    check(`${wf} still delivers to the #305 destination as well (additive)`,
      y.includes('1216203370612914'));
  }
  /* STEP-SCOPED: the env must be assigned on the step that CONSUMES it. The
     regression this closes: sanctions-screen.yml assigned the mirror env only
     on the screen step while the digest poster (screening-cases.mjs) ran in a
     different step with no mirror env — the whole-file regex above stayed
     green while the daily digest never reached the MLRO queue. */
  const stepBlock = (yaml, runLine) =>
    yaml.split(/\n\s+- name: /).find(s => s.includes(runLine)) || '';
  const yScreen = readFileSync(join(ROOT2, '.github/workflows', 'sanctions-screen.yml'), 'utf8');
  check('sanctions-screen.yml assigns the mirror env on the DIGEST step (screening-cases.mjs — its consumer)',
    mirrorRe.test(stepBlock(yScreen, 'scripts/screening-cases.mjs')));
  check('sanctions-screen.yml assigns the mirror env on the alert step too (sanctions-screen.mjs consumes it when alerts are not suppressed)',
    mirrorRe.test(stepBlock(yScreen, 'scripts/sanctions-screen.mjs')));
}

/* Asana rejects an html_notes body over 65,400 BYTES. The old cap sliced at
   60,000 CHARACTERS — identical only for ASCII, and the daily screening digest
   stopped being ASCII the day the worldwide PEP list began contributing Arabic,
   Cyrillic and Han names. 60,000 of those characters weighed 65,424 bytes, so
   Asana 400'd the entire card and the MLRO got NO digest on a run that found 88
   new matches. Truncation also has to keep the XML well-formed: html_notes is
   parsed strictly, and an orphaned <ul> 400s exactly as hard as being too big. */
{
  const bytes = (x) => Buffer.byteLength(x, 'utf8');
  const multilingual = 'الرئيس فلاديمير بوتين · Президент · 中華人民共和國主席';
  let big = '<body><h1>Daily sanctions screening</h1><ul>';
  for (let i = 0; i < 3000; i++) big += '<li><strong>Subject ' + i + '</strong> — ' + multilingual + '</li>';
  big += '</ul><em>footer</em></body>';
  check('asana html: a multilingual body is far over the BYTE cap while under any character cap',
    big.length < 300000 && bytes(big) > ASANA_HTML_MAX_BYTES && bytes(big) > big.length);
  const fitted = fitAsanaHtml(big);
  check('asana html: the fitted body is within Asana\'s byte limit',
    bytes(fitted) <= ASANA_HTML_MAX_BYTES);
  check('asana html: truncation is DISCLOSED, never a silent drop of findings',
    /TRUNCATED/.test(fitted));
  check('asana html: no character is split across the byte cut',
    !fitted.includes('�'));
  const wellFormed = (html) => {
    const stack = [];
    for (const m of html.matchAll(/<(\/?)([a-zA-Z][a-zA-Z0-9]*)[^>]*?(\/?)>/g)) {
      const [, slash, name, selfClose] = m;
      if (selfClose) continue;
      if (slash) { if (stack.pop() !== name.toLowerCase()) return false; }
      else stack.push(name.toLowerCase());
    }
    return stack.length === 0;
  };
  check('asana html: every tag left open by the cut is closed — html_notes is strict XML',
    wellFormed(fitted) && fitted.endsWith('</body>'));
  const small = '<body><h1>Clean day</h1><em>no matches</em></body>';
  check('asana html: a body under the cap is returned untouched',
    fitAsanaHtml(small) === small && wellFormed(small));
  check('asana html: the notify path caps by bytes, not characters',
    /fitAsanaHtml\(opts\.html\)/.test(
      readFileSync(join(resolve(dirname(fileURLToPath(import.meta.url)), '..'),
        'scripts/asana-notify.mjs'), 'utf8')));

  /* A body that is one huge text node (the reconciliation card wraps its whole
     report in a single <code>) must not come back empty: backing up to the tag
     boundary there would discard every line of the drift report. */
  let oneNode = '<body><h2>Drift</h2><code>';
  for (let i = 0; i < 4000; i++) oneNode += 'row ' + i + ' — ' + multilingual + '\n';
  oneNode += '</code></body>';
  const fittedNode = fitAsanaHtml(oneNode);
  check('asana html: a cut inside a giant text node keeps the text, not just the tag',
    bytes(fittedNode) <= ASANA_HTML_MAX_BYTES && wellFormed(fittedNode)
      && fittedNode.includes('row 100 ') && bytes(fittedNode) > ASANA_HTML_MAX_BYTES * 0.9);
  /* …and never mid-entity: "&amp" without its ';' fails XML as hard as a
     broken tag. Sized so the cut lands inside the escaped ampersand run. */
  const ents = '<body><code>' + '&amp;'.repeat(40000) + '</code></body>';
  const fittedEnt = fitAsanaHtml(ents);
  check('asana html: the cut never splits a character entity',
    bytes(fittedEnt) <= ASANA_HTML_MAX_BYTES
      && !/&[a-z]*$/i.test(fittedEnt.replace(/<\/?[a-zA-Z][^>]*>|⚠[^<]*/g, ''))
      && (fittedEnt.match(/&/g) || []).length === (fittedEnt.match(/&amp;/g) || []).length);
}

/* Same byte-vs-character bug, same blast radius, in the PLAIN-TEXT fields.
   `notes` and `name` are measured in bytes by Asana too, and every card the
   engine files now carries designated names verbatim — Arabic, Cyrillic, Han.
   Three call sites used to slice characters: notifyAsana's title, the daily
   Adverse Media & PEP audit card, and the screening-case title. */
{
  const bytes = (x) => Buffer.byteLength(x, 'utf8');
  const arabic = 'الرئيس فلاديمير بوتين محمد بن راشد آل مكتوم ';
  const bigText = arabic.repeat(1000);
  check('asana text: the fixture is over the BYTE cap while under any character cap',
    bigText.length < ASANA_HTML_MAX_BYTES && bytes(bigText) > ASANA_HTML_MAX_BYTES);
  const fittedText = fitAsanaText(bigText);
  check('asana text: the fitted notes are within Asana\'s byte limit',
    bytes(fittedText) <= ASANA_HTML_MAX_BYTES);
  check('asana text: truncation is DISCLOSED, never a silent drop',
    /TRUNCATED/.test(fittedText));
  check('asana text: no character is split across the byte cut',
    !fittedText.includes('�'));
  check('asana text: content under the cap is returned untouched',
    fitAsanaText('Adverse Media & PEP — CLEAR') === 'Adverse Media & PEP — CLEAR');
  check('asana text: null/undefined degrade to empty, never "null"',
    fitAsanaText(null) === '' && fitAsanaText(undefined) === '');

  const longName = fitAsanaName('⚠ Sanctions HIT — ' + arabic.repeat(20));
  check('asana name: a non-Latin title is capped by BYTES at the name limit',
    bytes(longName) <= ASANA_NAME_MAX_BYTES && !longName.includes('�'));
  check('asana name: a truncated title still says it was cut',
    /\[cut\]$/.test(longName));
  check('asana name: a short title is untouched',
    fitAsanaName('Adverse Media & PEP — CLEAR — 10 Aug 2026') === 'Adverse Media & PEP — CLEAR — 10 Aug 2026');
  /* A notice longer than the cap would make the output BIGGER than the cut it
     replaced — the fit must degrade to a bare cut rather than blow the limit. */
  check('asana text: an absurdly small cap still yields a compliant payload',
    bytes(fitAsanaText(bigText, 20)) <= 20 && bytes(fitAsanaName('x'.repeat(500), 8)) <= 8);

  /* Wiring — the fix has to be AT the call sites, not merely available. */
  const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const src = (p) => readFileSync(join(ROOT, p), 'utf8');
  const notify = src('scripts/asana-notify.mjs');
  const screen = src('scripts/sanctions-screen.mjs');
  const cases = src('scripts/screening-cases.mjs');
  check('wiring: notifyAsana caps its title and plain notes by bytes',
    /name:\s*fitAsanaName\(name\)/.test(notify) && /data\.notes = fitAsanaText\(notes\)/.test(notify));
  check('wiring: the Adverse Media & PEP audit card caps by bytes',
    /name:\s*fitAsanaName\(name\),\s*notes:\s*fitAsanaText\(notes\)/.test(screen));
  check('wiring: the screening-case card caps title and body by bytes',
    /name:\s*fitAsanaName\(caseTitle\(/.test(cases) && /html_notes:\s*fitAsanaHtml\(caseHtml\(/.test(cases));
  /* The regression that started all this: a character slice on an Asana field.
     Any new one is a bug waiting for the next multilingual card. */
  for (const [file, text] of [['scripts/asana-notify.mjs', notify],
    ['scripts/sanctions-screen.mjs', screen], ['scripts/screening-cases.mjs', cases]]) {
    const offenders = [...text.matchAll(/(name|notes|html_notes)\s*:\s*[^,\n]*\.slice\(0, *\d{3,}\)/g)];
    check('no Asana field is character-sliced in ' + file + ' (bytes are what Asana counts)',
      offenders.length === 0);
  }
}

/* Paging here feeds the duplicate guard and the section lookup. Neither may
   loop forever on an API that keeps promising another page, and neither may go
   quiet when it stops early: a short task scan re-posts a card, and a section
   lookup that stops at page one creates a DUPLICATE column that nobody is
   watching — the same way the law-change queue was lost in #305. */
{
  const realFetch = globalThis.fetch, realErr = console.error;
  const src = readFileSync(join(resolve(dirname(fileURLToPath(import.meta.url)), '..'),
    'scripts/asana-notify.mjs'), 'utf8');
  check('asana paging: the section lookup walks pages instead of reading only the first 100',
    /for \(const sec of await asanaPages\('\/projects\/' \+ projectGid \+ '\/sections/.test(src));

  let calls = 0, warned = '';
  globalThis.fetch = async () => { calls++; return {
    ok: true, status: 200, headers: { get: () => null },
    json: async () => ({ data: [{ gid: String(calls), name: 'Card ' + calls, created_at: '2026-08-10T00:00:00Z' }],
      next_page: { offset: 'o' + calls } })   // never stops offering more
  }; };
  console.error = (m) => { warned += String(m); };
  let listed;
  try { listed = await listProjectTasks('123'); }
  finally { globalThis.fetch = realFetch; console.error = realErr; }
  check('asana paging: an endless next_page terminates at the cap instead of hanging the run',
    Array.isArray(listed) && listed.length === ASANA_PAGE_CAP);
  check('asana paging: stopping early is reported, never silent',
    /page cap/.test(warned) && /PARTIAL/.test(warned) && /ASANA_PAGE_CAP/.test(warned));
  check('asana paging: the duplicate guard compares against the title AS FILED (byte-capped)',
    /const want = fitAsanaName\(name\)/.test(src));
}

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
