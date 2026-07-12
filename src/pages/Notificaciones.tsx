import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { subscribeToPush, isIOSStandaloneRequired } from '../hooks/usePushNotifications'
import { Bell, BellRing, Loader2, AlertTriangle } from 'lucide-react'

interface NotificationRow {
  id: string
  title: string
  body: string | null
  type: string | null
  read: boolean
  created_at: string
}

export default function Notificaciones() {
  const profile = useAuthStore((s) => s.profile)
  const [items, setItems] = useState<NotificationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [enabling, setEnabling] = useState(false)
  const [pushMessage, setPushMessage] = useState<string | null>(null)

  async function loadNotifications() {
    setLoading(true)
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)
    setItems((data as NotificationRow[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    loadNotifications()
  }, [])

  async function handleEnable() {
    setEnabling(true)
    setPushMessage(null)
    const { error } = await subscribeToPush()
    setEnabling(false)
    setPushMessage(error ?? '¡Notificaciones activadas en este dispositivo!')
  }

  async function markAllRead() {
    if (!profile) return
    await supabase.from('notifications').update({ read: true }).eq('user_id', profile.id)
    loadNotifications()
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-800">Notificaciones</h1>
        {items.some((i) => !i.read) && (
          <button onClick={markAllRead} className="text-xs text-redisteca-blue font-medium">
            Marcar todas leídas
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
        <div className="flex items-center gap-2">
          <BellRing className="w-5 h-5 text-redisteca-blue" />
          <p className="font-medium text-gray-800 text-sm">Avisos en tu celular</p>
        </div>
        <p className="text-xs text-gray-500">
          Actívalas para recibir avisos de cuentas por vencer, pedidos listos para entregar y
          stock bajo, directo en tu teléfono.
        </p>

        {isIOSStandaloneRequired() && (
          <div className="flex items-start gap-2 bg-amber-50 text-amber-700 rounded-lg p-2.5 text-xs">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              En iPhone, primero agrega esta app a tu pantalla de inicio (botón compartir →
              "Agregar a inicio") para poder activar las notificaciones.
            </span>
          </div>
        )}

        <button
          onClick={handleEnable}
          disabled={enabling}
          className="w-full flex items-center justify-center gap-2 bg-redisteca-blue text-white rounded-lg py-2.5 text-sm font-medium disabled:opacity-60"
        >
          {enabling && <Loader2 className="w-4 h-4 animate-spin" />}
          Activar notificaciones en este dispositivo
        </button>

        {pushMessage && <p className="text-xs text-gray-600">{pushMessage}</p>}
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="w-6 h-6 animate-spin text-redisteca-blue" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-10">
          <Bell className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-gray-400 text-sm">No tienes notificaciones todavía.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((n) => (
            <div
              key={n.id}
              className={`rounded-xl border p-3 ${
                n.read ? 'bg-white border-gray-200' : 'bg-blue-50/50 border-blue-100'
              }`}
            >
              <p className="font-medium text-gray-800 text-sm">{n.title}</p>
              {n.body && <p className="text-xs text-gray-500 mt-0.5">{n.body}</p>}
              <p className="text-[11px] text-gray-400 mt-1">
                {new Date(n.created_at).toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
