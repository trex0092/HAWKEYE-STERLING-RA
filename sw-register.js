/* Registers the service worker for the PWA (offline + installable). A no-op
   where service workers are unsupported or unavailable (e.g. opened from
   file://), so it never throws. Kept as an external file — not an inline
   <script> — so it neither needs a CSP inline allowance nor disturbs the
   inline app-script extraction in test/app.test.js.

   This is the FIRST script on every page, so it also installs the Trusted Types
   default policy before any DOM/script sink runs (see below). */

/* ── Trusted Types default policy (DOM-XSS hardening) ──────────────────────────
   With the CSP `require-trusted-types-for 'script'` directive, the browser routes
   every injection sink (innerHTML, script URLs, eval, …) through the named
   'default' policy. The app's own markup is trusted and all untrusted values are
   HTML-escaped upstream (esc()), so createHTML passes through; the genuinely
   dangerous sinks are locked down:
     - createScript THROWS — the app never builds script from a string (no eval /
       new Function), so any such attempt is an injection and is blocked.
     - createScriptURL allows ONLY same-origin URLs (the service worker), blocking
       a script URL pointed at an attacker origin.
   Browsers without Trusted Types (Firefox/WebKit) ignore this — no effect. */
(function () {
  try {
    if (window.trustedTypes && window.trustedTypes.createPolicy) {
      window.trustedTypes.createPolicy('default', {
        createHTML: function (s) { return s; },
        createScript: function () {
          throw new TypeError('Trusted Types: string-to-script is blocked (no eval/new Function in this app).');
        },
        createScriptURL: function (u) {
          var url = new URL(String(u), location.origin);
          if (url.origin === location.origin) return String(u);
          throw new TypeError('Trusted Types: blocked cross-origin script URL ' + u);
        },
      });
    }
  } catch (e) { /* a 'default' policy already exists, or TT unsupported — ignore */ }
})();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('sw.js').catch(function () {});
  });
}
