/* CSP regression guardrail (deterministic, no browser needed).

   Enforces the invariant established when page logic was externalised so the
   Content-Security-Policy could drop 'unsafe-inline' from script-src:
     1. netlify.toml script-src is 'self' and carries NO 'unsafe-inline'.
     2. The three HTML pages contain NO inline event handlers (on*=) and NO
        inline executable <script> (every <script> must have a src=).
   If anyone re-introduces an inline handler or inline script, this fails in CI
   before it can silently neuter the CSP.

   Usage: node test/csp.test.mjs */
import { readFileSync } from 'node:fs';

let pass = 0, fail = 0;
const check = (name, cond) => { if (cond) { pass++; console.log('  ok  ' + name); } else { fail++; console.log('FAIL  ' + name); } };

const toml = readFileSync(new URL('../netlify.toml', import.meta.url), 'utf8');
const cspLine = (toml.match(/Content-Security-Policy\s*=\s*"([^"]*)"/) || [])[1] || '';
check('CSP header present in netlify.toml', cspLine.length > 0);

const scriptSrc = (cspLine.match(/script-src([^;]*)/) || [])[1] || '';
check('script-src directive present', scriptSrc.trim().length > 0);
check("script-src does NOT allow 'unsafe-inline'", !/'unsafe-inline'/.test(scriptSrc));
check("script-src allows 'self'", /'self'/.test(scriptSrc));
check("object-src is 'none'", /object-src 'none'/.test(cspLine));
check("base-uri is 'self'", /base-uri 'self'/.test(cspLine));
check("CSP requires Trusted Types for script sinks", /require-trusted-types-for 'script'/.test(cspLine));
check('CSP restricts Trusted Types policies to the default', /trusted-types default/.test(cspLine));

/* The Trusted Types default policy is installed by sw-register.js (the first
   script on every page) and locks down the script sinks. */
const swReg = readFileSync(new URL('../sw-register.js', import.meta.url), 'utf8');
check("sw-register.js creates the 'default' Trusted Types policy", /createPolicy\(\s*['"]default['"]/.test(swReg));
check('Trusted Types policy blocks string-to-script (createScript throws)', /createScript[\s\S]{0,80}throw/.test(swReg));
check('Trusted Types policy gates createScriptURL to same-origin', /createScriptURL[\s\S]{0,160}url\.origin === location\.origin/.test(swReg));
check('CSP declares a violation report sink (report-to/report-uri)', /report-to\s+csp-endpoint/.test(cspLine) && /report-uri\s+\/\.netlify\/functions\/csp-report/.test(cspLine));
check('Reporting-Endpoints header maps csp-endpoint to the function', /Reporting-Endpoints\s*=\s*"csp-endpoint=\\?"\/\.netlify\/functions\/csp-report\\?""/.test(toml));

const styleSrc = (cspLine.match(/style-src([^;]*)/) || [])[1] || '';
check('style-src directive present', styleSrc.trim().length > 0);
check("style-src does NOT allow 'unsafe-inline'", !/'unsafe-inline'/.test(styleSrc));
check("style-src allows 'self'", /'self'/.test(styleSrc));
const fontSrc = (cspLine.match(/font-src([^;]*)/) || [])[1] || '';
check("font-src does NOT reference Google Fonts", !fontSrc.includes('gstatic'));
check('CSP references NO Google Fonts origins (self-hosted)', !cspLine.includes('googleapis') && !cspLine.includes('gstatic'));

const INLINE_HANDLER = /\son[a-z]+\s*=\s*["']/i;
const INLINE_STYLE = /\sstyle\s*=\s*["']/i;
for (const file of ['index.html', 'console.html', 'advisor.html']) {
  const html = readFileSync(new URL('../' + file, import.meta.url), 'utf8');
  check(`${file}: no inline event handlers`, !INLINE_HANDLER.test(html));
  check(`${file}: no inline style attributes`, !INLINE_STYLE.test(html));
  check(`${file}: no Google Fonts <link>`, !html.includes('googleapis') && !html.includes('gstatic'));

  /* Every <script>/<style> opening tag must carry a src/href (no inline JS/CSS).
     Scan opening tags by index to avoid a tag-matching regex (CodeQL-friendly). */
  const lower = html.toLowerCase();
  let inlineScripts = 0;
  for (let i = lower.indexOf('<script'); i !== -1; i = lower.indexOf('<script', i + 7)) {
    const end = html.indexOf('>', i);
    if (end === -1) break;
    if (!/\ssrc\s*=/.test(html.slice(i, end))) inlineScripts++;
  }
  check(`${file}: no inline <script> blocks (all external)`, inlineScripts === 0);
  check(`${file}: no inline <style> blocks (all external)`, !lower.includes('<style'));
}

/* Inline styles must not reappear in the page logic either (they would be
   blocked by style-src 'self'); dynamic styling uses the CSSOM instead. */
for (const js of ['app.js', 'console.js', 'advisor.js']) {
  const src = readFileSync(new URL('../' + js, import.meta.url), 'utf8');
  /* Attribute form `style="` (no spaces) — distinct from a `const style = "…"`
     variable. Inline style attributes in template HTML would be CSP-blocked. */
  check(`${js}: no inline style="" in template strings`, !/style="/.test(src));
}

/* Self-hosted fonts are present. */
check('fonts.css exists and defines @font-face', /@font-face/.test(readFileSync(new URL('../fonts.css', import.meta.url), 'utf8')));

console.log('\n' + pass + ' passed, ' + fail + ' failed\n');
if (fail) process.exit(1);
