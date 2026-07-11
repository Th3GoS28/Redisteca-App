import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import type { Module, Action } from '../types'
import { Loader2 } from 'lucide-react'

// Envuelve rutas que solo requieren estar autenticado
export function RequireAuth({ children }: { children: JSX.Element }) {
  const { profile, loading, initialized } = useAuthStore()

  if (loading || !initialized) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-redisteca-blue" />
      </div>
    )
  }

  if (!profile) return <Navigate to="/login" replace />
  if (!profile.active) {
    return (
      <div className="min-h-screen flex items-center justify-center text-center px-6">
        <p className="text-gray-600">
          Tu cuenta está desactivada. Contacta a un administrador.
        </p>
      </div>
    )
  }

  return children
}

// Además exige un permiso específico (módulo + acción)
export function RequirePermission({
  module,
  action,
  children
}: {
  module: Module
  action: Action
  children: JSX.Element
}) {
  const can = useAuthStore((s) => s.can)

  if (!can(module, action)) {
    return (
      <div className="min-h-screen flex items-center justify-center text-center px-6">
        <div>
          <p className="text-gray-800 font-medium">No tienes acceso a esta sección.</p>
          <p className="text-gray-500 text-sm mt-1">
            Si crees que deberías tener acceso, contacta a tu gerente.
          </p>
        </div>
      </div>
    )
  }

  return children
}
