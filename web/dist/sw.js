// The phone companion's copy of itself, for when the homelab can't be
// reached (away from home, Tailscale off): its page, script, styles and
// icons, each kept as it was last served. Every request still goes to the
// homelab first, so an update is seen at once; the copy answers only when
// that fails. The API is never kept here: companion.js keeps the last
// Status itself, and nothing else the phone was told. companion.js
// registers it, on the phone only, where the page is served over HTTPS.
const CACHE = 'homelab-companion';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/') || url.pathname.endsWith('.ics')) return;
  e.respondWith(fetch(req).then((res) => {
    if (res.ok) {
      const copy = res.clone();
      e.waitUntil(caches.open(CACHE).then((c) => c.put(req, copy)));
    }
    return res;
  }, () => caches.open(CACHE).then((c) => c.match(req, { ignoreSearch: true })).then((kept) => kept || Response.error())));
});
