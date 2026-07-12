-- ============================================================
-- MIGRACIÓN: recordatorios de seguimiento a visitas
-- Ejecuta esto en el SQL Editor de Supabase
-- (esta función REEMPLAZA la versión anterior de check_and_send_alerts,
-- agregándole el aviso de seguimiento — lo demás queda igual)
-- ============================================================

create or replace function check_and_send_alerts()
returns void
language plpgsql
security definer
as $$
declare
  v_txn record;
  v_order record;
  v_product record;
  v_visit record;
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

  -- 2) Pedidos listos para entregar
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

  -- 3) Stock bajo
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

  -- 4) Seguimiento de visitas: el "próximo paso" que el instrumentista se
  -- puso a sí mismo ya llegó (o está vencido), y no hay una visita más
  -- reciente a ese cliente que indique que ya le dio seguimiento.
  for v_visit in
    select v.* from visits v
    where v.next_step_date is not null
      and v.next_step_date <= current_date
      and v.created_by is not null
      and not exists (
        select 1 from visits v2
        where v2.client_id = v.client_id and v2.visited_at > v.visited_at
      )
  loop
    if not already_notified_recently('seguimiento_visita', v_visit.id) then
      perform send_push_notification(
        v_visit.created_by,
        'Seguimiento pendiente',
        coalesce(v_visit.next_step, 'Tienes un seguimiento pendiente') ||
          ' — ' || (select name from clients where id = v_visit.client_id),
        'seguimiento_visita', 'visit', v_visit.id
      );
    end if;
  end loop;
end;
$$;
