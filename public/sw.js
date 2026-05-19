const CACHE_NAME = 'mygameon-v2'

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(['/', '/search', '/revoke', '/check'])
    })
  )
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
  // Hanya cache GET request, skip API calls
  if (
    event.request.method !== 'GET' ||
    event.request.url.includes('/api/')
  ) {
    return
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Update cache dengan response terbaru
        const responseClone = response.clone()
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseClone)
        })
        return response
      })
      .catch(() => {
        return caches.match(event.request).then((cached) => {
          return cached || new Response('Offline', { status: 503, statusText: 'Service Unavailable' })
        })
      })
  )
})