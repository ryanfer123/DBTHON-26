const SHELL = "second-table-public-shell-v1";
const OFFLINE = "/offline.html";
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) =>
        cache.addAll([
          OFFLINE,
          "/manifest.webmanifest",
          "/icons/icon-192.png",
          "/icons/icon-512.png",
        ]),
      ),
  );
  self.skipWaiting();
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) =>
                key.startsWith("second-table-public-shell-") && key !== SHELL,
            )
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});
self.addEventListener("fetch", (event) => {
  const request = event.request,
    url = new URL(request.url);
  // The API, writes, photos and contacts always bypass the cache.
  if (
    request.method !== "GET" ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith("/api/")
  )
    return;
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(
        async () => (await caches.match(OFFLINE)) || Response.error(),
      ),
    );
    return;
  }
  if (
    /^\/assets\/[a-zA-Z0-9_.-]+\.(js|css|woff2)$/.test(url.pathname) ||
    url.pathname.startsWith("/icons/")
  ) {
    event.respondWith(
      caches.open(SHELL).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok && response.type === "basic") {
          await cache.put(request, response.clone());
          const keys = await cache.keys();
          const assets = keys.filter((key) =>
            new URL(key.url).pathname.startsWith("/assets/"),
          );
          for (const key of assets.slice(0, Math.max(0, assets.length - 30)))
            await cache.delete(key);
        }
        return response;
      }),
    );
  }
});
