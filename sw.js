const CACHE_NAME = 'hask-v3';
const STATIC_ASSETS = [
  '/OliTest/',
  '/OliTest/index.html',
  '/OliTest/manifest.json',
  '/OliTest/splash.jpg'
];

// Install: pre-cache static assets
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(c => c.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate: clean old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => clients.claim())
  );
});

// Fetch strategy:
// - Firebase / Google APIs → network only (real-time data must be live)
// - Fonts, CDN scripts → cache first, fallback network
// - App shell (index.html, manifest) → network first, fallback cache
self.addEventListener('fetch', e => {
  const url = e.request.url;

  // Firebase Realtime DB & Auth → always network, never cache
  if (
    url.includes('firebasedatabase.app') ||
    url.includes('firebaseio.com') ||
    url.includes('googleapis.com') ||
    url.includes('gstatic.com/firebasejs')
  ) {
    e.respondWith(fetch(e.request));
    return;
  }

  // Google Fonts → cache first (stable)
  if (url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com')) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(res => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
          return res;
        });
      })
    );
    return;
  }

  // App shell: network first, fallback to cache
  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res.ok && e.request.method === 'GET') {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(e.request).then(cached => {
        if (cached) return cached;
        if (e.request.mode === 'navigate') {
          return caches.match('/OliTest/index.html');
        }
      }))
  );
});

// Handle skip-waiting message from app
self.addEventListener('message', e => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});
