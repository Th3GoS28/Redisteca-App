import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { Loader2, Plus, X, Gavel, Calendar } from 'lucide-react'

interface Client {
  id: string
  name: string
}
interface Tender {
  id: string
  title: string
  deadline_date: string | null
  status: string
  documents_required: string | null
  competitors: string | null
  notes: string | null
  client: { name: string } | null
}

const STATUS_LABELS: Record<string, string> = {
  preparacion: 'En preparación',
  enviada: 'Enviada',
  ganada: 'Ganada',
  perdida: 'Perdida'
}
const STATUS_TONES: Record<string, string> = {
  preparacion: 'bg-gray-100 text-gray-600',
  enviada: 'bg-blue-50 text-blue-700',
  ganada: 'bg-green-50 text-green-700',
  perdida: 'bg-red-50 text-red-700'
}

export default function Licitaciones() {
  const can = useAuthStore((s) => s.can)
  const canCreate = can('quotes', 'create')
  const canEdit = can('quotes', 'edit')

  const [tenders, setTenders] = useState<Tender[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

  async function loadTenders() {
    setLoading(true)
    const { data } = await supabase
      .from('tenders')
      .select('*, client:clients(name)')
      .order('deadline_date', { ascending: true, nullsFirst: false })
    setTenders((data as any) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    loadTenders()
  }, [])

  const daysLeft = (date: string | null) => {
    if (!date) return null
    const diff = Math.ceil(
      (new Date(date).getTime() - new Date().setHours(0, 0, 0, 0)) / 86400000
    )
    return diff
  }

  async function changeStatus(t: Tender, status: string) {
    await supabase.from('tenders').update({ status }).eq('id', t.id)
    loadTenders()
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-800">Licitaciones</h1>
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
      ) : tenders.length === 0 ? (
        <div className="text-center py-10">
          <Gavel className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-gray-400 text-sm">Aún no hay licitaciones registradas.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {tenders.map((t) => {
            const dl = daysLeft(t.deadline_date)
            return (
              <div key={t.id} className="bg-white rounded-xl border border-gray-200 p-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-gray-800">{t.title}</p>
                    <p className="text-xs text-gray-500">{t.client?.name ?? 'Sin cliente'}</p>
                  </div>
                  <span className={`text-xs rounded-full px-2 py-1 shrink-0 ${STATUS_TONES[t.status]}`}>
                    {STATUS_LABELS[t.status]}
                  </span>
                </div>

                {t.deadline_date && (
                  <p
                    className={`flex items-center gap-1 text-xs mt-1.5 ${
                      dl !== null && dl <= 3 && t.status === 'preparacion'
                        ? 'text-red-600 font-medium'
                        : 'text-gray-500'
                    }`}
                  >
                    <Calendar className="w-3 h-3" />
                    Cierre: {t.deadline_date}
                    {dl !== null && dl >= 0 && t.status === 'preparacion' && ` (${dl} días)`}
                  </p>
                )}
                {t.documents_required && (
                  <p className="text-xs text-gray-500 mt-1">
                    Documentos: {t.documents_required}
                  </p>
                )}
                {t.competitors && (
                  <p className="text-xs text-gray-500">Competencia: {t.competitors}</p>
                )}

                {canEdit && t.status === 'preparacion' && (
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => changeStatus(t, 'enviada')}
                      className="flex-1 text-xs bg-redisteca-blue text-white rounded-lg py-2"
                    >
                      Marcar enviada
                    </button>
                  </div>
                )}
                {canEdit && t.status === 'enviada' && (
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => changeStatus(t, 'ganada')}
                      className="flex-1 text-xs bg-green-600 text-white rounded-lg py-2"
                    >
                      Ganada
                    </button>
                    <button
                      onClick={() => changeStatus(t, 'perdida')}
                      className="flex-1 text-xs bg-gray-200 text-gray-700 rounded-lg py-2"
                    >
                      Perdida
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {showForm && (
        <NewTenderModal
          onClose={() => setShowForm(false)}
          onCreated={() => {
            setShowForm(false)
            loadTenders()
          }}
        />
      )}
    </div>
  )
}

function NewTenderModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const profile = useAuthStore((s) => s.profile)
  const [clients, setClients] = useState<Client[]>([])
  const [title, setTitle] = useState('')
  const [clientId, setClientId] = useState('')
  const [deadline, setDeadline] = useState('')
  const [documents, setDocuments] = useState('')
  const [competitors, setCompetitors] = useState('')
  const [notes, setNotes] = useState('')
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
    if (!title.trim()) {
      setError('Ponle un nombre a la licitación.')
      return
    }
    setSubmitting(true)
    setError(null)

    const { error } = await supabase.from('tenders').insert({
      title,
      client_id: clientId || null,
      deadline_date: deadline || null,
      documents_required: documents || null,
      competitors: competitors || null,
      notes: notes || null,
      status: 'preparacion',
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
          <h2 className="font-semibold text-gray-800">Nueva licitación</h2>
          <button onClick={onClose}>
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Título</label>
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="input"
              placeholder="Ej. Suministro instrumentación Planta Norte"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Cliente / Empresa (opcional)
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
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha límite de entrega de propuesta
            </label>
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="input"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Documentos requeridos
            </label>
            <input
              value={documents}
              onChange={(e) => setDocuments(e.target.value)}
              className="input"
              placeholder="RIF, solvencia laboral, referencias..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Competencia conocida (opcional)
            </label>
            <input
              value={competitors}
              onChange={(e) => setCompetitors(e.target.value)}
              className="input"
              placeholder="Ej. Empresa X, Empresa Y"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notas (opcional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="input"
              rows={2}
            />
          </div>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 bg-redisteca-blue text-white rounded-lg py-2.5 font-medium disabled:opacity-60"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Crear licitación
          </button>
        </form>
      </div>
    </div>
  )
}
