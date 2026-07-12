import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { Loader2, Plus, X, Search, AlertTriangle, Pencil, Camera } from 'lucide-react'

interface Product {
  id: string
  sku: string
  name: string
  description: string | null
  brand: string | null
  unit: string
  cost_price: number
  sale_price: number
  stock_quantity: number
  min_stock: number
  location: string | null
  image_url: string | null
  active: boolean
}

const BRANDS = ['Festo', 'Rosemount', 'Schneider', 'KSB', 'Otro']

export default function Inventario() {
  const can = useAuthStore((s) => s.can)
  const canCreate = can('inventory', 'create')
  const canEdit = can('inventory', 'edit')

  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showLowStockOnly, setShowLowStockOnly] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [showForm, setShowForm] = useState(false)

  async function loadProducts() {
    setLoading(true)
    const { data } = await supabase
      .from('products')
      .select('*')
      .eq('active', true)
      .order('name')
    setProducts((data as Product[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    loadProducts()
  }, [])

  const filtered = useMemo(() => {
    let list = products
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          (p.brand ?? '').toLowerCase().includes(q)
      )
    }
    if (showLowStockOnly) {
      list = list.filter((p) => p.stock_quantity <= p.min_stock)
    }
    return list
  }, [products, search, showLowStockOnly])

  const lowStockCount = products.filter((p) => p.stock_quantity <= p.min_stock).length

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-800">Inventario</h1>
        {canCreate && (
          <button
            onClick={() => {
              setEditing(null)
              setShowForm(true)
            }}
            className="flex items-center gap-1 bg-redisteca-blue text-white text-sm rounded-lg px-3 py-2"
          >
            <Plus className="w-4 h-4" />
            Nuevo
          </button>
        )}
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, SKU o marca..."
            className="w-full rounded-lg border border-gray-300 pl-9 pr-3 py-2 text-sm"
          />
        </div>
        <button
          onClick={() => setShowLowStockOnly((v) => !v)}
          className={`flex items-center gap-1 text-xs rounded-lg px-3 whitespace-nowrap ${
            showLowStockOnly
              ? 'bg-orange-100 text-orange-700'
              : 'bg-gray-100 text-gray-500'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          Stock bajo {lowStockCount > 0 && `(${lowStockCount})`}
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="w-6 h-6 animate-spin text-redisteca-blue" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-center text-gray-400 text-sm py-10">
          No se encontraron productos.
        </p>
      ) : (
        <div className="space-y-2">
          {filtered.map((p) => {
            const lowStock = p.stock_quantity <= p.min_stock
            return (
              <div
                key={p.id}
                className="bg-white rounded-xl border border-gray-200 p-3 flex items-start justify-between"
              >
                <div className="flex items-start gap-3 min-w-0">
                  {p.image_url ? (
                    <img
                      src={p.image_url}
                      alt={p.name}
                      className="w-12 h-12 rounded-lg object-cover shrink-0 bg-gray-100"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                      <Camera className="w-5 h-5 text-gray-300" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="font-medium text-gray-800 truncate">{p.name}</p>
                    <p className="text-xs text-gray-500">
                      SKU: {p.sku} {p.brand && `· ${p.brand}`}
                      {p.location && ` · ${p.location}`}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span
                        className={`text-xs rounded-full px-2 py-0.5 ${
                          lowStock ? 'bg-orange-50 text-orange-700' : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {p.stock_quantity} {p.unit} en stock
                      </span>
                      <span className="text-xs text-gray-500">
                        ${p.sale_price.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
                {canEdit && (
                  <button
                    onClick={() => {
                      setEditing(p)
                      setShowForm(true)
                    }}
                    className="text-gray-400 shrink-0 ml-2"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {showForm && (
        <ProductForm
          product={editing}
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false)
            loadProducts()
          }}
        />
      )}
    </div>
  )
}

