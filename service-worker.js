const CACHE_NAME = "gr-calculator-v2";
const APP_ASSETS = [
  "./",
  "./index.html",
  "./css/styles.css",
  "./js/data.js",
  "./js/core.js",
  "./js/workflow.js",
  "./js/app.js",
  "./manifest.webmanifest",
  "./icons/gr-calculator.svg",
  "./icons/gr-calculator-192.png",
  "./icons/gr-calculator-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  if(event.request.method !== "GET") return;
  const requestUrl = new URL(event.request.url);
  if(requestUrl.origin !== self.location.origin) return;
  event.respondWith(
    fetch(event.request)
      .then(response => {
        if(response.ok){
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => caches.match(event.request).then(cached => {
        if(cached) return cached;
        if(event.request.mode === "navigate") return caches.match("./index.html");
        return Response.error();
      }))
  );
});
