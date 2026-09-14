'use strict';
// NOVU Service Worker v3 — PWA offline + notificaciones + Push API
const CACHE_NAME = 'novu-sw-v3';
const APP_SHELL = ['./', './index.html', './manifest.json', './android-chrome-192x192.png', './android-chrome-512x512.png'];

self.addEventListener('install', e => {
  console.log('[SW] instalando…');
  e.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  console.log('[SW] activado — controlando clientes');
  e.waitUntil(Promise.all([
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))),
    self.clients.claim()
  ]));
});

// Chrome/Android exige que el Service Worker tenga un manejador de 'fetch'
// para considerar la PWA "instalable de verdad" (con permiso de
// notificaciones incluido). Sin esto, "Agregar a pantalla de inicio" crea
// solo un acceso directo al navegador, no una app instalada real — por eso
// el celular no la reconocía como app.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  if (e.request.mode === 'navigate') {
    e.respondWith(fetch(e.request)
      .then(response => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put('./index.html', copy));
        return response;
      })
      .catch(() => caches.match('./index.html')));
    return;
  }
  e.respondWith(caches.match(e.request).then(cached => cached || fetch(e.request)));
});

// Mensajes desde la página principal (postMessage)
self.addEventListener('message', e => {
  const d = e.data;
  if (!d) return;

  if (d.type === 'NOTIFY') {
    e.waitUntil(
      self.registration.showNotification(d.title || 'NOVU', {
        body: d.body || '',
        tag: d.tag || 'novu',
        renotify: true,
        requireInteraction: !!d.requireInteraction,
        icon: d.icon || './android-chrome-192x192.png',
        badge: d.badge || './android-chrome-192x192.png',
        vibrate: d.requireInteraction ? [400,100,400,100,800] : [200,50,200],
        data: d.data || {},
        actions: d.requireInteraction
          ? [{ action: 'accept', title: '✅ Atender' }, { action: 'reject', title: '❌ Rechazar' }]
          : [{ action: 'open', title: '💬 Ver' }]
      })
    );
  }

  if (d.type === 'PING') {
    e.source?.postMessage({ type: 'PONG', ts: Date.now() });
  }
});

// Push entrante desde servidor (requiere backend VAPID)
self.addEventListener('push', e => {
  if (!e.data) return;
  let payload = {};
  try { payload = e.data.json(); } catch { payload = { title: 'NOVU', body: e.data.text() }; }

  e.waitUntil(
    self.registration.showNotification(payload.title || 'NOVU', {
      body: payload.body || '',
      tag: payload.tag || 'novu-push',
      icon: './android-chrome-192x192.png',
      badge: './android-chrome-192x192.png',
      renotify: true,
      requireInteraction: !!payload.requireInteraction,
      vibrate: payload.requireInteraction ? [500,200,500,200,1000] : [200,100,200],
      data: payload.data || {},
      actions: payload.actions || []
    })
  );
});

// Clic en notificación
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const tag = e.notification.tag || '';
  const data = e.notification.data || {};
  const action = e.action;

  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      const existing = clients.find(c => c.url && c.visibilityState !== 'hidden');
      if (existing) {
        existing.focus();
        if (tag.startsWith('novu-msg-') || data.partnerId) {
          existing.postMessage({ type: 'OPEN_CHAT', partnerId: data.partnerId || tag.replace('novu-msg-','') });
        }
        if (action === 'accept' && data.callFrom) {
          existing.postMessage({ type: 'ACCEPT_CALL', from: data.callFrom });
        }
        if (action === 'reject' && data.callFrom) {
          existing.postMessage({ type: 'REJECT_CALL', from: data.callFrom });
        }
      } else {
        self.clients.openWindow('./');
      }
    })
  );
});

// Cierre de notificación
self.addEventListener('notificationclose', e => {
  console.log('[SW] notificación cerrada:', e.notification.tag);
});
