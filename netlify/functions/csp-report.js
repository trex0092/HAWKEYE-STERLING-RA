/* Content-Security-Policy violation collector. Browsers POST here when a CSP
   directive is violated (via the `report-to` Reporting API and the legacy
   `report-uri` directive — see netlify.toml). Reports are validated, size-capped,
   per-IP rate-limited, and written to the function logs (no datastore, no PII
   egress) so production violations are visible instead of silently blocked.

   It deliberately does NOT raise Asana alerts: CSP reports can be high-volume
   and browser/extension-generated, so they are logged for inspection and the
   csp.test.mjs guardrail remains the authoritative pre-merge gate. */
const { rateLimit } = require('./_ratelimit');

const MAX_BODY = 16 * 1024; /* a CSP report is small; cap to resist abuse */

function pick(o, keys) {
  for (const k of keys) if (o && o[k] != null && o[k] !== '') return String(o[k]);
  return '?';
}

exports.handler = async (event) => {
  const method = String((event && event.httpMethod) || '').toUpperCase();
  if (method === 'OPTIONS') return { statusCode: 204, body: '' };
  if (method !== 'POST') return { statusCode: 405, headers: { Allow: 'POST' }, body: '' };

  const limited = rateLimit(event, {
    name: 'csp-report',
    limit: Number(process.env.RATE_LIMIT_CSP_REPORT) || 60,
    windowMs: 60000,
  });
  if (limited) return limited;

  const raw = (event && event.body) || '';
  if (raw.length > MAX_BODY) return { statusCode: 413, body: '' };

  try {
    const data = JSON.parse(raw);
    /* report-uri sends {"csp-report": {...}}; the Reporting API (report-to) sends
       an array of {type, body:{...}}. Normalise both to a list of violations. */
    const list = Array.isArray(data) ? data : [data];
    for (const item of list) {
      const v = item['csp-report'] || item.body || item;
      const rec = {
        directive: pick(v, ['effective-directive', 'effectiveDirective', 'violated-directive', 'violatedDirective']),
        blocked: pick(v, ['blocked-uri', 'blockedURL', 'blockedURI']),
        doc: pick(v, ['document-uri', 'documentURL', 'url']),
        disposition: pick(v, ['disposition']),
      };
      console.warn('[csp-report] ' + JSON.stringify(rec).slice(0, 600));
    }
  } catch (e) {
    console.warn('[csp-report] unparseable report body');
  }

  /* Always 204: the browser ignores the response body and should not retry. */
  return { statusCode: 204, body: '' };
};
