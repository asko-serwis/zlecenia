/* ============================================================
   ASKO Zlecenia — service worker (start bez internetu)

   Strategia:
   - index.html: najpierw sieć (żeby aktualizacje przychodziły od razu),
     a bez zasięgu — kopia z pamięci podręcznej. Aplikacja startuje
     na hali czy podziemnym parkingu; lokalna baza i tak działa offline.
   - pliki stałe (skaner, konfiguracje, ikony): najpierw pamięć podręczna.
   - chmura, Inter Cars, biblioteki z CDN: bez ingerencji (przechodzą obok).

   Wgranie: plik sw.js do repozytorium obok index.html.
   ============================================================ */
const CACHE = "asko-sw-v1";
const PLIKI = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "firebase-config.js",
  "intercars-config.js",
  "supabase-config.js",
  "zxing-reader.js",
  "zxing_reader.wasm",
  "apple-touch-icon.png",
  "icon-512.png"
];

self.addEventListener("install", ev => {
  ev.waitUntil(
    caches.open(CACHE).then(async c => {
      for (const p of PLIKI) {
        try { await c.add(p); } catch (e) { /* brakujący plik nie blokuje reszty */ }
      }
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", ev => {
  ev.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", ev => {
  const req = ev.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; /* CDN, Firebase, IC — bez zmian */

  /* wejście do aplikacji: sieć z zapasem w pamięci podręcznej */
  if (req.mode === "navigate" || url.pathname.endsWith("/index.html")) {
    ev.respondWith(
      fetch(req).then(r => {
        const kopia = r.clone();
        caches.open(CACHE).then(c => c.put("index.html", kopia));
        return r;
      }).catch(() => caches.match("index.html"))
    );
    return;
  }

  /* pliki stałe: pamięć podręczna, dogrywka z sieci gdy brak */
  ev.respondWith(
    caches.match(req, { ignoreSearch: true }).then(r =>
      r || fetch(req).then(rr => {
        if (rr && rr.ok) {
          const kopia = rr.clone();
          caches.open(CACHE).then(c => c.put(req, kopia));
        }
        return rr;
      })
    )
  );
});
