/* Security-header regression guardrail (deterministic, no network).

   Locks in the edge-hardening headers declared in netlify.toml so a future edit
   can't silently weaken the deployed security posture. Complements
   test/csp.test.mjs (which focuses on the Content-Security-Policy itself).

   No dynamic RegExp is built from variable input (CodeQL-friendly): header
   lookups use plain string scanning and feature checks use substring matches.

   Usage: node test/security-headers.test.mjs */
import { readFileSync } from 'node:fs';

let pass = 0, fail = 0;
const check = (name, cond) => { if (cond) { pass++; console.log('  ok  ' + name); } else { fail++; console.log('FAIL  ' + name); } };

const toml = readFileSync(new URL('../netlify.toml', import.meta.url), 'utf8');
const swsToml = readFileSync(new URL('../sws.toml', import.meta.url), 'utf8');
const QUOTED = /"((?:[^"\\]|\\.)*)"/; // constant regex — extracts the (possibly escaped) quoted value on a header line
/* Find `Header = "value"` by scanning lines (no regex built from `header`). */
const valIn = (content, header) => {
  for (const raw of content.split('\n')) {
    const line = raw.trim();
    if (line.startsWith(header + ' =') || line.startsWith(header + '=')) {
      const m = line.match(QUOTED);
      if (m) return m[1];
    }
  }
  return '';
};
const val = (header) => valIn(toml, header);

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
check('HSTS includes subdomains', hsts.includes('includeSubDomains'));
check('HSTS is preload-eligible', hsts.includes('preload'));

/* Cross-origin isolation trio */
check('COOP is same-origin', val('Cross-Origin-Opener-Policy') === 'same-origin');
check('CORP is same-origin', val('Cross-Origin-Resource-Policy') === 'same-origin');
const coep = val('Cross-Origin-Embedder-Policy');
check('COEP isolates the context (require-corp | credentialless)', coep === 'require-corp' || coep === 'credentialless');

/* Permissions-Policy: powerful features denied + ad-tracking opt-out.
   Each feature must appear as the exact token `feature=()` (deny-all). */
const pp = val('Permissions-Policy');
for (const feat of ['geolocation', 'camera', 'microphone', 'payment', 'usb', 'bluetooth', 'serial', 'hid', 'accelerometer', 'gyroscope', 'magnetometer', 'midi', 'display-capture', 'idle-detection']) {
  check(`Permissions-Policy denies ${feat}`, pp.includes(feat + '=()'));
}
check('Permissions-Policy opts out of FLoC (interest-cohort)', pp.includes('interest-cohort=()'));
check('Permissions-Policy opts out of Topics (browsing-topics)', pp.includes('browsing-topics=()'));

/* CSP closes the unused fetch directives too */
const csp = val('Content-Security-Policy');
check("CSP media-src is 'none'", csp.includes("media-src 'none'"));
check("CSP frame-src is 'none'", csp.includes("frame-src 'none'"));
check("CSP child-src is 'none'", csp.includes("child-src 'none'"));

/* Container parity: sws.toml (served by the self-hosting image) must carry
   byte-identical values for every security header the edge sets — a hardening
   change in netlify.toml that skips sws.toml (or vice versa) fails here. */
for (const header of [
  'Content-Security-Policy', 'Reporting-Endpoints', 'X-Frame-Options',
  'X-Content-Type-Options', 'X-Permitted-Cross-Domain-Policies',
  'X-DNS-Prefetch-Control', 'Referrer-Policy', 'Permissions-Policy',
  'Strict-Transport-Security', 'Cross-Origin-Opener-Policy',
  'Cross-Origin-Embedder-Policy', 'Cross-Origin-Resource-Policy',
  'Cache-Control',
]) {
  const edge = valIn(toml, header), container = valIn(swsToml, header);
  check(`sws.toml mirrors ${header}`, edge !== '' && edge === container);
}
check('sws.toml applies the header set to every route (source "**")', swsToml.includes('source = "**"'));
check('sws.toml keeps the sw.js no-cache route', swsToml.includes('source = "/sw.js"'));

console.log('\n' + pass + ' passed, ' + fail + ' failed\n');
if (fail) process.exit(1);
