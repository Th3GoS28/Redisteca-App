-- ============================================================
-- MIGRACIÓN: entrega de pedidos con descuento de stock automático
-- Ejecuta esto en el SQL Editor de Supabase
-- ============================================================

create or replace function deliver_order(p_order_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_item record;
begin
  if not has_permission('orders', 'edit') then
    raise exception 'No tienes permiso para entregar pedidos.';
  end if;

  for v_item in
    select oi.id, oi.product_id, oi.quantity
    from order_items oi
    where oi.order_id = p_order_id and oi.product_id is not null
  loop
    update products
    set stock_quantity = stock_quantity - v_item.quantity
    where id = v_item.product_id;

    insert into inventory_movements (product_id, type, quantity, reference_type, reference_id, created_by)
    values (v_item.product_id, 'salida', v_item.quantity, 'pedido', p_order_id, auth.uid());

    update order_items
    set delivered_quantity = quantity
    where id = v_item.id;
  end loop;

  update orders set status = 'entregado', updated_at = now() where id = p_order_id;
end;
$$;

grant execute on function deliver_order(uuid) to authenticated;
