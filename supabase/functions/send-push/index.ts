// @ts-nocheck
// Este archivo corre en Deno (el runtime de las Edge Functions de Supabase),
// no en Node. Por eso VS Code puede marcar errores en rojo aquí (no reconoce
// "Deno", "jsr:", "npm:") — son falsos positivos, ignóralos. Este archivo no
// se ejecuta con `npm run dev`; se despliega aparte con
// `supabase functions deploy send-push`.
//
// Edge Function: send-push
// Envía una notificación push a un usuario (o a varios) usando Web Push.
// Se invoca desde triggers de base de datos o desde un cron (ver README)
// cuando: se acerca la fecha de una cuenta por cobrar/pagar, un pedido
// está listo para entregar, o el stock de un producto está bajo.
//
// Requiere las variables de entorno (configuradas en Supabase):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:info@redisteca.com)
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from 'jsr:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3'

webpush.setVapidDetails(
  Deno.env.get('VAPID_SUBJECT')!,
  Deno.env.get('VAPID_PUBLIC_KEY')!,
  Deno.env.get('VAPID_PRIVATE_KEY')!
)

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

Deno.serve(async (req) => {
  try {
    const { user_id, title, body, url, type, related_type, related_id } = await req.json()

    // Guarda la notificación en la base para que aparezca en la campanita
    await supabaseAdmin.from('notifications').insert({
      user_id,
      title,
      body,
      type,
      related_type,
      related_id
    })

    // Busca las suscripciones push activas de ese usuario
    const { data: subs } = await supabaseAdmin
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', user_id)

    const payload = JSON.stringify({ title, body, url })

    const results = await Promise.allSettled(
      (subs ?? []).map((s) =>
        webpush.sendNotification(
          {
            endpoint: s.endpoint,
            keys: { p256dh: s.p256dh, auth: s.auth }
          },
          payload
        )
      )
    )

    return new Response(JSON.stringify({ ok: true, sent: results.length }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
})
