// @ts-nocheck
// Este archivo corre en Deno (Edge Functions de Supabase), no en Node.
// Los errores de TypeScript de VS Code aquí son falsos positivos: ignóralos.
//
// Edge Function: create-user
// Crea un nuevo usuario (correo + contraseña), le asigna nombre, username
// y rol. Solo permite la operación si quien la llama tiene el permiso
// users.create — se verifica ANTES de usar la llave de administrador.

import { createClient } from 'jsr:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!

Deno.serve(async (req) => {
  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return json({ error: 'No autorizado.' }, 401)
    }

    // Cliente "en nombre de quien llama", para validar su permiso real
    // (respeta RLS, no puede saltárselo)
    const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } }
    })

    const { data: allowed, error: permError } = await callerClient.rpc('has_permission', {
      p_module: 'users',
      p_action: 'create'
    })

    if (permError || !allowed) {
      return json({ error: 'No tienes permiso para crear usuarios.' }, 403)
    }

    const { email, password, full_name, username, role_id } = await req.json()

    if (!email || !password || !full_name) {
      return json({ error: 'Faltan datos obligatorios (correo, contraseña, nombre).' }, 400)
    }

    // Cliente administrador, solo se usa DESPUÉS de confirmar el permiso
    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

    const { data: created, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name }
    })

    if (createError || !created.user) {
      return json({ error: createError?.message ?? 'No se pudo crear el usuario.' }, 400)
    }

    // El trigger de la base ya creó la fila en "profiles" con full_name/email.
    // Ahora completamos username y role_id.
    const { error: updateError } = await adminClient
      .from('profiles')
      .update({ username: username || null, role_id: role_id || null })
      .eq('id', created.user.id)

    if (updateError) {
      return json({ error: `Usuario creado, pero falló asignar rol/username: ${updateError.message}` }, 200)
    }

    return json({ ok: true, user_id: created.user.id })
  } catch (err) {
    return json({ error: String(err) }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })
}
