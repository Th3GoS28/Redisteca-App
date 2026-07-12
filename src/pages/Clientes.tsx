import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { Loader2, Plus, X, Search, Pencil, Phone, Mail, MapPin, Camera, WifiOff } from 'lucide-react'
import { enqueueAction, isOnline } from '../lib/offlineQueue'

interface Client {
  id: string
  name: string
  rif: string | null
  phone: string | null
  email: string | null
  address: string | null
  contact_name: string | null
  notes: string | null
  active: boolean
}

export default function Clientes() {
  const can = useAuthStore((s) => s.can)
  const canCreate = can('clients', 'create')
  const canEdit = can('clients', 'edit')

  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Client | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [visitsFor, setVisitsFor] = useState<Client | null>(null)

  async function loadClients() {
    setLoading(true)
    const { data } = await supabase
      .from('clients')
      .select('*')
      .eq('active', true)
      .order('name')
    setClients((data as Client[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    loadClients()
  }, [])

  const filtered = useMemo(() => {
    if (!search.trim()) return clients
    const q = search.trim().toLowerCase()
    return clients.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.rif ?? '').toLowerCase().includes(q) ||
        (c.contact_name ?? '').toLowerCase().includes(q)
    )
  }, [clients, search])

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-800">Clientes</h1>
        {canCreate && (
          <button
            onClick={() => {
              setEditing(null)
              setShowForm(true)
            }}
            className="flex items-center gap-1 bg-redisteca-blue text-white text-sm rounded-lg px-3 py-2"
          >
            <Plus className="w-4 h-4" />
            Nuevo
          </button>
        )}
      </div>

      <div className="relative">
        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre, RIF o contacto..."
          className="w-full rounded-lg border border-gray-300 pl-9 pr-3 py-2 text-sm"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="w-6 h-6 animate-spin text-redisteca-blue" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-center text-gray-400 text-sm py-10">
          No se encontraron clientes.
        </p>
      ) : (
        <div className="space-y-2">
          {filtered.map((c) => (
            <div key={c.id} className="bg-white rounded-xl border border-gray-200 p-3">
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <p className="font-medium text-gray-800 truncate">{c.name}</p>
                  <p className="text-xs text-gray-500">
                    {c.rif && `RIF: ${c.rif}`}
                    {c.contact_name && ` · Contacto: ${c.contact_name}`}
                  </p>
                  <div className="flex items-center gap-3 mt-1">
                    {c.phone && (
                      <span className="flex items-center gap-1 text-xs text-gray-500">
                        <Phone className="w-3 h-3" />
                        {c.phone}
                      </span>
                    )}
                    {c.email && (
                      <span className="flex items-center gap-1 text-xs text-gray-500">
                        <Mail className="w-3 h-3" />
                        {c.email}
                      </span>
                    )}
                  </div>
                </div>
                {canEdit && (
                  <button
                    onClick={() => {
                      setEditing(c)
                      setShowForm(true)
                    }}
                    className="text-gray-400 shrink-0 ml-2"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                )}
              </div>
              <button
                onClick={() => setVisitsFor(c)}
                className="mt-2 flex items-center gap-1 text-xs text-redisteca-blue font-medium"
              >
                <MapPin className="w-3.5 h-3.5" />
                Ver bitácora de visitas
              </button>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <ClientForm
          client={editing}
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false)
            loadClients()
          }}
        />
      )}

      {visitsFor && <VisitsModal client={visitsFor} onClose={() => setVisitsFor(null)} />}
    </div>
  )
}

function ClientForm({
  client,
  onClose,
  onSaved
}: {
  client: Client | null
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState({
    name: client?.name ?? '',
    rif: client?.rif ?? '',
    phone: client?.phone ?? '',
    email: client?.email ?? '',
    address: client?.address ?? '',
    contact_name: client?.contact_name ?? '',
    notes: client?.notes ?? ''
  })
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    const { error } = client
      ? await supabase.from('clients').update(form).eq('id', client.id)
      : await supabase.from('clients').insert(form)

    setSubmitting(false)

    if (error) {
      setError(error.message)
      return
    }

    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md p-5 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-800">
            {client ? 'Editar cliente' : 'Nuevo cliente'}
          </h2>
          <button onClick={onClose}>
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <Field label="Nombre / Razón social">
            <input
              required
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              className="input"
              placeholder="Ej. Industrias Zulia C.A."
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="RIF">
              <input
                value={form.rif}
                onChange={(e) => set('rif', e.target.value)}
                className="input"
                placeholder="J-12345678-9"
              />
            </Field>
            <Field label="Teléfono">
              <input
                value={form.phone}
                onChange={(e) => set('phone', e.target.value)}
                className="input"
                placeholder="0261-1234567"
              />
            </Field>
          </div>

          <Field label="Correo">
            <input
              type="email"
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
              className="input"
              placeholder="contacto@empresa.com"
            />
          </Field>

          <Field label="Persona de contacto">
            <input
              value={form.contact_name}
              onChange={(e) => set('contact_name', e.target.value)}
              className="input"
              placeholder="Ej. María Pérez, Compras"
            />
          </Field>

          <Field label="Dirección">
            <textarea
              value={form.address}
              onChange={(e) => set('address', e.target.value)}
              className="input"
              rows={2}
            />
          </Field>

          <Field label="Notas (opcional)">
            <textarea
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              className="input"
              rows={2}
              placeholder="Condiciones de pago, preferencias, etc."
            />
          </Field>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 bg-redisteca-blue text-white rounded-lg py-2.5 font-medium disabled:opacity-60"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {client ? 'Guardar cambios' : 'Crear cliente'}
          </button>
        </form>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
    </div>
  )
}

