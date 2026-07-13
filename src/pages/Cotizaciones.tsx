import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { Loader2, Plus, X, Trash2, FileText, Download } from 'lucide-react'
import { enqueueAction, isOnline } from '../lib/offlineQueue'
import { saveCache, loadCache } from '../lib/localCache'
import { generateQuotePdf } from '../lib/quotePdf'

interface Client {
  id: string
  name: string
}

interface Product {
  id: string
  sku: string
  name: string
  sale_price: number
  unit: string
}

interface QuoteRow {
  id: string
  quote_number: string
  status: string
  total: number
  valid_until: string | null
  created_at: string
  client: { name: string } | null
}

interface LineItem {
  product_id: string | null
  description: string
  quantity: number
  unit_price: number
}

const STATUS_LABELS: Record<string, string> = {
  borrador: 'Borrador',
  enviada: 'Enviada',
  aprobada: 'Aprobada',
  rechazada: 'Rechazada',
  convertida: 'Convertida a pedido'
}

const STATUS_TONES: Record<string, string> = {
  borrador: 'bg-gray-100 text-gray-600',
  enviada: 'bg-blue-50 text-blue-700',
  aprobada: 'bg-green-50 text-green-700',
  rechazada: 'bg-red-50 text-red-700',
  convertida: 'bg-purple-50 text-purple-700'
}

export default function Cotizaciones() {
  const can = useAuthStore((s) => s.can)
  const canCreate = can('quotes', 'create')
  const canEdit = can('quotes', 'edit')
  const canApprove = can('quotes', 'approve')

  const [quotes, setQuotes] = useState<QuoteRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [detailQuote, setDetailQuote] = useState<QuoteRow | null>(null)

  async function loadQuotes() {
    setLoading(true)
    const { data } = await supabase
      .from('quotes')
      .select('*, client:clients(name)')
      .order('created_at', { ascending: false })
    setQuotes((data as any) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    loadQuotes()
  }, [])

  async function changeStatus(id: string, status: string) {
    setBusyId(id)
    const { error } = await supabase.from('quotes').update({ status }).eq('id', id)
    if (error) alert(error.message)
    await loadQuotes()
    setBusyId(null)
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-800">Cotizaciones</h1>
        {canCreate && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1 bg-redisteca-blue text-white text-sm rounded-lg px-3 py-2"
          >
            <Plus className="w-4 h-4" />
            Nueva
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="w-6 h-6 animate-spin text-redisteca-blue" />
        </div>
      ) : quotes.length === 0 ? (
        <div className="text-center py-10">
          <FileText className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-gray-400 text-sm">Aún no hay cotizaciones.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {quotes.map((q) => (
            <div
              key={q.id}
              onClick={() => setDetailQuote(q)}
              className="bg-white rounded-xl border border-gray-200 p-3 cursor-pointer active:bg-gray-50"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-gray-800">{q.quote_number}</p>
                  <p className="text-xs text-gray-500">{q.client?.name ?? 'Sin cliente'}</p>
                </div>
                <span
                  className={`text-xs rounded-full px-2 py-1 shrink-0 ${STATUS_TONES[q.status]}`}
                >
                  {STATUS_LABELS[q.status] ?? q.status}
                </span>
              </div>
              <p className="text-sm text-gray-700 mt-1 font-medium">
                ${q.total.toFixed(2)}
              </p>

              <div onClick={(e) => e.stopPropagation()}>
                {q.status === 'borrador' && canEdit && (
                  <button
                    onClick={() => changeStatus(q.id, 'enviada')}
                    disabled={busyId === q.id}
                    className="w-full mt-2 text-xs bg-redisteca-blue text-white rounded-lg py-2 disabled:opacity-60"
                  >
                    Marcar como enviada al cliente
                  </button>
                )}

                {q.status === 'enviada' && (canApprove || canEdit) && (
                  <div className="flex gap-2 mt-2">
                    {canApprove && (
                      <button
                        onClick={() => changeStatus(q.id, 'aprobada')}
                        disabled={busyId === q.id}
                        className="flex-1 text-xs bg-green-600 text-white rounded-lg py-2 disabled:opacity-60"
                      >
                        Aprobar
                      </button>
                    )}
                  {canEdit && (
                    <button
                      onClick={() => changeStatus(q.id, 'rechazada')}
                      disabled={busyId === q.id}
                      className="flex-1 text-xs bg-gray-200 text-gray-700 rounded-lg py-2 disabled:opacity-60"
                    >
                      Rechazar
                    </button>
                  )}
                </div>
              )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <NewQuoteModal
          onClose={() => setShowForm(false)}
          onCreated={() => {
            setShowForm(false)
            loadQuotes()
          }}
        />
      )}

      {detailQuote && (
        <QuoteDetailModal
          quote={detailQuote}
          onClose={() => setDetailQuote(null)}
          onUpdated={loadQuotes}
        />
      )}
    </div>
  )
}

function NewQuoteModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const profile = useAuthStore((s) => s.profile)
  const [clients, setClients] = useState<Client[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [clientId, setClientId] = useState('')
  const [validUntil, setValidUntil] = useState('')
  const [items, setItems] = useState<LineItem[]>([
    { product_id: null, description: '', quantity: 1, unit_price: 0 }
  ])
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    async function loadOptions() {
      if (!isOnline()) {
        setClients(loadCache<Client[]>('clients')?.data ?? [])
        setProducts(loadCache<Product[]>('products')?.data ?? [])
        return
      }
      const [{ data: clientsData }, { data: productsData }] = await Promise.all([
        supabase.from('clients').select('id, name').eq('active', true).order('name'),
        supabase
          .from('products')
          .select('id, sku, name, sale_price, unit')
          .eq('active', true)
          .order('name')
      ])
      const c = (clientsData as Client[]) ?? []
      const p = (productsData as Product[]) ?? []
      setClients(c)
      setProducts(p)
      saveCache('clients', c)
      saveCache('products', p)
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

  function selectProduct(index: number, productId: string) {
    const product = products.find((p) => p.id === productId)
    if (!product) {
      updateItem(index, { product_id: null })
      return
    }
    updateItem(index, {
      product_id: product.id,
      description: product.name,
      unit_price: product.sale_price
    })
  }

  function addItem() {
    setItems((prev) => [...prev, { product_id: null, description: '', quantity: 1, unit_price: 0 }])
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!clientId) {
      setError('Selecciona un cliente.')
      return
    }
    const validItems = items.filter((it) => it.description.trim() && it.quantity > 0)
    if (validItems.length === 0) {
      setError('Agrega al menos un producto o concepto.')
      return
    }

    setSubmitting(true)

    const quoteNumber = `COT-${Date.now().toString().slice(-8)}`

    const quoteFields = {
      quote_number: quoteNumber,
      client_id: clientId,
      status: 'borrador',
      subtotal: total,
      tax: 0,
      total,
      valid_until: validUntil || null,
      created_by: profile?.id
    }
    const itemsPayload = validItems.map((it) => ({
      product_id: it.product_id,
      description: it.description,
      quantity: it.quantity,
      unit_price: it.unit_price,
      subtotal: it.quantity * it.unit_price
    }))

    if (!isOnline()) {
      enqueueAction('quote', { ...quoteFields, items: itemsPayload })
      setSubmitting(false)
      alert(
        'Sin señal: la cotización se guardó en tu celular y se creará sola en cuanto tengas internet.'
      )
      onCreated()
      return
    }

    const { data: quote, error: quoteError } = await supabase
      .from('quotes')
      .insert(quoteFields)
      .select()
      .single()

    if (quoteError || !quote) {
      // Falló por conexión a mitad de camino: la guardamos local igual.
      enqueueAction('quote', { ...quoteFields, items: itemsPayload })
      setSubmitting(false)
      alert('No se pudo enviar en este momento — se guardó en tu celular y se reintentará solo.')
      onCreated()
      return
    }

    const { error: itemsError } = await supabase.from('quote_items').insert(
      itemsPayload.map((it) => ({ ...it, quote_id: quote.id }))
    )

    setSubmitting(false)

    if (itemsError) {
      setError(`Cotización creada, pero fallaron los productos: ${itemsError.message}`)
      return
    }

    onCreated()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg p-5 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-800">Nueva cotización</h2>
          <button onClick={onClose}>
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cliente</label>
            <select
              required
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
            {clients.length === 0 && (
              <p className="text-xs text-amber-600 mt-1">
                No hay clientes registrados todavía — crea uno primero en el módulo de Clientes.
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Válida hasta (opcional)
            </label>
            <input
              type="date"
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
              className="input"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Productos</label>
            {items.map((item, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-2.5 space-y-2">
                <div className="flex gap-2">
                  <select
                    value={item.product_id ?? ''}
                    onChange={(e) => selectProduct(index, e.target.value)}
                    className="input text-sm flex-1"
                  >
                    <option value="">Producto libre / personalizado...</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} (${p.sale_price.toFixed(2)})
                      </option>
                    ))}
                  </select>
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      className="text-red-400 shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <input
                  value={item.description}
                  onChange={(e) => updateItem(index, { description: e.target.value })}
                  placeholder="Descripción"
                  className="input text-sm"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={item.quantity}
                    onChange={(e) =>
                      updateItem(index, { quantity: Number(e.target.value) })
                    }
                    placeholder="Cantidad"
                    className="input text-sm"
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.unit_price}
                    onChange={(e) =>
                      updateItem(index, { unit_price: Number(e.target.value) })
                    }
                    placeholder="Precio unitario"
                    className="input text-sm"
                  />
                </div>
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

          <div className="flex items-center justify-between pt-2 border-t border-gray-200">
            <span className="text-sm text-gray-500">Total</span>
            <span className="text-lg font-semibold text-gray-800">${total.toFixed(2)}</span>
          </div>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 bg-redisteca-blue text-white rounded-lg py-2.5 font-medium disabled:opacity-60"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Crear cotización
          </button>
        </form>
      </div>
    </div>
  )
}

