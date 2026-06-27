/* Hawkeye Sterling — service worker.
   Makes the three on-device screens installable and offline-capable WITHOUT
   changing the app's privacy posture: it caches only the static app shell
   (HTML + manifest + icons + the Advisor's reference data) served from this
   origin. It never caches API responses (Netlify functions are bypassed) and
   never touches the user's risk data, which lives in localStorage on-device.

   Strategy:
     • navigations  → network-first, fall back to cached page then index.html
                      (fresh when online, fully usable offline);
     • same-origin static GET → stale-while-revalidate;
     • cross-origin (Google Fonts) and non-GET → passthrough (never cached);
     • Netlify functions (/.netlify/) → always network, never cached.
   Bump CACHE to invalidate the old shell on the next visit. */

const CACHE = 'hsra-shell-v1';
const SHELL = [
  './',
  './index.html',
  './console.html',
  './advisor.html',
  './manifest.webmanifest',
  './sw-register.js',
  './i18n.js',
  './assets/super-data.js',
  './assets/icon.svg',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/icon-512-maskable.png',
  './assets/apple-touch-icon-180.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // Cache individually so one missing optional asset never fails the install.
    await Promise.all(SHELL.map((url) => cache.add(url).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // Never cache serverless function calls or cross-origin requests (fonts/API).
  if (url.origin !== self.location.origin) return;
  if (url.pathname.includes('/.netlify/')) return;

  // Navigations: network-first, offline fallback to cached page / index.
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(CACHE);
        cache.put(req, fresh.clone()).catch(() => {});
        return fresh;
      } catch (_) {
        return (await caches.match(req)) || (await caches.match('./index.html')) || Response.error();
      }
    })());
    return;
  }

  // Other same-origin static GETs: stale-while-revalidate.
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(req);
    const network = fetch(req).then((res) => {
      if (res && res.ok) cache.put(req, res.clone()).catch(() => {});
      return res;
    }).catch(() => null);
    return cached || (await network) || Response.error();
  })());
});
