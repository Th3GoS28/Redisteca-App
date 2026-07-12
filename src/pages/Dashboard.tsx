import { useEffect, useState } from 'react'
import { useAuthStore } from '../store/authStore'
import { supabase } from '../lib/supabase'

export default function Dashboard() {
  const profile = useAuthStore((s) => s.profile)
  const [lowStockCount, setLowStockCount] = useState<number | null>(null)
  const [porCobrar, setPorCobrar] = useState<number | null>(null)
  const [porPagar, setPorPagar] = useState<number | null>(null)
  const [pedidosPendientes, setPedidosPendientes] = useState<number | null>(null)

  const displayName =
    profile?.full_name && profile.full_name !== profile.email
      ? profile.full_name.split(' ')[0]
      : profile?.username || profile?.email

  useEffect(() => {
    async function loadSummary() {
      const { data: products } = await supabase
        .from('products')
        .select('id, stock_quantity, min_stock')
        .eq('active', true)
      setLowStockCount((products ?? []).filter((p) => p.stock_quantity <= p.min_stock).length)

      const { data: transactions } = await supabase
        .from('transactions')
        .select('type, amount, status')
        .neq('status', 'pagado')
      setPorCobrar(
        (transactions ?? [])
          .filter((t) => t.type === 'ingreso')
          .reduce((s, t) => s + Number(t.amount), 0)
      )
      setPorPagar(
        (transactions ?? [])
          .filter((t) => t.type === 'egreso')
          .reduce((s, t) => s + Number(t.amount), 0)
      )

      const { count } = await supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .in('status', ['pendiente', 'procesando', 'listo'])
      setPedidosPendientes(count ?? 0)
    }
    loadSummary()
  }, [])

  return (
    <div className="p-4 space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-gray-800">Hola, {displayName}</h1>
        <p className="text-gray-500 text-sm">Este es tu resumen de hoy</p>
      </div>

      {/* Estas tarjetas se conectarán a datos reales de Supabase en la siguiente fase */}
      <div className="grid grid-cols-2 gap-3">
        <SummaryCard
          label="Cuentas por cobrar"
          value={porCobrar === null ? '—' : `$${porCobrar.toFixed(0)}`}
          tone="amber"
        />
        <SummaryCard
          label="Cuentas por pagar"
          value={porPagar === null ? '—' : `$${porPagar.toFixed(0)}`}
          tone="red"
        />
        <SummaryCard
          label="Pedidos pendientes"
          value={pedidosPendientes === null ? '—' : String(pedidosPendientes)}
          tone="blue"
        />
        <SummaryCard
          label="Stock bajo"
          value={lowStockCount === null ? '—' : String(lowStockCount)}
          tone="orange"
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <p className="text-sm text-gray-500">
          Próximamente aquí verás notificaciones de entregas pendientes, pagos
          por vencer y alertas de inventario en tiempo real.
        </p>
      </div>
    </div>
  )
}

function SummaryCard({
  label,
  value,
  tone
}: {
  label: string
  value: string
  tone: 'amber' | 'red' | 'blue' | 'orange'
}) {
  const toneMap = {
    amber: 'bg-amber-50 text-amber-700',
    red: 'bg-red-50 text-red-700',
    blue: 'bg-blue-50 text-blue-700',
    orange: 'bg-orange-50 text-orange-700'
  }
  return (
    <div className={`rounded-xl p-4 ${toneMap[tone]}`}>
      <p className="text-2xl font-semibold">{value}</p>
      <p className="text-xs mt-1">{label}</p>
    </div>
  )
}
