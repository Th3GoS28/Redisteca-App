import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Loader2, TrendingUp, Award, Users2 } from 'lucide-react'

interface MonthSales {
  month: string
  total: number
}
interface TopProduct {
  name: string
  quantity: number
  revenue: number
}
interface TopClient {
  name: string
  total: number
}

export default function Reportes() {
  const [loading, setLoading] = useState(true)
  const [monthSales, setMonthSales] = useState<MonthSales[]>([])
  const [topProducts, setTopProducts] = useState<TopProduct[]>([])
  const [topClients, setTopClients] = useState<TopClient[]>([])
  const [tenderStats, setTenderStats] = useState({ ganadas: 0, perdidas: 0, enProceso: 0 })

  useEffect(() => {
    async function load() {
      setLoading(true)

      // Ventas por mes (últimos 6), en base a pedidos entregados
      const sixMonthsAgo = new Date()
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5)
      sixMonthsAgo.setDate(1)

      const { data: orders } = await supabase
        .from('orders')
        .select('total, created_at, client:clients(name)')
        .eq('status', 'entregado')
        .gte('created_at', sixMonthsAgo.toISOString())

      const monthly: Record<string, number> = {}
      const byClient: Record<string, number> = {}
      for (const o of orders ?? []) {
        const d = new Date(o.created_at)
        const key = d.toLocaleDateString('es-VE', { month: 'short', year: '2-digit' })
        monthly[key] = (monthly[key] ?? 0) + Number(o.total)
        const clientName = (o.client as any)?.name ?? 'Sin cliente'
        byClient[clientName] = (byClient[clientName] ?? 0) + Number(o.total)
      }
      setMonthSales(Object.entries(monthly).map(([month, total]) => ({ month, total })))
      setTopClients(
        Object.entries(byClient)
          .map(([name, total]) => ({ name, total }))
          .sort((a, b) => b.total - a.total)
          .slice(0, 5)
      )

      // Productos más vendidos: de los items de pedidos entregados
      const { data: deliveredOrders } = await supabase
        .from('orders')
        .select('id')
        .eq('status', 'entregado')

      const orderIds = (deliveredOrders ?? []).map((o) => o.id)
      const byProduct: Record<string, { quantity: number; revenue: number }> = {}

      if (orderIds.length > 0) {
        const { data: items } = await supabase
          .from('order_items')
          .select('quantity, subtotal, product:products(name)')
          .in('order_id', orderIds)

        for (const it of items ?? []) {
          const name = (it.product as any)?.name ?? 'Producto eliminado'
          if (!byProduct[name]) byProduct[name] = { quantity: 0, revenue: 0 }
          byProduct[name].quantity += Number(it.quantity)
          byProduct[name].revenue += Number(it.subtotal)
        }
      }
      setTopProducts(
        Object.entries(byProduct)
          .map(([name, v]) => ({ name, ...v }))
          .sort((a, b) => b.quantity - a.quantity)
          .slice(0, 5)
      )

      // Licitaciones: ganadas vs perdidas vs en proceso
      const { data: tenders } = await supabase.from('tenders').select('status')
      const ganadas = (tenders ?? []).filter((t) => t.status === 'ganada').length
      const perdidas = (tenders ?? []).filter((t) => t.status === 'perdida').length
      const enProceso = (tenders ?? []).filter(
        (t) => t.status === 'preparacion' || t.status === 'enviada'
      ).length
      setTenderStats({ ganadas, perdidas, enProceso })

      setLoading(false)
    }
    load()
  }, [])

  const maxMonth = useMemo(
    () => Math.max(1, ...monthSales.map((m) => m.total)),
    [monthSales]
  )
  const maxProduct = useMemo(
    () => Math.max(1, ...topProducts.map((p) => p.quantity)),
    [topProducts]
  )

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-redisteca-blue" />
      </div>
    )
  }

  return (
    <div className="p-4 space-y-5">
      <h1 className="text-xl font-semibold text-gray-800">Reportes</h1>

      <section className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-4 h-4 text-redisteca-blue" />
          <h2 className="font-medium text-gray-800 text-sm">Ventas entregadas (6 meses)</h2>
        </div>
        {monthSales.length === 0 ? (
          <p className="text-sm text-gray-400">Aún no hay pedidos entregados.</p>
        ) : (
          <div className="space-y-2">
            {monthSales.map((m) => (
              <div key={m.month}>
                <div className="flex justify-between text-xs text-gray-500 mb-0.5">
                  <span className="capitalize">{m.month}</span>
                  <span>${m.total.toFixed(0)}</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-redisteca-blue rounded-full"
                    style={{ width: `${(m.total / maxMonth) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Award className="w-4 h-4 text-redisteca-blue" />
          <h2 className="font-medium text-gray-800 text-sm">Productos más vendidos</h2>
        </div>
        {topProducts.length === 0 ? (
          <p className="text-sm text-gray-400">Aún no hay ventas registradas.</p>
        ) : (
          <div className="space-y-2">
            {topProducts.map((p, i) => (
              <div key={p.name}>
                <div className="flex justify-between text-xs text-gray-500 mb-0.5">
                  <span>
                    {i + 1}. {p.name}
                  </span>
                  <span>{p.quantity} uds · ${p.revenue.toFixed(0)}</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-redisteca-red rounded-full"
                    style={{ width: `${(p.quantity / maxProduct) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Users2 className="w-4 h-4 text-redisteca-blue" />
          <h2 className="font-medium text-gray-800 text-sm">Mejores clientes</h2>
        </div>
        {topClients.length === 0 ? (
          <p className="text-sm text-gray-400">Aún no hay ventas registradas.</p>
        ) : (
          <div className="space-y-1.5">
            {topClients.map((c, i) => (
              <div key={c.name} className="flex justify-between text-sm">
                <span className="text-gray-700">
                  {i + 1}. {c.name}
                </span>
                <span className="font-medium text-gray-800">${c.total.toFixed(0)}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="bg-white rounded-xl border border-gray-200 p-4">
        <h2 className="font-medium text-gray-800 text-sm mb-3">Licitaciones</h2>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-green-50 rounded-lg py-3">
            <p className="text-xl font-semibold text-green-700">{tenderStats.ganadas}</p>
            <p className="text-xs text-green-700">Ganadas</p>
          </div>
          <div className="bg-red-50 rounded-lg py-3">
            <p className="text-xl font-semibold text-red-700">{tenderStats.perdidas}</p>
            <p className="text-xs text-red-700">Perdidas</p>
          </div>
          <div className="bg-blue-50 rounded-lg py-3">
            <p className="text-xl font-semibold text-blue-700">{tenderStats.enProceso}</p>
            <p className="text-xs text-blue-700">En proceso</p>
          </div>
        </div>
      </section>
    </div>
  )
}
