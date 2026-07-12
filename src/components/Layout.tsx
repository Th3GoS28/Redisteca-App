import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import {
  LayoutDashboard,
  Package,
  FileText,
  Truck,
  Users,
  Wallet,
  Bell,
  Settings,
  LogOut
} from 'lucide-react'

const NAV_ITEMS = [
  { to: '/', label: 'Inicio', icon: LayoutDashboard, module: null as null | string, action: null },
  { to: '/inventario', label: 'Inventario', icon: Package, module: 'inventory', action: 'view' },
  { to: '/cotizaciones', label: 'Cotizar', icon: FileText, module: 'quotes', action: 'view' },
  { to: '/pedidos', label: 'Pedidos', icon: Truck, module: 'orders', action: 'view' },
  { to: '/clientes', label: 'Clientes', icon: Users, module: 'clients', action: 'view' },
  { to: '/finanzas', label: 'Finanzas', icon: Wallet, module: 'finance', action: 'view' }
]

export default function Layout() {
  const { profile, can, signOut } = useAuthStore()
  const navigate = useNavigate()

  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.module || can(item.module as any, item.action as any)
  )

  async function handleLogout() {
    if (!confirm('¿Cerrar sesión?')) return
    await signOut()
    navigate('/login')
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-redisteca-blue text-white safe-top">
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <p className="font-semibold leading-none">Redisteca</p>
            <p className="text-xs text-white/70">{profile?.role?.name}</p>
          </div>
          <div className="flex items-center gap-3">
            <NavLink to="/notificaciones" className="relative">
              <Bell className="w-5 h-5" />
            </NavLink>
            {can('users', 'view') && (
              <NavLink to="/usuarios">
                <Settings className="w-5 h-5" />
              </NavLink>
            )}
            <button onClick={handleLogout} aria-label="Cerrar sesión">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Contenido */}
      <main className="flex-1 overflow-y-auto pb-20">
        <Outlet />
      </main>

      {/* Navegación inferior (estilo app nativa) */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 safe-bottom">
        <div className="flex justify-around">
          {visibleItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 py-2 px-2 min-w-[64px] text-xs ${
                  isActive ? 'text-redisteca-blue' : 'text-gray-400'
                }`
              }
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
