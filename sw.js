/* Service worker de Cyathea Field Twin · Campo.
   - Al instalarse guarda todo el build (precache.json) y el paquete de campo si existe.
   - Navegación y recursos propios: primero la caché, luego la red (la app abre sin señal).
   - El paquete de campo: primero la red, con respaldo en caché (se actualiza al reconectar).
   Los datos del usuario NO viven aquí: viven en IndexedDB. */
const VERSION = "cft-campo-v0.5.3";
const PAQUETE = "paquete/catalogo.json";

self.addEventListener("install", (ev) => {
  ev.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    const base = new URL("./", self.registration.scope);
    const lista = await fetch(new URL("precache.json", base), { cache: "no-store" }).then((r) => r.json());
    const urls = ["./", "index.html", "manifest.webmanifest", "icono-180.png", "icono-192.png", "icono-512.png", "icono-maskable-512.png",
      ...lista.archivos].map((u) => new URL(u, base).href);
    await cache.addAll([...new Set(urls)]);
    try { await cache.add(new URL(PAQUETE, base).href); } catch (_) { /* paquete aún no preparado */ }
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (ev) => {
  ev.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== VERSION) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (ev) => {
  const url = new URL(ev.request.url);
  if (ev.request.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname.endsWith(PAQUETE)) {
    ev.respondWith((async () => {
      const cache = await caches.open(VERSION);
      try {
        const r = await fetch(ev.request, { cache: "no-store" });
        if (r.ok) await cache.put(ev.request, r.clone());
        return r;
      } catch (_) {
        return (await cache.match(ev.request)) || new Response("{}", { status: 404 });
      }
    })());
    return;
  }
  // Navegación: primero la red (versión nueva si hay señal); sin señal, la copia guardada.
  if (ev.request.mode === "navigate") {
    ev.respondWith((async () => {
      const cache = await caches.open(VERSION);
      const idx = new URL("index.html", self.registration.scope).href;
      try {
        const r = await fetch(ev.request, { cache: "no-store" });
        if (r.ok) { await cache.put(idx, r.clone()); return r; }
        throw new Error(String(r.status));
      } catch (_) {
        return (await cache.match(idx)) || new Response("Sin conexión y app no preparada", { status: 503 });
      }
    })());
    return;
  }
  ev.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const req = ev.request;
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    try {
      const r = await fetch(ev.request);
      if (r.ok) await cache.put(ev.request, r.clone());
      return r;
    } catch (_) {
      return new Response("Sin conexión y recurso no guardado", { status: 503 });
    }
  })());
});
