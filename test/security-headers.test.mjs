/* Security-header regression guardrail (deterministic, no network).

   Locks in the edge-hardening headers declared in netlify.toml so a future edit
   can't silently weaken the deployed security posture. Complements
   test/csp.test.mjs (which focuses on the Content-Security-Policy itself).

   Usage: node test/security-headers.test.mjs */
import { readFileSync } from 'node:fs';

let pass = 0, fail = 0;
const check = (name, cond) => { if (cond) { pass++; console.log('  ok  ' + name); } else { fail++; console.log('FAIL  ' + name); } };

const toml = readFileSync(new URL('../netlify.toml', import.meta.url), 'utf8');
const val = (header) => {
  const m = toml.match(new RegExp(header.replace(/[-]/g, '\\-') + '\\s*=\\s*"([^"]*)"'));
  return m ? m[1] : '';
};

/* Clickjacking + MIME + cross-domain-policy lockdown */
check('X-Frame-Options is DENY', val('X-Frame-Options') === 'DENY');
check('X-Content-Type-Options is nosniff', val('X-Content-Type-Options') === 'nosniff');
check('X-Permitted-Cross-Domain-Policies is none', val('X-Permitted-Cross-Domain-Policies') === 'none');
check('X-DNS-Prefetch-Control is off', val('X-DNS-Prefetch-Control') === 'off');
check('Referrer-Policy is no-referrer', val('Referrer-Policy') === 'no-referrer');

/* HSTS: ≥1 year, subdomains, preload */
const hsts = val('Strict-Transport-Security');
const maxAge = Number((hsts.match(/max-age=(\d+)/) || [])[1] || 0);
check('HSTS max-age is at least 1 year', maxAge >= 31536000);
check('HSTS includes subdomains', /includeSubDomains/.test(hsts));
check('HSTS is preload-eligible', /preload/.test(hsts));

/* Cross-origin isolation trio */
check('COOP is same-origin', val('Cross-Origin-Opener-Policy') === 'same-origin');
check('CORP is same-origin', val('Cross-Origin-Resource-Policy') === 'same-origin');
const coep = val('Cross-Origin-Embedder-Policy');
check('COEP isolates the context (require-corp | credentialless)', coep === 'require-corp' || coep === 'credentialless');

/* Permissions-Policy: powerful features denied + ad-tracking opt-out */
const pp = val('Permissions-Policy');
for (const feat of ['geolocation', 'camera', 'microphone', 'payment', 'usb', 'bluetooth', 'serial', 'hid', 'accelerometer', 'gyroscope', 'magnetometer', 'midi', 'display-capture', 'idle-detection']) {
  check(`Permissions-Policy denies ${feat}`, new RegExp(feat.replace(/[-]/g, '\\-') + '=\\(\\)').test(pp));
}
check('Permissions-Policy opts out of FLoC (interest-cohort)', /interest-cohort=\(\)/.test(pp));
check('Permissions-Policy opts out of Topics (browsing-topics)', /browsing-topics=\(\)/.test(pp));

/* CSP closes the unused fetch directives too */
const csp = val('Content-Security-Policy');
check("CSP media-src is 'none'", /media-src 'none'/.test(csp));
check("CSP frame-src is 'none'", /frame-src 'none'/.test(csp));
check("CSP child-src is 'none'", /child-src 'none'/.test(csp));

console.log('\n' + pass + ' passed, ' + fail + ' failed\n');
if (fail) process.exit(1);