interface Visit {
  id: string
  visited_at: string
  contact_name: string | null
  summary: string
  next_step: string | null
  next_step_date: string | null
  photo_url: string | null
}

function VisitsModal({ client, onClose }: { client: Client; onClose: () => void }) {
  const profile = useAuthStore((s) => s.profile)
  const [visits, setVisits] = useState<Visit[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)

  const [contactName, setContactName] = useState('')
  const [summary, setSummary] = useState('')
  const [nextStep, setNextStep] = useState('')
  const [nextStepDate, setNextStepDate] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function loadVisits() {
    setLoading(true)
    const { data } = await supabase
      .from('visits')
      .select('*')
      .eq('client_id', client.id)
      .order('visited_at', { ascending: false })
    setVisits((data as Visit[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    loadVisits()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client.id])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!summary.trim()) {
      setError('Describe brevemente qué se conversó en la visita.')
      return
    }
    setSubmitting(true)
    setError(null)

    const visitPayload = {
      client_id: client.id,
      contact_name: contactName || null,
      summary,
      next_step: nextStep || null,
      next_step_date: nextStepDate || null,
      photo_url: null as string | null,
      created_by: profile?.id
    }

    // Sin señal: guarda local y sincroniza sola después (sin foto, por
    // tamaño — al volver la señal puedes editar la visita si hace falta).
    if (!isOnline()) {
      enqueueAction('visit', visitPayload)
      setSubmitting(false)
      setShowAdd(false)
      setContactName('')
      setSummary('')
      setNextStep('')
      setNextStepDate('')
      setPhoto(null)
      setError(null)
      alert('Sin señal: la visita se guardó en tu celular y se subirá sola en cuanto tengas internet.')
      return
    }

    let photo_url: string | null = null
    if (photo) {
      const path = `${client.id}/${Date.now()}-${photo.name}`
      const { error: uploadError } = await supabase.storage
        .from('visit-photos')
        .upload(path, photo)
      if (!uploadError) {
        photo_url = supabase.storage.from('visit-photos').getPublicUrl(path).data.publicUrl
      }
    }

    const { error } = await supabase.from('visits').insert({ ...visitPayload, photo_url })

    setSubmitting(false)

    if (error) {
      // Falló por conexión a mitad de camino: igual la guardamos local.
      enqueueAction('visit', visitPayload)
      setShowAdd(false)
      alert('No se pudo subir en este momento — se guardó en tu celular y se reintentará solo.')
      return
    }
    setShowAdd(false)
    setContactName('')
    setSummary('')
    setNextStep('')
    setNextStepDate('')
    setPhoto(null)
    loadVisits()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md p-5 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-gray-800">Bitácora de visitas</h2>
            <p className="text-xs text-gray-500">{client.name}</p>
          </div>
          <button onClick={onClose}>
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {!showAdd && (
          <button
            onClick={() => setShowAdd(true)}
            className="w-full flex items-center justify-center gap-2 bg-redisteca-blue text-white rounded-lg py-2.5 text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Registrar visita
          </button>
        )}

        {showAdd && (
          <form onSubmit={handleSubmit} className="space-y-3 border border-gray-200 rounded-xl p-3">
            <Field label="Persona con quien hablaste">
              <input
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                className="input"
                placeholder="Ej. Ing. Carlos Mendoza"
              />
            </Field>
            <Field label="¿Qué se conversó?">
              <textarea
                required
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                className="input"
                rows={3}
                placeholder="Ej. Interesados en válvulas Festo para línea 3, piden cotización..."
              />
            </Field>
            <Field label="Próximo paso (opcional)">
              <input
                value={nextStep}
                onChange={(e) => setNextStep(e.target.value)}
                className="input"
                placeholder="Ej. Enviar cotización"
              />
            </Field>
            <Field label="Fecha del próximo paso">
              <input
                type="date"
                value={nextStepDate}
                onChange={(e) => setNextStepDate(e.target.value)}
                className="input"
              />
            </Field>
            <Field label="Foto (opcional)">
              <label className="flex items-center gap-2 border border-dashed border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-500 cursor-pointer">
                <Camera className="w-4 h-4" />
                {photo ? photo.name : 'Tomar o adjuntar foto'}
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
                />
              </label>
            </Field>

            {error && <p className="text-red-600 text-sm">{error}</p>}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowAdd(false)}
                className="flex-1 text-sm bg-gray-100 text-gray-600 rounded-lg py-2"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 flex items-center justify-center gap-2 bg-redisteca-blue text-white rounded-lg py-2 text-sm font-medium disabled:opacity-60"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Guardar
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-redisteca-blue" />
          </div>
        ) : visits.length === 0 ? (
          <p className="text-center text-gray-400 text-sm py-6">
            Aún no hay visitas registradas.
          </p>
        ) : (
          <div className="space-y-2">
            {visits.map((v) => (
              <div key={v.id} className="border border-gray-200 rounded-xl p-3">
                <p className="text-xs text-gray-400">
                  {new Date(v.visited_at).toLocaleDateString()}
                  {v.contact_name && ` · ${v.contact_name}`}
                </p>
                <p className="text-sm text-gray-800 mt-1">{v.summary}</p>
                {v.next_step && (
                  <p className="text-xs text-redisteca-blue mt-1">
                    Próximo paso: {v.next_step} {v.next_step_date && `(${v.next_step_date})`}
                  </p>
                )}
                {v.photo_url && (
                  <img
                    src={v.photo_url}
                    alt="Foto de visita"
                    className="mt-2 rounded-lg w-full max-h-40 object-cover"
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
