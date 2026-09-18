/* Cache only this public, static fallback. Never store pages, API responses or credentials. */
const OFFLINE_CACHE = "tabletalk-offline-v2";
const OFFLINE_URL = "/offline.html";
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(OFFLINE_CACHE);
      await cache.add(new Request(OFFLINE_URL, { cache: "reload" }));
      await self.skipWaiting();
    })(),
  );
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter(
            (key) =>
              key.startsWith("tabletalk-offline-") && key !== OFFLINE_CACHE,
          )
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (
    event.request.method !== "GET" ||
    event.request.mode !== "navigate" ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith("/api/")
  )
    return;
  event.respondWith(
    (async () => {
      try {
        return await fetch(event.request);
      } catch {
        const cache = await caches.open(OFFLINE_CACHE);
        const offline = await cache.match(OFFLINE_URL);
        // Hosting canonicalizes .html URLs. A redirected cached response cannot
        // satisfy a navigation with redirect mode "manual"; return its HTML afresh.
        return (
          (offline &&
            new Response(offline.body, {
              headers: { "Content-Type": "text/html; charset=utf-8" },
            })) ||
          new Response("You’re offline. Reconnect and reload Tabletalk.", {
            status: 503,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          })
        );
      }
    })(),
  );
});
