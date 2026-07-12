-- ============================================================
-- MIGRACIÓN: alertas automáticas diarias por notificación push
-- Ejecuta esto en el SQL Editor de Supabase
--
-- Requiere activar 2 extensiones primero, desde el Dashboard:
-- Database → Extensions → busca y activa "pg_cron" y "pg_net"
-- ============================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Tabla privada (NO expuesta por la API) para guardar la llave de
-- administrador que necesita esta función para llamar a la Edge Function.
-- No lleva RLS con políticas, así que PostgREST no la deja consultar
-- desde el frontend — solo es accesible desde funciones de la base de datos.
create table if not exists app_secrets (
  key text primary key,
  value text not null
);
alter table app_secrets enable row level security;
-- (sin políticas = nadie puede leerla vía API, solo funciones internas)

-- Reemplaza estos dos valores por los tuyos antes de correr esta migración:
--   1. service_role_key: Supabase → Project Settings → API → "service_role" (legacy)
--      o tu "Secret key" nueva (Settings → API Keys → Secret keys)
--   2. project_url: la URL de tu proyecto, ej. https://itvuudytbbkpcfcjjzcg.supabase.co
insert into app_secrets (key, value) values
  ('service_role_key', 'PEGA_AQUI_TU_SERVICE_ROLE_KEY'),
  ('project_url', 'https://itvuudytbbkpcfcjjzcg.supabase.co')
on conflict (key) do update set value = excluded.value;

-- Evita mandar la misma alerta todos los días: solo notifica si no se
-- avisó ya sobre lo mismo en las últimas 20 horas.
create or replace function already_notified_recently(p_type text, p_related_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from notifications
    where type = p_type
      and related_id = p_related_id
      and created_at > now() - interval '20 hours'
  );
$$;

-- Manda una notificación push llamando a la Edge Function "send-push"
create or replace function send_push_notification(
  p_user_id uuid, p_title text, p_body text, p_type text, p_related_type text, p_related_id uuid
)
returns void
language plpgsql
security definer
as $$
declare
  v_url text;
  v_key text;
begin
  select value into v_url from app_secrets where key = 'project_url';
  select value into v_key from app_secrets where key = 'service_role_key';

  perform net.http_post(
    url := v_url || '/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body := jsonb_build_object(
      'user_id', p_user_id,
      'title', p_title,
      'body', p_body,
      'type', p_type,
      'related_type', p_related_type,
      'related_id', p_related_id
    )
  );
end;
$$;

-- Función principal: revisa todo y manda las alertas que hagan falta.
-- Se ejecuta sola todos los días (ver el cron.schedule al final).
create or replace function check_and_send_alerts()
returns void
language plpgsql
security definer
as $$
declare
  v_txn record;
  v_order record;
  v_product record;
  v_notify_user record;
begin
  -- 1) Cuentas por cobrar/pagar que vencen en los próximos 2 días
  for v_txn in
    select t.*, coalesce(t.created_by, (select id from profiles where role_id in
      (select id from roles where name = 'Dueño') limit 1)) as notify_to
    from transactions t
    where t.status = 'pendiente'
      and t.due_date is not null
      and t.due_date <= current_date + interval '2 days'
      and t.due_date >= current_date
  loop
    if not already_notified_recently('cuenta_por_vencer', v_txn.id) and v_txn.notify_to is not null then
      perform send_push_notification(
        v_txn.notify_to,
        case when v_txn.type = 'ingreso' then 'Cuenta por cobrar próxima a vencer'
             else 'Cuenta por pagar próxima a vencer' end,
        coalesce(v_txn.description, 'Monto: $' || v_txn.amount) || ' — vence ' || v_txn.due_date,
        'cuenta_por_vencer', 'transaction', v_txn.id
      );
    end if;
  end loop;

  -- 2) Pedidos listos para entregar (avisa a quien lo creó)
  for v_order in
    select * from orders where status = 'listo' and created_by is not null
  loop
    if not already_notified_recently('entrega_pendiente', v_order.id) then
      perform send_push_notification(
        v_order.created_by,
        'Pedido listo para entregar',
        v_order.order_number || ' está listo — coordina la entrega.',
        'entrega_pendiente', 'order', v_order.id
      );
    end if;
  end loop;

  -- 3) Stock bajo (avisa a todos los que puedan editar inventario)
  for v_product in
    select * from products where active = true and stock_quantity <= min_stock
  loop
    if not already_notified_recently('stock_bajo', v_product.id) then
      for v_notify_user in
        select distinct p.id
        from profiles p
        join role_permissions rp on rp.role_id = p.role_id
        join permissions perm on perm.id = rp.permission_id
        where perm.module = 'inventory' and perm.action = 'edit' and p.active = true
      loop
        perform send_push_notification(
          v_notify_user.id,
          'Stock bajo: ' || v_product.name,
          'Quedan ' || v_product.stock_quantity || ' ' || v_product.unit || ' (mínimo: ' || v_product.min_stock || ')',
          'stock_bajo', 'product', v_product.id
        );
      end loop;
    end if;
  end loop;
end;
$$;

-- Programa la revisión todos los días a las 9:00 AM hora de Venezuela
-- (13:00 UTC, porque Venezuela está en UTC-4)
select cron.schedule(
  'daily-alerts',
  '0 13 * * *',
  $$ select check_and_send_alerts(); $$
);
