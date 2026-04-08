// Travel Manager service worker.
//
// Scope: offline-first cache for static shell + push notification handling.
// Needed for Apple Guideline 4.2 (custom offline screen + push support).
//
// Strategy:
//   - Precache: offline fallback page, manifest, app icon.
//   - Runtime: network-first pass-through; if the network fails for a GET,
//     serve a cached copy if one exists, else the offline fallback page.
//   - /api/* requests are NEVER intercepted. API calls should fail fast when
//     offline so the UI can show its own error state, not a cached stale
//     response that could mislead the user.

const CACHE = 'travel-manager-v1';
const OFFLINE_URL = '/offline.html';
const PRECACHE = ['/offline.html', '/manifest.json', '/icons/icon-192.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  // Don't intercept API calls — they need to fail fast when offline so the UI
  // can show a meaningful error instead of stale cached data.
  const url = new URL(request.url);
  if (url.pathname.startsWith('/api/')) return;

  event.respondWith(
    fetch(request).catch(() =>
      caches.match(request).then((cached) => cached || caches.match(OFFLINE_URL))
    )
  );
});

// ─── Push notifications ──────────────────────────────────────────────
// Apple Guideline 4.2 requires this be present (and wired on the native side)
// to pass review. Real APNs delivery is set up at the Capacitor layer — this
// file covers the Web Push API path for browsers + is also what Capacitor
// routes foreground/background notifications through on some plugin versions.

self.addEventListener('push', (event) => {
  if (!event.data) return;
  let data = {};
  try {
    data = event.data.json();
  } catch {
    data = { title: 'Travel Manager', body: event.data.text() };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Travel Manager', {
      body: data.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: data.url ? { url: data.url } : undefined,
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clientList) => {
      const existing = clientList.find((c) => c.url.includes(targetUrl));
      if (existing) return existing.focus();
      return self.clients.openWindow(targetUrl);
    })
  );
});
