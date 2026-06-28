const CACHE = 'novu-v1';

self.addEventListener('install', e => {
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(clients.claim());
});

// Notificaciones push (pantalla bloqueada)
self.addEventListener('push', e => {
  const d = e.data ? e.data.json() : {};
  e.waitUntil(self.registration.showNotification(d.title || 'NOVU', {
    body: d.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: d.tag || 'novu-msg',
    renotify: true,
    requireInteraction: false,
    vibrate: [200, 100, 200],
    data: d
  }));
});

// Al tocar la notificación → abrir/enfocar la app
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cls => {
      const novu = cls.find(c => c.url.includes('novu') || c.url.includes('github.io'));
      if (novu) return novu.focus();
      return clients.openWindow(self.location.origin);
    })
  );
});

// Mensajes desde la app (para notificar con pantalla bloqueada sin push server)
self.addEventListener('message', e => {
  if (e.data?.type === 'NOTIFY') {
    self.registration.showNotification(e.data.title || 'NOVU', {
      body: e.data.body || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: e.data.tag || 'novu-msg',
      renotify: true,
      requireInteraction: false,
      vibrate: [200, 100, 200]
    });
  }
});
