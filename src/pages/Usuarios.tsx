import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { Loader2, Plus, X, Check, Ban, Shield } from 'lucide-react'

const MODULES: { key: string; label: string }[] = [
  { key: 'inventory', label: 'Inventario' },
  { key: 'quotes', label: 'Cotizaciones / Licitaciones' },
  { key: 'orders', label: 'Pedidos' },
  { key: 'clients', label: 'Clientes' },
  { key: 'finance', label: 'Finanzas' },
  { key: 'reports', label: 'Reportes' },
  { key: 'users', label: 'Usuarios' },
  { key: 'roles', label: 'Roles' }
]
const ACTIONS: { key: string; label: string }[] = [
  { key: 'view', label: 'Ver' },
  { key: 'create', label: 'Crear' },
  { key: 'edit', label: 'Editar' },
  { key: 'delete', label: 'Borrar' },
  { key: 'approve', label: 'Aprobar' },
  { key: 'export', label: 'Exportar' }
]

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
  const [tab, setTab] = useState<'usuarios' | 'roles'>('usuarios')
  const canManageRoles = can('roles', 'edit')

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
        {tab === 'usuarios' && canCreate && (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1 bg-redisteca-blue text-white text-sm rounded-lg px-3 py-2"
          >
            <Plus className="w-4 h-4" />
            Nuevo
          </button>
        )}
      </div>

      {canManageRoles && (
        <div className="flex bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setTab('usuarios')}
            className={`flex-1 text-sm rounded-md py-1.5 ${
              tab === 'usuarios' ? 'bg-white shadow text-gray-800' : 'text-gray-500'
            }`}
          >
            Usuarios
          </button>
          <button
            onClick={() => setTab('roles')}
            className={`flex-1 text-sm rounded-md py-1.5 flex items-center justify-center gap-1 ${
              tab === 'roles' ? 'bg-white shadow text-gray-800' : 'text-gray-500'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            Roles y permisos
          </button>
        </div>
      )}

      {tab === 'roles' && canManageRoles ? (
        <RolesPanel roles={roles} onRolesChanged={loadData} />
      ) : (
        <>

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
        </>
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

interface RoleWithPermissions {
  id: string
  name: string
  description: string | null
  is_system: boolean
  permissions: { module: string; action: string }[]
}

function RolesPanel({
  roles,
  onRolesChanged
}: {
  roles: RoleRow[]
  onRolesChanged: () => void
}) {
  const [detailed, setDetailed] = useState<RoleWithPermissions[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [busyKey, setBusyKey] = useState<string | null>(null)

  async function loadDetailed() {
    setLoading(true)
    const { data } = await supabase
      .from('roles')
      .select('id, name, description, is_system, role_permissions(permission:permissions(module, action))')
      .order('name')

    const mapped = (data ?? []).map((r: any) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      is_system: r.is_system,
      permissions: (r.role_permissions ?? []).map((rp: any) => rp.permission)
    }))
    setDetailed(mapped)
    setLoading(false)
  }

  useEffect(() => {
    loadDetailed()
  }, [roles])

  function hasPermission(role: RoleWithPermissions, module: string, action: string) {
    return role.permissions.some((p) => p.module === module && p.action === action)
  }

  async function togglePermission(role: RoleWithPermissions, module: string, action: string) {
    if (role.is_system) return
    const key = `${role.id}-${module}-${action}`
    setBusyKey(key)
    const enabled = !hasPermission(role, module, action)
    const { error } = await supabase.rpc('set_role_permission', {
      p_role_id: role.id,
      p_module: module,
      p_action: action,
      p_enabled: enabled
    })
    if (error) alert(error.message)
    await loadDetailed()
    setBusyKey(null)
  }

  async function handleCreateRole(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) {
      setError('Ponle un nombre al rol.')
      return
    }
    setSubmitting(true)
    setError(null)
    const { error } = await supabase.rpc('create_role', {
      p_name: newName,
      p_description: newDescription || null
    })
    setSubmitting(false)
    if (error) {
      setError(error.message)
      return
    }
    setShowCreate(false)
    setNewName('')
    setNewDescription('')
    onRolesChanged()
    loadDetailed()
  }

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="w-6 h-6 animate-spin text-redisteca-blue" />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <button
        onClick={() => setShowCreate(true)}
        className="w-full flex items-center justify-center gap-1 border border-dashed border-gray-300 text-gray-600 text-sm rounded-lg py-2.5"
      >
        <Plus className="w-4 h-4" />
        Crear nuevo rol
      </button>

      {detailed.map((role) => (
        <div key={role.id} className="bg-white rounded-xl border border-gray-200 p-3">
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="font-medium text-gray-800">{role.name}</p>
              {role.description && (
                <p className="text-xs text-gray-500">{role.description}</p>
              )}
            </div>
            {role.is_system && (
              <span className="text-[10px] bg-gray-100 text-gray-500 rounded-full px-2 py-1">
                Acceso total, no editable
              </span>
            )}
          </div>

          {!role.is_system && (
            <div className="overflow-x-auto -mx-3 px-3">
              <table className="text-xs w-full min-w-[420px]">
                <thead>
                  <tr>
                    <th className="text-left font-medium text-gray-500 pb-1">Módulo</th>
                    {ACTIONS.map((a) => (
                      <th key={a.key} className="text-center font-medium text-gray-500 pb-1 px-1">
                        {a.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {MODULES.map((m) => (
                    <tr key={m.key} className="border-t border-gray-100">
                      <td className="py-1.5 text-gray-700">{m.label}</td>
                      {ACTIONS.map((a) => {
                        const key = `${role.id}-${m.key}-${a.key}`
                        const enabled = hasPermission(role, m.key, a.key)
                        return (
                          <td key={a.key} className="text-center px-1">
                            <button
                              disabled={busyKey === key}
                              onClick={() => togglePermission(role, m.key, a.key)}
                              className={`w-5 h-5 rounded ${
                                enabled ? 'bg-redisteca-blue' : 'bg-gray-200'
                              } disabled:opacity-50`}
                            />
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}

      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-sm p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-800">Nuevo rol</h2>
              <button onClick={() => setShowCreate(false)}>
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <form onSubmit={handleCreateRole} className="space-y-3">
              <Field label="Nombre del rol">
                <input
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="input"
                  placeholder="Ej. Supervisor de almacén"
                />
              </Field>
              <Field label="Descripción (opcional)">
                <input
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="input"
                />
              </Field>
              <p className="text-xs text-gray-500">
                El rol se crea sin permisos — actívalos desde la tabla después de guardarlo.
              </p>
              {error && <p className="text-red-600 text-sm">{error}</p>}
              <button
                type="submit"
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 bg-redisteca-blue text-white rounded-lg py-2.5 font-medium disabled:opacity-60"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Crear rol
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
