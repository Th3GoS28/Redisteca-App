import { useAuthStore } from '../store/authStore'

export default function Dashboard() {
  const profile = useAuthStore((s) => s.profile)

  return (
    <div className="p-4 space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-gray-800">
          Hola, {profile?.full_name?.split(' ')[0]}
        </h1>
        <p className="text-gray-500 text-sm">Este es tu resumen de hoy</p>
      </div>

      {/* Estas tarjetas se conectarán a datos reales de Supabase en la siguiente fase */}
      <div className="grid grid-cols-2 gap-3">
        <SummaryCard label="Cuentas por cobrar" value="—" tone="amber" />
        <SummaryCard label="Cuentas por pagar" value="—" tone="red" />
        <SummaryCard label="Pedidos pendientes" value="—" tone="blue" />
        <SummaryCard label="Stock bajo" value="—" tone="orange" />
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
