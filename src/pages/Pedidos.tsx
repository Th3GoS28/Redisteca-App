import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { Loader2, Plus, X, Trash2, Truck } from 'lucide-react'
import SignaturePad from '../components/SignaturePad'

interface Client {
  id: string
  name: string
}
interface Product {
  id: string
  name: string
  sale_price: number
  unit: string
}
interface QuoteOption {
  id: string
  quote_number: string
  client_id: string
  total: number
  client: { name: string } | null
}
interface OrderRow {
  id: string
  order_number: string
  status: string
  total: number
  delivery_date: string | null
  created_at: string
  client: { name: string } | null
}
interface LineItem {
  product_id: string | null
  quantity: number
  unit_price: number
}

const STATUS_FLOW = ['pendiente', 'procesando', 'listo', 'entregado']
const STATUS_LABELS: Record<string, string> = {
  pendiente: 'Pendiente',
  procesando: 'Procesando',
  listo: 'Listo para entregar',
  entregado: 'Entregado',
  cancelado: 'Cancelado'
}
const STATUS_TONES: Record<string, string> = {
  pendiente: 'bg-gray-100 text-gray-600',
  procesando: 'bg-blue-50 text-blue-700',
  listo: 'bg-amber-50 text-amber-700',
  entregado: 'bg-green-50 text-green-700',
  cancelado: 'bg-red-50 text-red-700'
}

