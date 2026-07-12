// @ts-nocheck
// Este archivo corre en Deno (Edge Functions de Supabase), no en Node.
// Los errores de TypeScript de VS Code aquí son falsos positivos: ignóralos.
//
// Edge Function: manage-user
// Permite editar el rol o el estado (activo/inactivo) de un usuario ya
// existente. Igual que create-user, valida el permiso antes de usar la
// llave de administrador.

import { createClient } from 'jsr:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'No autorizado.' }, 401)

    const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } }
    })

    const { data: allowed, error: permError } = await callerClient.rpc('has_permission', {
      p_module: 'users',
      p_action: 'edit'
    })

    if (permError || !allowed) {
      return json({ error: 'No tienes permiso para editar usuarios.' }, 403)
    }

    const { user_id, role_id, active, full_name, username } = await req.json()
    if (!user_id) return json({ error: 'Falta el id del usuario.' }, 400)

    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

    const updates: Record<string, unknown> = {}
    if (role_id !== undefined) updates.role_id = role_id
    if (active !== undefined) updates.active = active
    if (full_name !== undefined) updates.full_name = full_name
    if (username !== undefined) updates.username = username

    const { error } = await adminClient.from('profiles').update(updates).eq('id', user_id)

    if (error) return json({ error: error.message }, 400)

    return json({ ok: true })
  } catch (err) {
    return json({ error: String(err) }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}
