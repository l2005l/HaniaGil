/* hania גיל – offline cache and background birthday check */
const VERSION = 'hania-gil-v2';
const SHELL = ['./', 'index.html', 'cal.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];
importScripts('cal.js'); // defines self.Cal

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('hania-gil-v') && k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

// App files: network first, cache as fallback (so updates arrive quickly). Fonts: cache first.
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname.includes('fonts.g')) {
    e.respondWith(caches.open(VERSION).then(async c => (await c.match(req)) || fetch(req).then(r => { c.put(req, r.clone()); return r; })));
    return;
  }
  if (url.origin !== location.origin) return;
  e.respondWith(fetch(req).then(r => { if (r.ok) caches.open(VERSION).then(c => c.put(req, r.clone())); return r; })
    .catch(() => caches.match(req).then(r => r || caches.match('index.html'))));
});

// Background check (Chrome on Android, installed app)
async function checkBirthdays() {
  const data = await caches.open('hania-gil-data');
  const res = await data.match('people.json'); if (!res) return;
  const people = await res.json();
  const T = self.Cal.todayRD();
  const last = await data.match('last-notified');
  if (last && (await last.text()) === String(T)) return;
  await data.put('last-notified', new Response(String(T)));
  const due = self.Cal.dueReminders(people, T);
  if (!due.length) return;
  await self.registration.showNotification('תזכורת יום הולדת 🎂', {
    body: due.map(self.Cal.describe).join('\n'), icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', tag: 'bday-' + T, lang: 'he', dir: 'rtl'
  });
}
self.addEventListener('periodicsync', e => { if (e.tag === 'bday-check') e.waitUntil(checkBirthdays()); });

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) if ('focus' in c) return c.focus();
    return self.clients.openWindow('./#family');
  }));
});
