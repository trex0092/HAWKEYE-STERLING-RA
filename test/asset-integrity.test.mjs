/* Static guardrail for the three screens' asset graph — every local reference
   must resolve to a file that ships. Catches a renamed/moved/deleted asset (or a
   forgotten sw.js precache update) before it 404s in production, which the
   browser-smoke tests can't see because the shell still boots without an
   optional icon/font. Pure fs, no browser. Usage: node test/asset-integrity.test.mjs */
import { readFileSync, existsSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0, failed = 0;
const check = (name, cond) => { if (cond) { passed++; console.log('  ok  ' + name); } else { failed++; console.log('FAIL  ' + name); } };
const read = (rel) => readFileSync(resolve(ROOT, rel), 'utf8');
const localExists = (rel) => existsSync(resolve(ROOT, rel));

/* A reference is "local" when it is not an external URL, data: URI, anchor,
   mailto:, tel:, or protocol-relative link — i.e. a same-repo relative path. */
const isLocal = (u) => u && !/^(https?:|data:|mailto:|tel:|#|\/\/)/i.test(u);
const clean = (u) => u.split('#')[0].split('?')[0].replace(/^\.\//, '');

const PAGES = ['index.html', 'console.html', 'advisor.html', 'conflict-context.html'];

/* 1. Every href/src in each page resolves to a shipped file. */
for (const page of PAGES) {
  const html = read(page);
  const refs = [...html.matchAll(/(?:href|src)\s*=\s*"([^"]+)"/gi)]
    .map((m) => m[1]).filter(isLocal).map(clean);
  const unique = [...new Set(refs)];
  check(`${page}: has local asset references to verify`, unique.length > 0);
  for (const r of unique) {
    check(`${page}: href/src "${r}" exists`, localExists(r));
  }
}

/* 2. manifest.webmanifest — every icon src, start_url, scope and shortcut url
   resolves (scope/start_url may be a directory like "./"). */
const manifest = JSON.parse(read('manifest.webmanifest'));
for (const icon of manifest.icons || []) {
  check(`manifest: icon "${icon.src}" exists`, localExists(clean(icon.src)));
}
for (const sc of manifest.shortcuts || []) {
  if (isLocal(sc.url)) check(`manifest: shortcut "${sc.url}" exists`, localExists(clean(sc.url)));
}
for (const key of ['start_url', 'scope']) {
  const v = manifest[key];
  if (v && isLocal(v)) {
    const p = clean(v);
    check(`manifest: ${key} "${v}" exists`, p === '' || localExists(p));
  }
}

/* 3. sw.js SHELL precache — every entry resolves (a stale entry would 404 on
   install; cache.add rejects and the offline shell is silently incomplete). */
const sw = read('sw.js');
const shellBlock = (sw.match(/const SHELL\s*=\s*\[([\s\S]*?)\]/) || [])[1] || '';
const shell = [...shellBlock.matchAll(/["']([^"']+)["']/g)].map((m) => m[1]);
check('sw.js: SHELL precache list found', shell.length > 0);
for (const entry of shell) {
  const p = clean(entry);
  // './' is the site root (index.html served at /) — always valid.
  check(`sw.js: precache "${entry}" exists`, p === '' || localExists(p));
}

/* 4. fonts.css @font-face url() sources — every self-hosted woff2 resolves. */
const fonts = read('fonts.css');
const fontUrls = [...fonts.matchAll(/url\(\s*['"]?([^)'"]+)['"]?\s*\)/gi)]
  .map((m) => m[1]).filter(isLocal).map(clean);
check('fonts.css: has @font-face url() sources', fontUrls.length > 0);
for (const u of [...new Set(fontUrls)]) {
  check(`fonts.css: font "${u}" exists`, localExists(u));
}

/* 5. Page stylesheets — any url() background/asset (non-data) resolves. */
for (const css of ['app.css', 'console.css', 'advisor.css', 'conflict-context.css']) {
  const txt = read(css);
  const urls = [...txt.matchAll(/url\(\s*['"]?([^)'"]+)['"]?\s*\)/gi)]
    .map((m) => m[1]).filter(isLocal).map(clean);
  for (const u of [...new Set(urls)]) {
    check(`${css}: url("${u}") exists`, localExists(u));
  }
}

/* 6. Optional conflict research must remain a passive reference, not a control.
   These are static fixture assertions, not a sanitizer for untrusted HTML. */
{
  const html = read('conflict-context.html');
  const css = read('conflict-context.css');
  const policy = JSON.parse(read('data/conflict-context-sources.json'));
  const expectedUrls = [
    'https://armedconflicts.org/',
    'https://armedconflicts.org/methodology.html',
    'https://www.cfr.org/global-conflict-tracker',
    'https://www.cfr.org/global-conflict-tracker/methodology',
    'https://www.cfr.org/terms-use',
  ];
  const localLinks = new Set(['#main', 'index.html', 'console.html', 'advisor.html', 'conflict-context.html']);
  const deniedCapabilities = ['automaticFetching', 'storesCaseData', 'affectsRiskScore',
    'contributesScreeningAssurance', 'allowsCaseDisposition'];
  const csp = "default-src 'none'; style-src 'self'; base-uri 'none'; form-action 'none'; object-src 'none'";
  function passivePage(page, style, config) {
    const tags = [...page.matchAll(/<\s*\/?\s*([a-z][a-z0-9-]*)\b/gi)].map(m => m[1].toLowerCase());
    const allowedTags = new Set(['html', 'head', 'meta', 'title', 'link', 'body', 'a', 'header',
      'p', 'nav', 'main', 'h1', 'h2', 'h3', 'section', 'strong', 'article', 'ol', 'li', 'dl', 'dt', 'dd', 'footer', 'time']);
    if (tags.some(t => !allowedTags.has(t)) || /\s(?:on[a-z]+|style|src|srcdoc|ping)\s*=/i.test(page)) return false;
    if (!page.includes('name="referrer" content="no-referrer"')
      || !page.includes('http-equiv="Content-Security-Policy" content="' + csp + '"')) return false;
    if ([...page.matchAll(/http-equiv\s*=\s*"([^"]+)"/gi)].some(m => m[1] !== 'Content-Security-Policy')) return false;
    const sheets = [...page.matchAll(/<link\b[^>]*>/gi)];
    if (sheets.length !== 1 || sheets[0][0] !== '<link rel="stylesheet" href="conflict-context.css">'
      || /@import|url\s*\(/i.test(style)) return false;
    const urls = [];
    for (const match of page.matchAll(/<a\b[^>]*>/gi)) {
      const tag = match[0];
      const href = /\bhref="([^"]+)"/.exec(tag)?.[1];
      if (localLinks.has(href)) continue;
      if (!expectedUrls.includes(href) || !/target="_blank"/.test(tag)
        || !/rel="noopener noreferrer"/.test(tag) || !/referrerpolicy="no-referrer"/.test(tag)) return false;
      urls.push(href);
    }
    if (urls.length !== expectedUrls.length || new Set(urls).size !== expectedUrls.length) return false;
    if (config.schema !== 'hawkeye.conflict-context/v1' || config.mode !== 'link-only'
      || config.sourceAvailability !== 'not-monitored'
      || deniedCapabilities.some(key => config[key] !== false)) return false;
    if (!Array.isArray(config.sources) || config.sources.length !== 2
      || config.sources.map(s => s.id).join(',') !== 'armedconflicts,cfr') return false;
    const configUrls = config.sources.flatMap(s => [s.url, s.methodologyUrl, s.termsUrl].filter(Boolean));
    if (configUrls.join('\n') !== expectedUrls.join('\n')
      || config.sources.some(s => s.contentAsOf !== null || s.countsAsIndependentBackbone !== false
        || s.automatedReuse !== 'not-approved')) return false;
    return page.includes('External-source availability and freshness: UNKNOWN.')
      && page.includes('not a source-update date or an individual case-review date')
      && page.includes('one originating') && page.includes('not two independent corroborations');
  }
  check('conflict research: actual page, stylesheet and policy are passive and reference-only', passivePage(html, css, policy));
  check('conflict research: page is accessible without JavaScript',
    html.includes('<html lang="en">') && html.includes('href="#main"')
    && html.includes('<main id="main" tabindex="-1">') && html.includes('aria-label="Suite navigation"'));
  check('conflict research: review states never assert clearance',
    ['Not reviewed', 'Review required', 'Review completed', 'Source unavailable'].every(s => html.includes(s))
    && html.includes('this does not mean the subject is clear'));
  check('conflict research: injected script fails the guard', !passivePage(html + '<script src="app.js"></script>', css, policy));
  check('conflict research: embedded content fails the guard', !passivePage(html + '<iframe src="https://www.cfr.org/"></iframe>', css, policy));
  check('conflict research: automatic refresh fails the guard', !passivePage(html + '<meta http-equiv="refresh" content="0">', css, policy));
  check('conflict research: customer query strings fail the guard',
    !passivePage(html.replace('href="https://armedconflicts.org/"', 'href="https://armedconflicts.org/?customer=Synthetic"'), css, policy));
  check('conflict research: missing referrer protection fails the guard',
    !passivePage(html.replace('rel="noopener noreferrer"', 'rel="noopener"'), css, policy));
  check('conflict research: remote stylesheet imports fail the guard', !passivePage(html, css + '@import url(https://example.invalid/x);', policy));
  for (const key of deniedCapabilities) {
    check('conflict research: enabling ' + key + ' fails the guard', !passivePage(html, css, { ...policy, [key]: true }));
  }
  const independent = structuredClone(policy);
  independent.sources[0].countsAsIndependentBackbone = true;
  check('conflict research: duplicate origin cannot count as independent screening coverage', !passivePage(html, css, independent));
  const fabricatedDate = structuredClone(policy);
  fabricatedDate.sources[0].contentAsOf = fabricatedDate.reviewedOn;
  check('conflict research: policy review date cannot be substituted for source freshness', !passivePage(html, css, fabricatedDate));
  check('conflict research: hiding unknown source availability fails the guard',
    !passivePage(html.replace('External-source availability and freshness: UNKNOWN.', 'Sources verified current.'), css, policy));

  const children = [];
  const footerNode = { style: {}, appendChild: node => children.push(node) };
  const document = {
    getElementById: id => { if (id !== 'hsra-legal-footer') throw new Error('Unexpected case/DOM access'); return footerNode; },
    createElement: tag => { if (tag !== 'a') throw new Error('Unexpected active element'); return { tag, style: {} }; },
    createTextNode: text => ({ textContent: text }),
  };
  // This sandbox has no fetch, storage, window, location or credentials.
  runInNewContext(read('legal-footer.js'), { document }, { timeout: 1000 });
  const links = children.filter(node => node.tag === 'a');
  check('conflict research: shared footer creates only the three fixed local links',
    links.map(node => node.href).join(',') === 'privacy-policy.html,terms.html,conflict-context.html'
    && links[2].textContent === 'Conflict research (English)');
  for (const page of ['index.html', 'console.html', 'advisor.html']) {
    check(`${page}: conflict reference is reachable through the existing shared footer`, read(page).includes('src="legal-footer.js"'));
  }
  for (const file of ['app.js', 'screen.py', 'scripts/sanctions-screen.mjs', 'scripts/adverse-media.mjs',
    'scripts/pep-worldwide.mjs', 'scripts/screening-assurance.mjs', 'data/worldwide-screening-sources.json',
    'data/sanctions-sources.json', 'data/jurisdiction-risk.json', 'data/country-score-suggested.json']) {
    check(`${file}: optional conflict references stay outside screening and scoring`,
      !/armedconflicts\.org|cfr\.org|conflict-context/i.test(read(file)));
  }
}

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
