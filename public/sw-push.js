// Service worker dedicado a notificaciones push.
// Funciona en Android desde cualquier navegador, y en iPhone SOLO si
// el usuario agregó la app a su pantalla de inicio (iOS 16.4+).

self.addEventListener('push', (event) => {
  if (!event.data) return
  const payload = event.data.json()

  const title = payload.title || 'Redisteca'
  const options = {
    body: payload.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: {
      url: payload.url || '/'
    },
    vibrate: [100, 50, 100]
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clientsArr) => {
      const existing = clientsArr.find((c) => c.url.includes(self.location.origin))
      if (existing) {
        existing.focus()
        existing.navigate(url)
      } else {
        self.clients.openWindow(url)
      }
    })
  )
})
