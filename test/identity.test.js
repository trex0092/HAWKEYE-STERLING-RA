/* Verified OIDC identity tests. Synthetic RS256 keys and JWTs only.
   No live IdP, secrets, external API, or patient/customer data.
   Usage: node test/identity.test.js
*/
'use strict';
const crypto = require('node:crypto');
const path = require('node:path');
const identity = require(path.join(__dirname, '..', 'netlify', 'functions', '_identity.js'));
const mirror = require(path.join(__dirname, '..', 'netlify', 'functions', 'asana-mirror.js'));
const riskBackup = require(path.join(__dirname, '..', 'netlify', 'functions', 'risk-backup.js'));

const envNames = [
  'APP_OIDC_REQUIRED', 'APP_OIDC_ISSUER', 'APP_OIDC_AUDIENCE',
  'APP_OIDC_JWKS_URL', 'APP_OIDC_MAX_TTL_SECONDS', 'APP_SHARED_TOKEN',
  'ASANA_ACCESS_TOKEN', 'ASANA_PROJECT_GID'
];
const originals = Object.fromEntries(envNames.map(name => [name, process.env[name]]));
const originalFetch = global.fetch;
let passed = 0, failed = 0;
function check(message, yes) {
  if (yes) { passed++; console.log('  ok  ' + message); }
  else { failed++; console.log('FAIL  ' + message); }
}
const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const publicJwk = { ...publicKey.export({ format: 'jwk' }), kid: 'test-key', use: 'sig', alg: 'RS256' };
const issuer = 'https://idp.example.test/tenant';
const audience = 'hawkeye-backend';
const jwksUrl = issuer + '/keys';
const now = Math.floor(Date.now() / 1000);
const defaultClaims = {
  iss: issuer, aud: audience, sub: 'synthetic-account', iat: now - 10,
  exp: now + 600, hawkeye_role: 'Reviewer-MLRO'
};
function b64(value) { return Buffer.from(JSON.stringify(value)).toString('base64url'); }
function jwt(claims = {}, header = {}) {
  const signingInput = b64({ alg: 'RS256', kid: 'test-key', typ: 'at+jwt', ...header }) +
    '.' + b64({ ...defaultClaims, ...claims });
  const sig = crypto.sign('RSA-SHA256', Buffer.from(signingInput), privateKey).toString('base64url');
  return signingInput + '.' + sig;
}
function event(token, body) {
  return { httpMethod: 'POST', headers: token ? { Authorization: 'Bearer ' + token } : {},
    body: JSON.stringify(body || {}) };
}

(async () => {
  try {
    process.env.APP_OIDC_REQUIRED = '0';
    check('legacy identity mode remains opt-in',
      (await identity.requireIdentityRole(event(), ['Admin'])).ok === true);

    process.env.APP_OIDC_REQUIRED = '1';
    process.env.APP_OIDC_ISSUER = issuer;
    process.env.APP_OIDC_AUDIENCE = audience;
    process.env.APP_OIDC_JWKS_URL = jwksUrl;
    process.env.APP_OIDC_MAX_TTL_SECONDS = '3600';
    delete process.env.APP_SHARED_TOKEN;
    process.env.ASANA_ACCESS_TOKEN = 'offline-test-only';
    process.env.ASANA_PROJECT_GID = '0';

    let keyFetches = 0;
    let asanaFetches = 0;
    global.fetch = async url => {
      if (url !== jwksUrl) { asanaFetches++; throw Error('downstream must not be called'); }
      keyFetches++;
      return {
        ok: true, headers: { get: () => null },
        text: async () => JSON.stringify({ keys: [publicJwk] })
      };
    };

    check('required identity denies missing bearer',
      (await identity.requireIdentityRole(event(), ['Reviewer-MLRO'])).statusCode === 401);
    const valid = jwt();
    const verified = await identity.requireIdentityRole(event(valid), ['Reviewer-MLRO', 'Admin']);
    check('signed allowed role is verified and subject is traceable',
      verified.ok === true && verified.enabled === true &&
      verified.role === 'Reviewer-MLRO' && verified.subject === 'synthetic-account');
    const noAdmin = await identity.requireIdentityRole(event(valid), ['Admin']);
    check('valid identity without required role returns 403',
      !noAdmin.ok && noAdmin.statusCode === 403);
    check('JWKS is cached for repeated token checks', keyFetches === 1);

    const checks = [
      ['wrong issuer', jwt({ iss: 'https://fake.example.test' })],
      ['wrong audience', jwt({ aud: 'another-api' })],
      ['expired access token', jwt({ iat: now - 7200, exp: now - 3600 })],
      ['token minted in the future', jwt({ iat: now + 3600, exp: now + 3900 })],
      ['excessive token lifetime', jwt({ iat: now - 10, exp: now + 86400 })],
      ['unsigned algorithm none', jwt({}, { alg: 'none' })],
      ['untrusted role claim', jwt({ hawkeye_role: 'Superuser' })],
      ['unrecognized signing key', jwt({}, { kid: 'another-key' })]
    ];
    for (const [label, token] of checks) {
      const denied = await identity.requireIdentityRole(event(token), ['Reviewer-MLRO', 'Admin']);
      check('rejects ' + label, denied.statusCode === 401);
    }
    const parts = valid.split('.');
    const tampered = parts[0] + '.' + b64({ ...defaultClaims, hawkeye_role: 'Admin' }) + '.' + parts[2];
    check('role escalation by editing unsigned payload is rejected',
      (await identity.requireIdentityRole(event(tampered), ['Admin'])).statusCode === 401);

    let result = await mirror.handler(event(null, { action: 'read' }));
    check('confidential mirror blocks request without verified bearer',
      result.statusCode === 401 && asanaFetches === 0);
    const analyst = jwt({ hawkeye_role: 'Analyst' });
    result = await mirror.handler(event(analyst, { action: 'read' }));
    check('Analyst cannot read the firm-wide confidential mirror',
      result.statusCode === 403 && asanaFetches === 0);
    result = await riskBackup.handler(event(valid, { sheet: { overrides: {} } }));
    check('only Admin can write risk overrides',
      result.statusCode === 403 && asanaFetches === 0);

    delete process.env.APP_OIDC_AUDIENCE;
    const configError = await identity.requireIdentityRole(event(valid), ['Admin']);
    check('enabled OIDC with incomplete config fails closed at 503',
      configError.statusCode === 503);
    process.env.APP_OIDC_AUDIENCE = audience;

    identity._resetCache();
    global.fetch = async () => { throw Error('simulated IdP outage'); };
    check('IdP verification outage fails closed at 503',
      (await identity.requireIdentityRole(event(valid), ['Reviewer-MLRO'])).statusCode === 503);
  } finally {
    for (const name of envNames) {
      if (originals[name] === undefined) delete process.env[name];
      else process.env[name] = originals[name];
    }
    global.fetch = originalFetch;
    identity._resetCache();
  }
  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  process.exitCode = failed ? 1 : 0;
})().catch(err => {
  console.error('Identity test runner failed:', err.message);
  process.exitCode = 1;
});
