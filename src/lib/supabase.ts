import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Faltan variables de entorno de Supabase. Copia .env.example a .env y completa tus credenciales.'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