export default function Pedidos() {
  const can = useAuthStore((s) => s.can)
  const canCreate = can('orders', 'create')
  const canEdit = can('orders', 'edit')

  const [orders, setOrders] = useState<OrderRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [signingOrder, setSigningOrder] = useState<OrderRow | null>(null)
  const [detailOrder, setDetailOrder] = useState<OrderRow | null>(null)

  async function loadOrders() {
    setLoading(true)
    const { data } = await supabase
      .from('orders')
      .select('*, client:clients(name)')
      .order('created_at', { ascending: false })
    setOrders((data as any) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    loadOrders()
  }, [])

  async function advanceStatus(order: OrderRow) {
    const currentIndex = STATUS_FLOW.indexOf(order.status)
    const nextStatus = STATUS_FLOW[currentIndex + 1]

    if (nextStatus === 'entregado') {
      setSigningOrder(order)
      return
    }
    setBusyId(order.id)
    await supabase.from('orders').update({ status: nextStatus }).eq('id', order.id)
    await loadOrders()
    setBusyId(null)
  }

  async function confirmDelivery(signatureDataUrl: string, receivedBy: string) {
    if (!signingOrder) return
    setBusyId(signingOrder.id)
    const { error } = await supabase.rpc('deliver_order', {
      p_order_id: signingOrder.id,
      p_signature: signatureDataUrl,
      p_received_by: receivedBy || null
    })
    if (error) alert(error.message)
    setSigningOrder(null)
    await loadOrders()
    setBusyId(null)
  }

  async function cancelOrder(order: OrderRow) {
    if (!confirm(`¿Cancelar el pedido ${order.order_number}?`)) return
    setBusyId(order.id)
    await supabase.from('orders').update({ status: 'cancelado' }).eq('id', order.id)
    await loadOrders()
    setBusyId(null)
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-800">Pedidos</h1>
        {canCreate && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1 bg-redisteca-blue text-white text-sm rounded-lg px-3 py-2"
          >
            <Plus className="w-4 h-4" />
            Nuevo
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="w-6 h-6 animate-spin text-redisteca-blue" />
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-10">
          <Truck className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-gray-400 text-sm">Aún no hay pedidos.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {orders.map((o) => {
            const nextStatus = STATUS_FLOW[STATUS_FLOW.indexOf(o.status) + 1]
            const isFinal = o.status === 'entregado' || o.status === 'cancelado'
            return (
              <div
                key={o.id}
                onClick={() => setDetailOrder(o)}
                className="bg-white rounded-xl border border-gray-200 p-3 cursor-pointer active:bg-gray-50"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-gray-800">{o.order_number}</p>
                    <p className="text-xs text-gray-500">{o.client?.name ?? 'Sin cliente'}</p>
                  </div>
                  <span
                    className={`text-xs rounded-full px-2 py-1 shrink-0 ${STATUS_TONES[o.status]}`}
                  >
                    {STATUS_LABELS[o.status] ?? o.status}
                  </span>
                </div>
                <p className="text-sm text-gray-700 mt-1 font-medium">${o.total.toFixed(2)}</p>

                {canEdit && !isFinal && (
                  <div className="flex gap-2 mt-2" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => advanceStatus(o)}
                      disabled={busyId === o.id}
                      className="flex-1 text-xs bg-redisteca-blue text-white rounded-lg py-2 disabled:opacity-60 flex items-center justify-center gap-1"
                    >
                      {busyId === o.id && <Loader2 className="w-3 h-3 animate-spin" />}
                      Marcar como {STATUS_LABELS[nextStatus]?.toLowerCase()}
                    </button>
                    <button
                      onClick={() => cancelOrder(o)}
                      disabled={busyId === o.id}
                      className="text-xs bg-gray-100 text-gray-600 rounded-lg px-3"
                    >
                      Cancelar
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {showForm && (
        <NewOrderModal
          onClose={() => setShowForm(false)}
          onCreated={() => {
            setShowForm(false)
            loadOrders()
          }}
        />
      )}

      {signingOrder && (
        <SignaturePad
          onClose={() => setSigningOrder(null)}
          onConfirm={confirmDelivery}
        />
      )}

      {detailOrder && (
        <OrderDetailModal order={detailOrder} onClose={() => setDetailOrder(null)} />
      )}
    </div>
  )
}

function NewOrderModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const profile = useAuthStore((s) => s.profile)
  const [mode, setMode] = useState<'quote' | 'direct'>('quote')
  const [approvedQuotes, setApprovedQuotes] = useState<QuoteOption[]>([])
  const [quoteId, setQuoteId] = useState('')
  const [clients, setClients] = useState<Client[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [clientId, setClientId] = useState('')
  const [deliveryDate, setDeliveryDate] = useState('')
  const [items, setItems] = useState<LineItem[]>([{ product_id: null, quantity: 1, unit_price: 0 }])
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    async function loadOptions() {
      const [{ data: quotesData }, { data: clientsData }, { data: productsData }] =
        await Promise.all([
          supabase
            .from('quotes')
            .select('id, quote_number, client_id, total, client:clients(name)')
            .eq('status', 'aprobada'),
          supabase.from('clients').select('id, name').eq('active', true).order('name'),
          supabase.from('products').select('id, name, sale_price, unit').eq('active', true).order('name')
        ])
      setApprovedQuotes((quotesData as any) ?? [])
      setClients((clientsData as Client[]) ?? [])
      setProducts((productsData as Product[]) ?? [])
    }
    loadOptions()
  }, [])

  const total = useMemo(
    () => items.reduce((sum, it) => sum + it.quantity * it.unit_price, 0),
    [items]
  )

  function updateItem(index: number, patch: Partial<LineItem>) {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)))
  }
  function addItem() {
    setItems((prev) => [...prev, { product_id: null, quantity: 1, unit_price: 0 }])
  }
  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    const orderNumber = `PED-${Date.now().toString().slice(-8)}`

    if (mode === 'quote') {
      if (!quoteId) {
        setError('Selecciona una cotización aprobada.')
        setSubmitting(false)
        return
      }
      const quote = approvedQuotes.find((q) => q.id === quoteId)
      const { data: quoteItems } = await supabase
        .from('quote_items')
        .select('*')
        .eq('quote_id', quoteId)

      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          order_number: orderNumber,
          quote_id: quoteId,
          client_id: quote?.client_id,
          status: 'pendiente',
          delivery_date: deliveryDate || null,
          total: quote?.total ?? 0,
          created_by: profile?.id
        })
        .select()
        .single()

      if (orderError || !order) {
        setError(orderError?.message ?? 'No se pudo crear el pedido.')
        setSubmitting(false)
        return
      }

      await supabase.from('order_items').insert(
        (quoteItems ?? []).map((qi) => ({
          order_id: order.id,
          product_id: qi.product_id,
          quantity: qi.quantity,
          unit_price: qi.unit_price,
          subtotal: qi.subtotal
        }))
      )
      await supabase.from('quotes').update({ status: 'convertida' }).eq('id', quoteId)
    } else {
      if (!clientId) {
        setError('Selecciona un cliente.')
        setSubmitting(false)
        return
      }
      const validItems = items.filter((it) => it.product_id && it.quantity > 0)
      if (validItems.length === 0) {
        setError('Agrega al menos un producto.')
        setSubmitting(false)
        return
      }

      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          order_number: orderNumber,
          client_id: clientId,
          status: 'pendiente',
          delivery_date: deliveryDate || null,
          total,
          created_by: profile?.id
        })
        .select()
        .single()

      if (orderError || !order) {
        setError(orderError?.message ?? 'No se pudo crear el pedido.')
        setSubmitting(false)
        return
      }

      await supabase.from('order_items').insert(
        validItems.map((it) => ({
          order_id: order.id,
          product_id: it.product_id,
          quantity: it.quantity,
          unit_price: it.unit_price,
          subtotal: it.quantity * it.unit_price
        }))
      )
    }

    setSubmitting(false)
    onCreated()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg p-5 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-800">Nuevo pedido</h2>
          <button onClick={onClose}>
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="flex bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setMode('quote')}
            className={`flex-1 text-sm rounded-md py-1.5 ${
              mode === 'quote' ? 'bg-white shadow text-gray-800' : 'text-gray-500'
            }`}
          >
            Desde cotización
          </button>
          <button
            onClick={() => setMode('direct')}
            className={`flex-1 text-sm rounded-md py-1.5 ${
              mode === 'direct' ? 'bg-white shadow text-gray-800' : 'text-gray-500'
            }`}
          >
            Pedido directo
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === 'quote' ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cotización aprobada
              </label>
              <select
                value={quoteId}
                onChange={(e) => setQuoteId(e.target.value)}
                className="input"
              >
                <option value="">Selecciona...</option>
                {approvedQuotes.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.quote_number} · {q.client?.name} · ${q.total.toFixed(2)}
                  </option>
                ))}
              </select>
              {approvedQuotes.length === 0 && (
                <p className="text-xs text-amber-600 mt-1">
                  No hay cotizaciones aprobadas todavía.
                </p>
              )}
            </div>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cliente</label>
                <select
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  className="input"
                >
                  <option value="">Selecciona un cliente...</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Productos</label>
                {items.map((item, index) => (
                  <div key={index} className="flex gap-2 items-center">
                    <select
                      value={item.product_id ?? ''}
                      onChange={(e) => {
                        const product = products.find((p) => p.id === e.target.value)
                        updateItem(index, {
                          product_id: e.target.value || null,
                          unit_price: product?.sale_price ?? 0
                        })
                      }}
                      className="input text-sm flex-1"
                    >
                      <option value="">Selecciona producto...</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => updateItem(index, { quantity: Number(e.target.value) })}
                      className="input text-sm w-16"
                    />
                    {items.length > 1 && (
                      <button type="button" onClick={() => removeItem(index)} className="text-red-400">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addItem}
                  className="text-sm text-redisteca-blue font-medium"
                >
                  + Agregar línea
                </button>
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha de entrega estimada (opcional)
            </label>
            <input
              type="date"
              value={deliveryDate}
              onChange={(e) => setDeliveryDate(e.target.value)}
              className="input"
            />
          </div>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 bg-redisteca-blue text-white rounded-lg py-2.5 font-medium disabled:opacity-60"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Crear pedido
          </button>
        </form>
      </div>
    </div>
  )
}

interface OrderItemDetail {
  id: string
  quantity: number
  delivered_quantity: number
  unit_price: number
  subtotal: number
  product: { name: string; sku: string } | null
}

function OrderDetailModal({ order, onClose }: { order: OrderRow; onClose: () => void }) {
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<OrderItemDetail[]>([])
  const [full, setFull] = useState<{
    signature_data: string | null
    received_by: string | null
    delivery_date: string | null
    notes: string | null
  } | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const [{ data: orderData }, { data: itemsData }] = await Promise.all([
        supabase
          .from('orders')
          .select('signature_data, received_by, delivery_date, notes')
          .eq('id', order.id)
          .single(),
        supabase
          .from('order_items')
          .select('*, product:products(name, sku)')
          .eq('order_id', order.id)
      ])
      setFull(orderData as any)
      setItems((itemsData as any) ?? [])
      setLoading(false)
    }
    load()
  }, [order.id])

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md p-5 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-gray-800">{order.order_number}</h2>
            <p className="text-xs text-gray-500">{order.client?.name ?? 'Sin cliente'}</p>
          </div>
          <button onClick={onClose}>
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <span
          className={`inline-block text-xs rounded-full px-2 py-1 ${STATUS_TONES[order.status]}`}
        >
          {STATUS_LABELS[order.status] ?? order.status}
        </span>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-redisteca-blue" />
          </div>
        ) : (
          <>
            {full?.delivery_date && (
              <p className="text-sm text-gray-600">
                Entrega estimada: <span className="font-medium">{full.delivery_date}</span>
              </p>
            )}

            <div className="space-y-2">
              {items.map((it) => (
                <div key={it.id} className="flex justify-between text-sm border-b border-gray-100 pb-2">
                  <div>
                    <p className="text-gray-800">{it.product?.name ?? 'Producto'}</p>
                    <p className="text-xs text-gray-400">
                      {it.quantity} x ${it.unit_price.toFixed(2)}
                      {order.status === 'entregado' && ` · Entregado: ${it.delivered_quantity}`}
                    </p>
                  </div>
                  <p className="text-gray-700 font-medium">${it.subtotal.toFixed(2)}</p>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-sm text-gray-500">Total</span>
              <span className="text-lg font-semibold text-gray-800">
                ${order.total.toFixed(2)}
              </span>
            </div>

            {full?.notes && <p className="text-sm text-gray-600">Notas: {full.notes}</p>}

            {order.status === 'entregado' && full?.signature_data && (
              <div className="border border-gray-200 rounded-xl p-3">
                <p className="text-sm font-medium text-gray-700 mb-1">Firma de recibido</p>
                {full.received_by && (
                  <p className="text-xs text-gray-500 mb-2">Recibido por: {full.received_by}</p>
                )}
                <img
                  src={full.signature_data}
                  alt="Firma de recibido"
                  className="w-full bg-gray-50 rounded-lg border border-gray-100"
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