interface QuoteItemDetail {
  id: string
  description: string
  quantity: number
  unit_price: number
  subtotal: number
}

function QuoteDetailModal({
  quote,
  onClose,
  onUpdated
}: {
  quote: QuoteRow
  onClose: () => void
  onUpdated: () => void
}) {
  const can = useAuthStore((s) => s.can)
  const canEdit = can('quotes', 'edit')
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<QuoteItemDetail[]>([])
  const [notes, setNotes] = useState<string | null>(null)
  const [validUntil, setValidUntil] = useState<string | null>(null)
  const [clientRif, setClientRif] = useState<string | null>(null)
  const [createdAt, setCreatedAt] = useState<string>(new Date().toISOString())
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const [{ data: itemsData }, { data: quoteData }] = await Promise.all([
        supabase.from('quote_items').select('*').eq('quote_id', quote.id),
        supabase
          .from('quotes')
          .select('notes, valid_until, created_at, client:clients(rif)')
          .eq('id', quote.id)
          .single()
      ])
      setItems((itemsData as QuoteItemDetail[]) ?? [])
      setNotes((quoteData as any)?.notes ?? null)
      setValidUntil((quoteData as any)?.valid_until ?? null)
      setCreatedAt((quoteData as any)?.created_at ?? new Date().toISOString())
      setClientRif((quoteData as any)?.client?.rif ?? null)
      setLoading(false)
    }
    load()
  }, [quote.id])

  function handleDownload() {
    generateQuotePdf({
      quote_number: quote.quote_number,
      client_name: quote.client?.name ?? 'Cliente',
      client_rif: clientRif,
      valid_until: validUntil,
      created_at: createdAt,
      items,
      total: quote.total,
      notes
    })
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md p-5 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-gray-800">{quote.quote_number}</h2>
            <p className="text-xs text-gray-500">{quote.client?.name ?? 'Sin cliente'}</p>
          </div>
          <button onClick={onClose}>
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <span
          className={`inline-block text-xs rounded-full px-2 py-1 ${STATUS_TONES[quote.status]}`}
        >
          {STATUS_LABELS[quote.status] ?? quote.status}
        </span>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-redisteca-blue" />
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {items.map((it) => (
                <div key={it.id} className="flex justify-between text-sm border-b border-gray-100 pb-2">
                  <div>
                    <p className="text-gray-800">{it.description}</p>
                    <p className="text-xs text-gray-400">
                      {it.quantity} x ${it.unit_price.toFixed(2)}
                    </p>
                  </div>
                  <p className="text-gray-700 font-medium">${it.subtotal.toFixed(2)}</p>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-sm text-gray-500">Total</span>
              <span className="text-lg font-semibold text-gray-800">
                ${quote.total.toFixed(2)}
              </span>
            </div>

            {notes && <p className="text-sm text-gray-600">Notas: {notes}</p>}

            <div className="flex gap-2">
              {quote.status === 'borrador' && canEdit && (
                <button
                  onClick={() => setEditing(true)}
                  className="flex-1 bg-gray-100 text-gray-700 rounded-lg py-2.5 text-sm font-medium"
                >
                  Editar
                </button>
              )}
              <button
                onClick={handleDownload}
                className="flex-1 flex items-center justify-center gap-2 bg-redisteca-blue text-white rounded-lg py-2.5 text-sm font-medium"
              >
                <Download className="w-4 h-4" />
                Descargar PDF
              </button>
            </div>
          </>
        )}
      </div>

      {editing && (
        <EditQuoteModal
          quoteId={quote.id}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false)
            onUpdated()
            onClose()
          }}
        />
      )}
    </div>
  )
}

