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

const INLINE_HANDLER = /\son[a-z]+\s*=\s*["']/i;
for (const file of ['index.html', 'console.html', 'advisor.html']) {
  const html = readFileSync(new URL('../' + file, import.meta.url), 'utf8');
  check(`${file}: no inline event handlers`, !INLINE_HANDLER.test(html));

  /* Every <script ...> opening tag must carry a src= (no inline executable JS).
     Scan opening tags by index to avoid a tag-matching regex (CodeQL-friendly). */
  const lower = html.toLowerCase();
  let inlineScripts = 0;
  for (let i = lower.indexOf('<script'); i !== -1; i = lower.indexOf('<script', i + 7)) {
    const end = html.indexOf('>', i);
    if (end === -1) break;
    const tag = html.slice(i, end);
    if (!/\ssrc\s*=/.test(tag)) inlineScripts++;
  }
  check(`${file}: no inline <script> blocks (all external)`, inlineScripts === 0);
}

console.log('\n' + pass + ' passed, ' + fail + ' failed\n');
if (fail) process.exit(1);
