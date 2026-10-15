/* ==========================================================
   Productive — offline support (service worker)
   ----------------------------------------------------------
   Keeps a copy of the app's own files so a bookmarked or
   home-screen Productive still opens with no internet.

   Strategy: NETWORK FIRST. Online, every file is fetched
   fresh (so updates show up immediately) and the copy is
   refreshed. Offline, the saved copy is used instead.

   It never stores or sees your tasks (those live in the
   browser's localStorage), and it ignores other websites.
   Bump CACHE when the list of files changes.
   ========================================================== */
const CACHE = 'productive-v2';
const CORE = [
  './', 'index.html', 'styles.css', 'app.js',
  'help.html', 'privacy.html', 'terms.html', 'contact.html', '404.html',
  'pages.css', 'pages.js', 'contact.js', 'manifest.webmanifest',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(CORE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  // Only this site's own files; never other websites (fonts, maps, email…)
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() =>
        caches.match(req, { ignoreSearch: true }).then((hit) =>
          hit || (req.mode === 'navigate' ? caches.match('index.html') : Response.error())
        )
      )
  );
});

// Tapping a reminder notification brings Productive to the front (or opens it)
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const open = list.find((c) => c.url.startsWith(self.registration.scope));
      return open ? open.focus() : self.clients.openWindow('./');
    })
  );
});