function EditQuoteModal({
  quoteId,
  onClose,
  onSaved
}: {
  quoteId: string
  onClose: () => void
  onSaved: () => void
}) {
  const [clients, setClients] = useState<Client[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [clientId, setClientId] = useState('')
  const [validUntil, setValidUntil] = useState('')
  const [items, setItems] = useState<LineItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    async function load() {
      const [{ data: clientsData }, { data: productsData }, { data: quoteData }, { data: itemsData }] =
        await Promise.all([
          supabase.from('clients').select('id, name').eq('active', true).order('name'),
          supabase
            .from('products')
            .select('id, sku, name, sale_price, unit')
            .eq('active', true)
            .order('name'),
          supabase.from('quotes').select('client_id, valid_until').eq('id', quoteId).single(),
          supabase.from('quote_items').select('*').eq('quote_id', quoteId)
        ])
      setClients((clientsData as Client[]) ?? [])
      setProducts((productsData as Product[]) ?? [])
      setClientId((quoteData as any)?.client_id ?? '')
      setValidUntil((quoteData as any)?.valid_until ?? '')
      setItems(
        ((itemsData as any[]) ?? []).map((it) => ({
          product_id: it.product_id,
          description: it.description,
          quantity: it.quantity,
          unit_price: it.unit_price
        }))
      )
      setLoading(false)
    }
    load()
  }, [quoteId])

  const total = useMemo(
    () => items.reduce((sum, it) => sum + it.quantity * it.unit_price, 0),
    [items]
  )

  function updateItem(index: number, patch: Partial<LineItem>) {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)))
  }

  function selectProduct(index: number, productId: string) {
    const product = products.find((p) => p.id === productId)
    if (!product) {
      updateItem(index, { product_id: null })
      return
    }
    updateItem(index, {
      product_id: product.id,
      description: product.name,
      unit_price: product.sale_price
    })
  }

  function addItem() {
    setItems((prev) => [...prev, { product_id: null, description: '', quantity: 1, unit_price: 0 }])
  }
  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!clientId) {
      setError('Selecciona un cliente.')
      return
    }
    const validItems = items.filter((it) => it.description.trim() && it.quantity > 0)
    if (validItems.length === 0) {
      setError('Agrega al menos un producto o concepto.')
      return
    }

    setSubmitting(true)

    const { error: updateError } = await supabase
      .from('quotes')
      .update({ client_id: clientId, valid_until: validUntil || null, subtotal: total, total })
      .eq('id', quoteId)

    if (updateError) {
      setError(updateError.message)
      setSubmitting(false)
      return
    }

    await supabase.from('quote_items').delete().eq('quote_id', quoteId)
    const { error: itemsError } = await supabase.from('quote_items').insert(
      validItems.map((it) => ({
        quote_id: quoteId,
        product_id: it.product_id,
        description: it.description,
        quantity: it.quantity,
        unit_price: it.unit_price,
        subtotal: it.quantity * it.unit_price
      }))
    )

    setSubmitting(false)
    if (itemsError) {
      setError(itemsError.message)
      return
    }
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg p-5 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-800">Editar cotización</h2>
          <button onClick={onClose}>
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-redisteca-blue" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cliente</label>
              <select
                required
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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Válida hasta (opcional)
              </label>
              <input
                type="date"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
                className="input"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Productos</label>
              {items.map((item, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-2.5 space-y-2">
                  <div className="flex gap-2">
                    <select
                      value={item.product_id ?? ''}
                      onChange={(e) => selectProduct(index, e.target.value)}
                      className="input text-sm flex-1"
                    >
                      <option value="">Producto libre / personalizado...</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} (${p.sale_price.toFixed(2)})
                        </option>
                      ))}
                    </select>
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeItem(index)}
                        className="text-red-400 shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <input
                    value={item.description}
                    onChange={(e) => updateItem(index, { description: e.target.value })}
                    placeholder="Descripción"
                    className="input text-sm"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={item.quantity}
                      onChange={(e) => updateItem(index, { quantity: Number(e.target.value) })}
                      placeholder="Cantidad"
                      className="input text-sm"
                    />
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.unit_price}
                      onChange={(e) => updateItem(index, { unit_price: Number(e.target.value) })}
                      placeholder="Precio unitario"
                      className="input text-sm"
                    />
                  </div>
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

            <div className="flex items-center justify-between pt-2 border-t border-gray-200">
              <span className="text-sm text-gray-500">Total</span>
              <span className="text-lg font-semibold text-gray-800">${total.toFixed(2)}</span>
            </div>

            {error && <p className="text-red-600 text-sm">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 bg-redisteca-blue text-white rounded-lg py-2.5 font-medium disabled:opacity-60"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Guardar cambios
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
