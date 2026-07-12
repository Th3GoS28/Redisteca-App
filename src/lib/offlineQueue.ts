// Motor de "modo offline" para las acciones más importantes en campo:
// crear visitas y crear cotizaciones. Si no hay señal (o la escritura
// falla por conexión), la acción se guarda en el celular y se reintenta
// sola en cuanto vuelva el internet — sin que el usuario pierda nada.

const QUEUE_KEY = 'redisteca_offline_queue'

export interface QueuedAction {
  id: string
  type: 'visit' | 'quote'
  payload: any
  createdAt: number
}

function readQueue(): QueuedAction[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function writeQueue(queue: QueuedAction[]) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue))
}

export function getQueueCount(): number {
  return readQueue().length
}

export function enqueueAction(type: QueuedAction['type'], payload: any) {
  const queue = readQueue()
  queue.push({ id: crypto.randomUUID(), type, payload, createdAt: Date.now() })
  writeQueue(queue)
}

// Intenta subir todo lo pendiente. Se llama automáticamente al recuperar
// señal, y también se puede llamar manualmente (ej. botón "Sincronizar").
export async function flushQueue(
  handlers: Record<QueuedAction['type'], (payload: any) => Promise<{ error: string | null }>>
): Promise<{ synced: number; failed: number }> {
  const queue = readQueue()
  if (queue.length === 0) return { synced: 0, failed: 0 }

  const remaining: QueuedAction[] = []
  let synced = 0

  for (const action of queue) {
    const handler = handlers[action.type]
    if (!handler) {
      remaining.push(action)
      continue
    }
    const { error } = await handler(action.payload)
    if (error) {
      remaining.push(action)
    } else {
      synced++
    }
  }

  writeQueue(remaining)
  return { synced, failed: remaining.length }
}

export function isOnline(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine
}
