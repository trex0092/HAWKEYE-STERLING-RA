/* Registers the service worker for the PWA (offline + installable). A no-op
   where service workers are unsupported or unavailable (e.g. opened from
   file://), so it never throws. Kept as an external file — not an inline
   <script> — so it neither needs a CSP inline allowance nor disturbs the
   inline app-script extraction in test/app.test.js. */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('sw.js').catch(function () {});
  });
}
