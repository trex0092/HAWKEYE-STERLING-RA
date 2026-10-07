/* Hawkeye Sterling browser error telemetry.
 *
 * Captures only runtime failure metadata. It does NOT send assessment state,
 * form values, localStorage, query strings, cookies or stack traces.
 * Delivery is same-origin to the Netlify collector and is best-effort.
 */
(function () {
  'use strict';

  const ENDPOINT = '/.netlify/functions/client-error-report';
  const MAX_PER_PAGE = 20;
  const DEDUP_MS = 60000;
  const seen = new Map();
  let sent = 0;

  function clean(value, max) {
    return String(value == null ? '' : value)
      .replace(/bearer\s+[A-Za-z0-9._~+\/-]+/gi, 'Bearer <redacted>')
      .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '<email>')
      .replace(/([?&](?:token|key|secret|code|sig|signature)=)[^&#\s]+/gi, '$1<redacted>')
      .replace(/[A-Za-z0-9_-]{40,}/g, '<token>')
      .slice(0, max || 180);
  }

  function sourcePath(value) {
    if (!value) return '';
    try {
      const u = new URL(String(value), window.location.href);
      return u.origin === window.location.origin ? u.pathname.slice(0, 160) : '<cross-origin>';
    } catch {
      return '';
    }
  }

  function transmit(payload) {
    if (sent >= MAX_PER_PAGE) return;
    const fingerprint = [payload.kind, payload.message, payload.source, payload.line].join('|');
    const now = Date.now();
    const last = seen.get(fingerprint) || 0;
    if (now - last < DEDUP_MS) return;
    seen.set(fingerprint, now);
    sent += 1;

    const body = JSON.stringify(payload);
    try {
      if (navigator.sendBeacon) {
        const blob = new Blob([body], { type: 'application/json' });
        if (navigator.sendBeacon(ENDPOINT, blob)) return;
      }
    } catch {}

    try {
      fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
        credentials: 'same-origin',
      }).catch(function () {});
    } catch {}
  }

  function report(kind, detail) {
    transmit({
      kind,
      page: window.location.pathname,
      source: sourcePath(detail && detail.source),
      line: Number(detail && detail.line) || 0,
      column: Number(detail && detail.column) || 0,
      message: clean(detail && detail.message ? detail.message : 'Client error', 180),
    });
  }

  window.addEventListener('error', function (event) {
    report('window.error', {
      message: event && event.message,
      source: event && event.filename,
      line: event && event.lineno,
      column: event && event.colno,
    });
  }, true);

  window.addEventListener('unhandledrejection', function (event) {
    const reason = event && event.reason;
    report('unhandledrejection', {
      message: reason && reason.message ? reason.message : String(reason || 'Unhandled promise rejection'),
      source: '',
      line: 0,
      column: 0,
    });
  });
})();
