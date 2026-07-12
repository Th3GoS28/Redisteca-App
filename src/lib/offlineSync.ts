import { supabase } from './supabase'
import { flushQueue, getQueueCount } from './offlineQueue'

async function syncVisit(payload: any) {
  const { error } = await supabase.from('visits').insert(payload)
  return { error: error?.message ?? null }
}

async function syncQuote(payload: any) {
  const { items, ...quoteFields } = payload
  const { data: quote, error } = await supabase
    .from('quotes')
    .insert(quoteFields)
    .select()
    .single()
  if (error || !quote) return { error: error?.message ?? 'No se pudo crear la cotización.' }

  const { error: itemsError } = await supabase.from('quote_items').insert(
    items.map((it: any) => ({ ...it, quote_id: quote.id }))
  )
  return { error: itemsError?.message ?? null }
}

let syncing = false

export async function syncNow(): Promise<{ synced: number; failed: number }> {
  if (syncing || !navigator.onLine) return { synced: 0, failed: getQueueCount() }
  syncing = true
  try {
    return await flushQueue({ visit: syncVisit, quote: syncQuote })
  } finally {
    syncing = false
  }
}

// Sincroniza sola: al cargar la app y cada vez que vuelve la señal.
export function initOfflineSync() {
  syncNow()
  window.addEventListener('online', () => {
    syncNow()
  })
  // Reintento periódico por si "online" no dispara bien en algunos celulares
  setInterval(() => {
    if (navigator.onLine) syncNow()
  }, 60000)
}
