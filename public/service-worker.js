// Service worker that injects COOP/COEP headers to enable SharedArrayBuffer.
// Required for sqlite-wasm OPFS on GitHub Pages (which doesn't support custom headers).

const SW_VERSION = 1;

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener("fetch", (event) => {
  // Don't intercept this service worker's own response — avoids bootstrapping deadlock
  // since GitHub Pages won't send COEP on the initial SW script response.
  if (event.request.url.endsWith("/service-worker.js")) {
    return;
  }

  event.respondWith(
    fetch(event.request).then((response) => {
      const headers = new Headers(response.headers);
      headers.set("Cross-Origin-Opener-Policy", "same-origin");
      headers.set("Cross-Origin-Embedder-Policy", "require-corp");

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    }),
  );
});
