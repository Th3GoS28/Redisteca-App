import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)))
}

// Detecta si estamos en un iPhone que NO fue agregado a pantalla de inicio,
// caso en el que iOS no permite notificaciones push (limitación de Apple).
export function isIOSStandaloneRequired() {
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent)
  const isStandalone =
    ('standalone' in window.navigator && (window.navigator as any).standalone) ||
    window.matchMedia('(display-mode: standalone)').matches
  return isIOS && !isStandalone
}

export async function subscribeToPush() {
  if (isIOSStandaloneRequired()) {
    return {
      error:
        'En iPhone, primero debes agregar Redisteca a tu pantalla de inicio (compartir → "Agregar a inicio") para poder activar notificaciones.'
    }
  }

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    return { error: 'Permiso de notificaciones denegado.' }
  }

  const registration = await navigator.serviceWorker.ready
  const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
  })

  const profile = useAuthStore.getState().profile
  if (!profile) return { error: 'No hay sesión activa.' }

  const json = subscription.toJSON()
  const deviceType = /iphone|ipad|ipod/i.test(navigator.userAgent)
    ? 'ios'
    : /android/i.test(navigator.userAgent)
      ? 'android'
      : 'desktop'

  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: profile.id,
      endpoint: json.endpoint!,
      p256dh: json.keys!.p256dh,
      auth: json.keys!.auth,
      device_type: deviceType
    },
    { onConflict: 'endpoint' }
  )

  return { error: error?.message ?? null }
}
