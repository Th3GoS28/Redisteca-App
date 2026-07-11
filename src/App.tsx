import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { RequireAuth, RequirePermission } from './components/RequireAuth'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Inventario from './pages/Inventario'
import Cotizaciones from './pages/Cotizaciones'
import Pedidos from './pages/Pedidos'
import Clientes from './pages/Clientes'
import Finanzas from './pages/Finanzas'
import Notificaciones from './pages/Notificaciones'
import Usuarios from './pages/Usuarios'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route
          element={
            <RequireAuth>
              <Layout />
            </RequireAuth>
          }
        >
          <Route path="/" element={<Dashboard />} />
          <Route path="/notificaciones" element={<Notificaciones />} />

          <Route
            path="/inventario"
            element={
              <RequirePermission module="inventory" action="view">
                <Inventario />
              </RequirePermission>
            }
          />
          <Route
            path="/cotizaciones"
            element={
              <RequirePermission module="quotes" action="view">
                <Cotizaciones />
              </RequirePermission>
            }
          />
          <Route
            path="/pedidos"
            element={
              <RequirePermission module="orders" action="view">
                <Pedidos />
              </RequirePermission>
            }
          />
          <Route
            path="/clientes"
            element={
              <RequirePermission module="clients" action="view">
                <Clientes />
              </RequirePermission>
            }
          />
          <Route
            path="/finanzas"
            element={
              <RequirePermission module="finance" action="view">
                <Finanzas />
              </RequirePermission>
            }
          />
          <Route
            path="/usuarios"
            element={
              <RequirePermission module="users" action="view">
                <Usuarios />
              </RequirePermission>
            }
          />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
