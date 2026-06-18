// NOVU Service Worker © 2026 Hadrion · Adriana Soba
const CACHE_NAME = 'novu-v3';
const OFFLINE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './android-chrome-192x192.png',
];

// ── Instalación: cachear recursos estáticos ──
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(OFFLINE_ASSETS).catch(() => {}))
  );
});

// ── Activación: limpiar cachés viejos ──
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: servir desde caché con fallback a red ──
self.addEventListener('fetch', event => {
  // No interceptar peticiones a Supabase ni a APIs externas
  if (event.request.url.includes('supabase.co') ||
      event.request.url.includes('api.anthropic.com') ||
      event.request.url.includes('tenor.googleapis.com')) {
    return;
  }
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request))
  );
});

// ── Notificaciones push (si se implementa Web Push en el futuro) ──
self.addEventListener('push', event => {
  if (!event.data) return;
  let data = {};
  try { data = event.data.json(); } catch(e) { data = { title: 'NOVU', body: event.data.text() }; }
  event.waitUntil(
    self.registration.showNotification(data.title || 'NOVU', {
      body: data.body || 'Nuevo mensaje',
      icon: './android-chrome-192x192.png',
      badge: './android-chrome-192x192.png',
      tag: 'novu-msg',
      renotify: true,
      vibrate: [100, 50, 100],
      data: data
    })
  );
});

// ── Click en notificación: abrir/enfocar la app ──
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      // Si ya hay una ventana abierta, enfocarla
      for (const client of clients) {
        if ('focus' in client) {
          client.focus();
          // Notificar a la app que fue un click de notificación
          client.postMessage({ type: 'NOTIFICATION_CLICK', data: event.notification.data });
          return;
        }
      }
      // Si no hay ventana, abrir una nueva
      if (self.clients.openWindow) {
        return self.clients.openWindow('./');
      }
    })
  );
});
