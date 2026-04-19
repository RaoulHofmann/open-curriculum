// Dual-purpose: runs as a <script> to register itself as a service worker,
// and runs as the service worker to inject COOP/COEP headers.
// Required for sqlite-wasm OPFS on GitHub Pages.

if (typeof window === "undefined") {
  // --- Service worker context ---

  self.addEventListener("install", () => self.skipWaiting());
  self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

  async function handleFetch(request) {
    // Skip opaque/immutable responses
    if (request.cache === "only-if-cached" && request.mode !== "same-origin") {
      return;
    }

    if (
      request?.hostname === "huggingface.co" ||
      request?.hostname.includes("hf.co")
    ) {
      const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(request.url)}`;
      request = new Request(proxyUrl, {
        method: request.method,
        headers: request.headers,
        mode: "cors",
        credentials: "omit",
      });
    }

    // no-cors requests need credentials: omit to avoid COEP blocking them
    if (request.mode === "no-cors") {
      request = new Request(request.url, {
        cache: request.cache,
        credentials: "omit",
        headers: request.headers,
        integrity: request.integrity,
        destination: request.destination,
        keepalive: request.keepalive,
        method: request.method,
        mode: request.mode,
        redirect: request.redirect,
        referrer: request.referrer,
        referrerPolicy: request.referrerPolicy,
        signal: request.signal,
      });
    }

    const r = await fetch(request).catch((e) => console.error(e));
    if (!r || r.status === 0) return r;

    const headers = new Headers(r.headers);
    headers.set("Cross-Origin-Embedder-Policy", "credentialless");
    headers.set("Cross-Origin-Opener-Policy", "same-origin");
    headers.set("Access-Control-Allow-Origin", "*");

    return new Response(r.body, {
      status: r.status,
      statusText: r.statusText,
      headers,
    });
  }

  self.addEventListener("fetch", (e) => {
    e.respondWith(handleFetch(e.request));
  });
} else {
  // --- Browser context: register this script as the service worker ---

  (async function () {
    if (window.crossOriginIsolated !== false) return;

    const registration = await navigator.serviceWorker
      .register(document.currentScript.src, {
        scope: new URL(".", document.currentScript.src).pathname,
      })
      .catch((e) =>
        console.error("COOP/COEP Service Worker failed to register:", e),
      );

    if (registration) {
      // New version installed — reload so it takes effect
      registration.addEventListener("updatefound", () => {
        window.location.reload();
      });

      // Already active but not yet controlling this page — reload
      if (registration.active && !navigator.serviceWorker.controller) {
        window.location.reload();
      }
    }
  })();
}
