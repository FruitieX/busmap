// Replaces the busmap service worker on busmap.netlify.app, which now only
// redirects to busmap.fruitiex.org. Installed clients would otherwise keep
// serving the cached app shell and never see the redirect.
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) await caches.delete(key);
    await self.registration.unregister();
    const windows = await self.clients.matchAll({ type: 'window' });
    for (const client of windows) {
      const { pathname, search, hash } = new URL(client.url);
      client.navigate(`https://busmap.fruitiex.org${pathname}${search}${hash}`);
    }
  })());
});
