// Havn service worker: makes the app installable and open instantly, and shows the last page when offline.
// Job data always comes live from the server; only the app itself is cached.
const VERSION = "havn-v6";
const SHELL = ["./", "./index.html", "./config.js?v=3", "./supabase-2.118.0.js", "./havn-backend.js?v=5", "./pay-core.js?v=7", "./manifest.webmanifest", "./icons/icon-192.png", "./offline.html"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", (e) => {
  const req = e.request; const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin) return; // never touch API calls or other sites
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).then((r) => { const copy = r.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); return r; })
      .catch(() => caches.match(req).then((r) => r || caches.match("./index.html")).then((r) => r || caches.match("./offline.html"))));
    return;
  }
  e.respondWith(caches.match(req).then((hit) => {
    const net = fetch(req).then((r) => { if (r.ok) { const copy = r.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); } return r; }).catch(() => hit);
    return hit || net;
  }));
});
