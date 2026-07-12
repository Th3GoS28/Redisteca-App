import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { saveCache, loadCache } from '../lib/localCache'
import { isOnline } from '../lib/offlineQueue'
import { Search, WifiOff, Package } from 'lucide-react'

interface Product {
  id: string
  sku: string
  name: string
  description: string | null
  brand: string | null
  unit: string
  sale_price: number
  stock_quantity: number
  image_url: string | null
}

export default function Catalogo() {
  const [products, setProducts] = useState<Product[]>([])
  const [search, setSearch] = useState('')
  const [offline, setOffline] = useState(!isOnline())
  const [cacheDate, setCacheDate] = useState<number | null>(null)

  useEffect(() => {
    async function load() {
      if (!isOnline()) {
        const cached = loadCache<Product[]>('catalog')
        setProducts(cached?.data ?? [])
        setCacheDate(cached?.savedAt ?? null)
        setOffline(true)
        return
      }
      const { data } = await supabase
        .from('products')
        .select('id, sku, name, description, brand, unit, sale_price, stock_quantity, image_url')
        .eq('active', true)
        .order('name')
      const list = (data as Product[]) ?? []
      setProducts(list)
      saveCache('catalog', list)
      setOffline(false)
    }
    load()

    const onOffline = () => setOffline(true)
    const onOnline = () => {
      setOffline(false)
      load()
    }
    window.addEventListener('offline', onOffline)
    window.addEventListener('online', onOnline)
    return () => {
      window.removeEventListener('offline', onOffline)
      window.removeEventListener('online', onOnline)
    }
  }, [])

  const filtered = useMemo(() => {
    if (!search.trim()) return products
    const q = search.trim().toLowerCase()
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.brand ?? '').toLowerCase().includes(q)
    )
  }, [products, search])

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-semibold text-gray-800">Catálogo</h1>

      {offline && (
        <div className="flex items-center gap-2 bg-amber-50 text-amber-700 rounded-lg p-2.5 text-xs">
          <WifiOff className="w-4 h-4 shrink-0" />
          <span>
            Sin señal — mostrando la última copia guardada
            {cacheDate && ` (${new Date(cacheDate).toLocaleDateString()})`}. Los precios podrían
            no estar actualizados.
          </span>
        </div>
      )}

      <div className="relative">
        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar producto, SKU o marca..."
          className="w-full rounded-lg border border-gray-300 pl-9 pr-3 py-2 text-sm"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-10">
          <Package className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-gray-400 text-sm">No se encontraron productos.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {filtered.map((p) => (
            <div key={p.id} className="bg-white rounded-xl border border-gray-200 p-3">
              {p.image_url ? (
                <img
                  src={p.image_url}
                  alt={p.name}
                  className="w-full h-24 object-cover rounded-lg mb-2 bg-gray-100"
                />
              ) : (
                <div className="w-full h-24 rounded-lg bg-gray-100 mb-2" />
              )}
              {p.brand && (
                <span className="text-[10px] uppercase tracking-wide text-redisteca-blue font-medium">
                  {p.brand}
                </span>
              )}
              <p className="font-medium text-gray-800 text-sm leading-tight mt-0.5">{p.name}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">SKU: {p.sku}</p>
              {p.description && (
                <p className="text-[11px] text-gray-500 mt-1 line-clamp-2">{p.description}</p>
              )}
              <p className="text-sm font-semibold text-gray-800 mt-2">
                ${p.sale_price.toFixed(2)}
              </p>
              <p
                className={`text-[11px] mt-0.5 ${
                  p.stock_quantity > 0 ? 'text-green-600' : 'text-red-500'
                }`}
              >
                {p.stock_quantity > 0 ? `${p.stock_quantity} ${p.unit} disponibles` : 'Sin stock'}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
