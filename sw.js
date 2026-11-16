// Service worker: makes the site work offline and repeat visits faster.
// Strategy: network first for everything on this site (so a new deploy shows up straight away),
// falling back to the last cached copy when the network is slow or offline.
// Requests to other sites (GitHub API, Discord, Steam) are left alone.
const CACHE = "zb57-v53";
const CORE = [
  "/", "/styles.css", "/script.js", "/live.js",
  "/blog/", "/blog/post.html", "/blog/blog.css", "/blog/blog.js", "/blog/graph.js", "/blog/posts/index.json",
  "/realm/", "/realm/realm.css", "/realm/realm.js", "/realm/config.js", "/realm/arena.js", "/realm/bg-realm.js",
  "/assets/fonts/site.css", "/assets/fonts/realm.css", "/assets/img/voidsorrow-256.png", "/assets/img/voidsorrow-256.png",
  "/assets/img/favicon-32.png", "/favicon.ico", "/assets/js/konami.js", "/assets/js/konami.css", "/assets/js/depth3d.js", "/assets/js/bg-space.js", "/assets/js/depth3d.css",
  "/work/", "/work/work.css", "/work/work.js", "/work/index.json", "/assets/fonts/geist-normal.woff2",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).catch(() => {}).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    // Give the network a few seconds; on a dead connection use the cache straight away.
    const net = fetch(req).then((res) => { if (res.ok && res.type === "basic") cache.put(req, res.clone()); return res; });
    const timeout = new Promise((r) => setTimeout(r, req.mode === "navigate" ? 4000 : 6000));
    try {
      const res = await Promise.race([net, timeout.then(() => null)]);
      if (res) return res;
    } catch (err) { /* offline: fall through to the cache */ }
    const hit = await cache.match(req, { ignoreSearch: url.pathname.endsWith("post.html") });
    if (hit) return hit;
    try { return await net; } catch (err) {
      if (req.mode === "navigate") return new Response('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline</title><body style="font:16px system-ui;padding:40px;background:#0c0c0e;color:#e4e4e7"><h1>You are offline</h1><p>This page has not been saved yet. Reconnect and try again.</p></body>', { headers: { "Content-Type": "text/html" } });
      return Response.error();
    }
  })());
});
