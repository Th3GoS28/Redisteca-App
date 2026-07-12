// Guarda una copia local de datos que se consultan seguido en campo
// (productos, clientes), para poder seguir trabajando sin señal.
// No reemplaza al servidor: cada vez que hay internet se refresca sola.

export function saveCache<T>(key: string, data: T) {
  try {
    localStorage.setItem(`redisteca_cache_${key}`, JSON.stringify({ data, savedAt: Date.now() }))
  } catch {
    // Si el almacenamiento está lleno, simplemente no cacheamos — no es crítico.
  }
}

export function loadCache<T>(key: string): { data: T; savedAt: number } | null {
  try {
    const raw = localStorage.getItem(`redisteca_cache_${key}`)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}