function ProductForm({
  product,
  onClose,
  onSaved
}: {
  product: Product | null
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState({
    sku: product?.sku ?? '',
    name: product?.name ?? '',
    description: product?.description ?? '',
    brand: product?.brand ?? BRANDS[0],
    unit: product?.unit ?? 'unidad',
    cost_price: product?.cost_price ?? 0,
    sale_price: product?.sale_price ?? 0,
    stock_quantity: product?.stock_quantity ?? 0,
    min_stock: product?.min_stock ?? 0,
    location: product?.location ?? ''
  })
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(product?.image_url ?? null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function handlePhotoChange(file: File | null) {
    setPhoto(file)
    setPhotoPreview(file ? URL.createObjectURL(file) : product?.image_url ?? null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    let image_url = product?.image_url ?? null
    if (photo) {
      const path = `${form.sku || Date.now()}-${Date.now()}-${photo.name}`
      const { error: uploadError } = await supabase.storage
        .from('product-photos')
        .upload(path, photo)
      if (!uploadError) {
        image_url = supabase.storage.from('product-photos').getPublicUrl(path).data.publicUrl
      }
    }

    const payload = {
      ...form,
      cost_price: Number(form.cost_price),
      sale_price: Number(form.sale_price),
      stock_quantity: Number(form.stock_quantity),
      min_stock: Number(form.min_stock),
      image_url
    }

    const { error } = product
      ? await supabase.from('products').update(payload).eq('id', product.id)
      : await supabase.from('products').insert(payload)

    setSubmitting(false)

    if (error) {
      setError(
        error.message.includes('duplicate')
          ? 'Ya existe un producto con ese SKU.'
          : error.message
      )
      return
    }

    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md p-5 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-800">
            {product ? 'Editar producto' : 'Nuevo producto'}
          </h2>
          <button onClick={onClose}>
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Foto (opcional)
            </label>
            <label className="flex items-center gap-3 border border-dashed border-gray-300 rounded-lg p-2.5 cursor-pointer">
              {photoPreview ? (
                <img
                  src={photoPreview}
                  alt="Vista previa"
                  className="w-12 h-12 rounded-lg object-cover"
                />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center">
                  <Camera className="w-5 h-5 text-gray-300" />
                </div>
              )}
              <span className="text-sm text-gray-500">
                {photo ? photo.name : 'Tomar o adjuntar foto del producto'}
              </span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => handlePhotoChange(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="SKU">
              <input
                required
                value={form.sku}
                onChange={(e) => set('sku', e.target.value)}
                className="input"
                placeholder="Ej. FES-1234"
              />
            </Field>
            <Field label="Marca">
              <select
                value={form.brand}
                onChange={(e) => set('brand', e.target.value)}
                className="input"
              >
                {BRANDS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Nombre">
            <input
              required
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              className="input"
              placeholder="Ej. Válvula solenoide 24V"
            />
          </Field>

          <Field label="Descripción (opcional)">
            <textarea
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              className="input"
              rows={2}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Precio costo">
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.cost_price}
                onChange={(e) => set('cost_price', e.target.value as any)}
                className="input"
              />
            </Field>
            <Field label="Precio venta">
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={form.sale_price}
                onChange={(e) => set('sale_price', e.target.value as any)}
                className="input"
              />
            </Field>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Field label="Stock actual">
              <input
                type="number"
                step="1"
                min="0"
                value={form.stock_quantity}
                onChange={(e) => set('stock_quantity', e.target.value as any)}
                className="input"
              />
            </Field>
            <Field label="Stock mínimo">
              <input
                type="number"
                step="1"
                min="0"
                value={form.min_stock}
                onChange={(e) => set('min_stock', e.target.value as any)}
                className="input"
              />
            </Field>
            <Field label="Unidad">
              <input
                value={form.unit}
                onChange={(e) => set('unit', e.target.value)}
                className="input"
                placeholder="unidad, caja..."
              />
            </Field>
          </div>

          <Field label="Ubicación en almacén (opcional)">
            <input
              value={form.location}
              onChange={(e) => set('location', e.target.value)}
              className="input"
              placeholder="Ej. Estante A-3"
            />
          </Field>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 bg-redisteca-blue text-white rounded-lg py-2.5 font-medium disabled:opacity-60"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {product ? 'Guardar cambios' : 'Crear producto'}
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
