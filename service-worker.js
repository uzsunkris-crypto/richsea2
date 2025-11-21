self.addEventListener('install', e => { self.skipWaiting(); });
self.addEventListener('activate', e => { self.clients.claim(); });

self.addEventListener('fetch', event => {
  event.respondWith(fetch(event.request).catch(()=> caches.match(event.request)));
});

self.addEventListener('push', function(event) {
  let data = {};
  try { data = event.data.json(); } catch(e){ data = { title:'Search', body: event.data ? event.data.text() : 'Update' }; }
  const title = data.title || 'Search';
  const options = { body: data.body || '', icon: 'icons/icon-192.png' };
  event.waitUntil(self.registration.showNotification(title, options));
});
