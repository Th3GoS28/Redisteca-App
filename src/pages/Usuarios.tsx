import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { Loader2, Plus, X, Check, Ban } from 'lucide-react'

interface RoleRow {
  id: string
  name: string
}

interface UserRow {
  id: string
  full_name: string
  email: string
  username: string | null
  role_id: string | null
  active: boolean
  role?: { name: string } | null
}

export default function Usuarios() {
  const can = useAuthStore((s) => s.can)
  const canCreate = can('users', 'create')
  const canEdit = can('users', 'edit')

  const [users, setUsers] = useState<UserRow[]>([])
  const [roles, setRoles] = useState<RoleRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)

  async function loadData() {
    setLoading(true)
    const [{ data: usersData }, { data: rolesData }] = await Promise.all([
      supabase.from('profiles').select('*, role:roles(name)').order('full_name'),
      supabase.from('roles').select('id, name').order('name')
    ])
    setUsers((usersData as UserRow[]) ?? [])
    setRoles((rolesData as RoleRow[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  async function toggleActive(user: UserRow) {
    const { error } = await supabase.functions.invoke('manage-user', {
      body: { user_id: user.id, active: !user.active }
    })
    if (!error) loadData()
  }

  async function changeRole(user: UserRow, role_id: string) {
    const { error } = await supabase.functions.invoke('manage-user', {
      body: { user_id: user.id, role_id }
    })
    if (!error) loadData()
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-800">Usuarios</h1>
        {canCreate && (
          <button
            onClick={() => setShowCreate(true)}
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
      ) : (
        <div className="space-y-2">
          {users.map((u) => (
            <div key={u.id} className="bg-white rounded-xl border border-gray-200 p-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-gray-800">{u.full_name}</p>
                  <p className="text-xs text-gray-500">
                    {u.username ? `@${u.username} · ` : ''}
                    {u.email}
                  </p>
                </div>
                {canEdit && (
                  <button
                    onClick={() => toggleActive(u)}
                    className={`flex items-center gap-1 text-xs rounded-full px-2 py-1 ${
                      u.active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {u.active ? <Check className="w-3 h-3" /> : <Ban className="w-3 h-3" />}
                    {u.active ? 'Activo' : 'Inactivo'}
                  </button>
                )}
              </div>

              <div className="mt-2">
                {canEdit ? (
                  <select
                    value={u.role_id ?? ''}
                    onChange={(e) => changeRole(u, e.target.value)}
                    className="text-sm border border-gray-300 rounded-lg px-2 py-1.5 w-full"
                  >
                    <option value="">Sin rol asignado</option>
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="text-xs text-gray-500">{u.role?.name ?? 'Sin rol'}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <CreateUserModal
          roles={roles}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false)
            loadData()
          }}
        />
      )}
    </div>
  )
}

function CreateUserModal({
  roles,
  onClose,
  onCreated
}: {
  roles: RoleRow[]
  onClose: () => void
  onCreated: () => void
}) {
  const [fullName, setFullName] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [roleId, setRoleId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    const { data, error } = await supabase.functions.invoke('create-user', {
      body: {
        email,
        password,
        full_name: fullName,
        username: username || null,
        role_id: roleId || null
      }
    })

    setSubmitting(false)

    if (error || data?.error) {
      setError(data?.error ?? error?.message ?? 'No se pudo crear el usuario.')
      return
    }

    onCreated()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-sm p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-800">Nuevo usuario</h2>
          <button onClick={onClose}>
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <Field label="Nombre completo">
            <input
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="input"
              placeholder="Ej. Juan Pérez"
            />
          </Field>
          <Field label="Usuario (opcional)">
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value.trim().toLowerCase())}
              className="input"
              placeholder="ej. jperez"
            />
          </Field>
          <Field label="Correo">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
              placeholder="correo@redisteca.com"
            />
          </Field>
          <Field label="Contraseña">
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
              placeholder="Mínimo 6 caracteres"
            />
          </Field>
          <Field label="Rol">
            <select value={roleId} onChange={(e) => setRoleId(e.target.value)} className="input">
              <option value="">Sin rol asignado</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </Field>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 bg-redisteca-blue text-white rounded-lg py-2.5 font-medium disabled:opacity-60"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Crear usuario
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
