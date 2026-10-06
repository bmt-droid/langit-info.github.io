// Langit service worker: makes the site installable and keeps it working offline.
// When you change index.html, bump VERSION so phones pick up the new version quickly.
const VERSION = 'langit-v38';
const DATA = 'langit-data';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-maskable-512.png', './apple-touch-icon.png',
  './assets/bricolage-latin.woff2', './assets/figtree-latin.woff2'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION && k !== DATA).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function trimData(max = 40){
  const c = await caches.open(DATA), keys = await c.keys();
  for (let i = 0; i < keys.length - max; i++) await c.delete(keys[i]);
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // The page itself: always try the network first so updates show, fall back to the saved copy offline
  if (req.mode === 'navigate'){
    e.respondWith(
      fetch(req, { cache: 'no-cache' }).then(res => {
        const copy = res.clone();
        caches.open(VERSION).then(c => c.put('./index.html', copy));
        return res;
      }).catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Weather, BMKG and place data: fresh when online, last saved copy when offline
  if (/(^|\.)open-meteo\.com$|\.workers\.dev$|^api\.langit\.info$|bigdatacloud\.net$/.test(url.hostname)){
    e.respondWith(
      fetch(req).then(res => {
        if (res.ok){ const copy = res.clone(); caches.open(DATA).then(c => c.put(req, copy)).then(() => trimData()); }
        return res;
      }).catch(() => caches.match(req))
    );
    return;
  }

  // Icons, manifest, fonts and satellite.js: use the saved copy, fetch once if missing
  if (url.origin === self.location.origin){
    e.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(res => {
        if (res.ok || res.type === 'opaque'){ const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
        return res;
      }))
    );
  }
});
