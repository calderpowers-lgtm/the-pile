/* The Pile service worker. Network-first, with a cache so a refresh can still open the app shell.
   The script is served from the app root, including a GitHub Pages base path. */
const VERSION = "pile-v5";
const BASE = new URL("./", self.location).pathname;

function shell(path) {
  return `${BASE}${path}`;
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) =>
        cache.addAll([
          shell(""),
          shell("sheet/"),
          shell("draw/"),
          shell("history/"),
          shell("history/entry/"),
          shell("journal/"),
          shell("settings/"),
          shell("manifest.webmanifest"),
        ]),
      )
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (!url.pathname.startsWith(BASE)) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        const copy = response.clone();
        caches
          .open(VERSION)
          .then((cache) => cache.put(request, copy))
          .catch(() => {});
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        const home = await caches.match(shell(""));
        if (home) return home;
        return new Response("The Pile is offline.", {
          status: 503,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
      }),
  );
});
