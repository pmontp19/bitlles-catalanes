// Service worker de Bitlla!: permet instal·lar el joc i jugar-hi sense connexió.
// - Pàgina: primer xarxa (per rebre versions noves), i si no n'hi ha, la desada.
// - Fitxers amb hash, textures, fonts i icones: primer la memòria cau (no canvien mai amb el mateix nom).
// - L'API (/api/) no es desa mai: la plantada del dia i el rànquing han de ser frescos.
const CACHE = 'bitlla-v1';
const SHELL = ['/', '/manifest.webmanifest', '/favicon.png', '/icones/icona-192.png', '/icones/apple-touch-icon.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put('/', copy)); return res; })
        .catch(() => caches.match('/')),
    );
    return;
  }

  e.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    })),
  );
});
