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
import Licitaciones from './pages/Licitaciones'
import Catalogo from './pages/Catalogo'
import Reportes from './pages/Reportes'

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
            path="/licitaciones"
            element={
              <RequirePermission module="quotes" action="view">
                <Licitaciones />
              </RequirePermission>
            }
          />
          <Route
            path="/catalogo"
            element={
              <RequirePermission module="inventory" action="view">
                <Catalogo />
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
            path="/reportes"
            element={
              <RequirePermission module="reports" action="view">
                <Reportes />
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
