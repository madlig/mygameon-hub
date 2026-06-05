const CACHE_NAME = 'mygameon-v3'

self.addEventListener('install', () => {
  // Jangan precache halaman ter-autentikasi (dashboard, search, dll) —
  // bisa menyimpan data sensitif/basi di perangkat. Cache diisi runtime
  // hanya untuk aset statis.
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const { request } = event

  // Hanya tangani GET; lewati API.
  if (request.method !== 'GET' || request.url.includes('/api/')) return

  // Navigasi (dokumen HTML) → network-only. Jangan simpan halaman authed
  // ke cache, supaya tidak ada data basi yang tampil offline.
  if (request.mode === 'navigate' || request.destination === 'document') {
    return
  }

  // Aset statis (script, style, font, gambar) → stale-while-revalidate.
  event.respondWith(
    fetch(request)
      .then((response) => {
        const clone = response.clone()
        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
        return response
      })
      .catch(() => caches.match(request).then((cached) => cached || Response.error()))
  )
})
