import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { Loader2, Plus, X, ArrowUpCircle, ArrowDownCircle, Check } from 'lucide-react'

interface Client {
  id: string
  name: string
}
interface Transaction {
  id: string
  type: 'ingreso' | 'egreso'
  category: string | null
  amount: number
  description: string | null
  due_date: string | null
  paid_date: string | null
  status: string
  payment_method: string | null
  client: { name: string } | null
}

const STATUS_TONES: Record<string, string> = {
  pendiente: 'bg-amber-50 text-amber-700',
  pagado: 'bg-green-50 text-green-700',
  vencido: 'bg-red-50 text-red-700'
}

export default function Finanzas() {
  const can = useAuthStore((s) => s.can)
  const canCreate = can('finance', 'create')
  const canEdit = can('finance', 'edit')

  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'todas' | 'ingreso' | 'egreso'>('todas')
  const [showForm, setShowForm] = useState(false)

  async function loadTransactions() {
    setLoading(true)
    const { data } = await supabase
      .from('transactions')
      .select('*, client:clients(name)')
      .order('due_date', { ascending: true, nullsFirst: false })
    setTransactions((data as any) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    loadTransactions()
  }, [])

  const filtered = useMemo(() => {
    if (filter === 'todas') return transactions
    return transactions.filter((t) => t.type === filter)
  }, [transactions, filter])

  const totals = useMemo(() => {
    const porCobrar = transactions
      .filter((t) => t.type === 'ingreso' && t.status !== 'pagado')
      .reduce((s, t) => s + t.amount, 0)
    const porPagar = transactions
      .filter((t) => t.type === 'egreso' && t.status !== 'pagado')
      .reduce((s, t) => s + t.amount, 0)
    return { porCobrar, porPagar }
  }, [transactions])

  async function markPaid(t: Transaction) {
    await supabase
      .from('transactions')
      .update({ status: 'pagado', paid_date: new Date().toISOString().slice(0, 10) })
      .eq('id', t.id)
    loadTransactions()
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-800">Finanzas</h1>
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

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl p-4 bg-amber-50 text-amber-700">
          <p className="text-xl font-semibold">${totals.porCobrar.toFixed(2)}</p>
          <p className="text-xs mt-1">Por cobrar</p>
        </div>
        <div className="rounded-xl p-4 bg-red-50 text-red-700">
          <p className="text-xl font-semibold">${totals.porPagar.toFixed(2)}</p>
          <p className="text-xs mt-1">Por pagar</p>
        </div>
      </div>

      <div className="flex bg-gray-100 rounded-lg p-1">
        {(['todas', 'ingreso', 'egreso'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`flex-1 text-sm rounded-md py-1.5 capitalize ${
              filter === f ? 'bg-white shadow text-gray-800' : 'text-gray-500'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="w-6 h-6 animate-spin text-redisteca-blue" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-center text-gray-400 text-sm py-10">No hay movimientos.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((t) => (
            <div key={t.id} className="bg-white rounded-xl border border-gray-200 p-3">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-2 min-w-0">
                  {t.type === 'ingreso' ? (
                    <ArrowUpCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                  ) : (
                    <ArrowDownCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  )}
                  <div className="min-w-0">
                    <p className="font-medium text-gray-800 truncate">
                      {t.description || t.category || (t.type === 'ingreso' ? 'Ingreso' : 'Egreso')}
                    </p>
                    <p className="text-xs text-gray-500">
                      {t.client?.name && `${t.client.name} · `}
                      {t.due_date && `Vence: ${t.due_date}`}
                    </p>
                  </div>
                </div>
                <span
                  className={`text-xs rounded-full px-2 py-1 shrink-0 ${STATUS_TONES[t.status]}`}
                >
                  {t.status}
                </span>
              </div>
              <div className="flex items-center justify-between mt-2">
                <p
                  className={`font-medium ${
                    t.type === 'ingreso' ? 'text-green-700' : 'text-red-700'
                  }`}
                >
                  {t.type === 'ingreso' ? '+' : '-'}${t.amount.toFixed(2)}
                </p>
                {canEdit && t.status !== 'pagado' && (
                  <button
                    onClick={() => markPaid(t)}
                    className="flex items-center gap-1 text-xs bg-green-50 text-green-700 rounded-lg px-2 py-1"
                  >
                    <Check className="w-3 h-3" />
                    Marcar pagado
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <NewTransactionModal
          onClose={() => setShowForm(false)}
          onCreated={() => {
            setShowForm(false)
            loadTransactions()
          }}
        />
      )}
    </div>
  )
}

function NewTransactionModal({
  onClose,
  onCreated
}: {
  onClose: () => void
  onCreated: () => void
}) {
  const profile = useAuthStore((s) => s.profile)
  const [clients, setClients] = useState<Client[]>([])
  const [type, setType] = useState<'ingreso' | 'egreso'>('ingreso')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')
  const [clientId, setClientId] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    supabase
      .from('clients')
      .select('id, name')
      .eq('active', true)
      .order('name')
      .then(({ data }) => setClients((data as Client[]) ?? []))
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!amount || Number(amount) <= 0) {
      setError('Ingresa un monto válido.')
      return
    }

    setSubmitting(true)
    const { error } = await supabase.from('transactions').insert({
      type,
      category: category || null,
      amount: Number(amount),
      description: description || null,
      related_client_id: clientId || null,
      due_date: dueDate || null,
      payment_method: paymentMethod || null,
      status: 'pendiente',
      created_by: profile?.id
    })
    setSubmitting(false)

    if (error) {
      setError(error.message)
      return
    }
    onCreated()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md p-5 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-800">Nuevo movimiento</h2>
          <button onClick={onClose}>
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="flex bg-gray-100 rounded-lg p-1">
          <button
            type="button"
            onClick={() => setType('ingreso')}
            className={`flex-1 text-sm rounded-md py-1.5 ${
              type === 'ingreso' ? 'bg-white shadow text-green-700' : 'text-gray-500'
            }`}
          >
            Ingreso (por cobrar)
          </button>
          <button
            type="button"
            onClick={() => setType('egreso')}
            className={`flex-1 text-sm rounded-md py-1.5 ${
              type === 'egreso' ? 'bg-white shadow text-red-700' : 'text-gray-500'
            }`}
          >
            Egreso (por pagar)
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Monto</label>
            <input
              type="number"
              step="0.01"
              min="0"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="input"
              placeholder="0.00"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="input"
              placeholder="Ej. Factura #123, compra de repuestos..."
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
              <input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="input"
                placeholder="venta, nómina..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fecha de vencimiento
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="input"
              />
            </div>
          </div>

          {type === 'ingreso' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cliente (opcional)
              </label>
              <select value={clientId} onChange={(e) => setClientId(e.target.value)} className="input">
                <option value="">Sin cliente asociado</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Método de pago (opcional)
            </label>
            <input
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="input"
              placeholder="Transferencia, efectivo, zelle..."
            />
          </div>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 bg-redisteca-blue text-white rounded-lg py-2.5 font-medium disabled:opacity-60"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Registrar movimiento
          </button>
        </form>
      </div>
    </div>
  )
}
