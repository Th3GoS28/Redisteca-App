-- ============================================================
-- MIGRACIÓN: gestión de roles y permisos desde la app
-- Ejecuta esto en el SQL Editor de Supabase
-- ============================================================

-- Crea un rol nuevo, vacío (sin permisos todavía)
create or replace function create_role(p_name text, p_description text)
returns uuid
language plpgsql
security definer
as $$
declare
  v_role_id uuid;
begin
  if not has_permission('roles', 'edit') then
    raise exception 'No tienes permiso para crear roles.';
  end if;

  insert into roles (name, description, is_system)
  values (p_name, p_description, false)
  returning id into v_role_id;

  return v_role_id;
end;
$$;

grant execute on function create_role(text, text) to authenticated;

-- Activa/desactiva un permiso específico para un rol
create or replace function set_role_permission(
  p_role_id uuid, p_module text, p_action text, p_enabled boolean
)
returns void
language plpgsql
security definer
as $$
declare
  v_permission_id uuid;
  v_is_system boolean;
begin
  if not has_permission('roles', 'edit') then
    raise exception 'No tienes permiso para modificar roles.';
  end if;

  select is_system into v_is_system from roles where id = p_role_id;
  if v_is_system then
    raise exception 'El rol "Dueño" no se puede modificar — siempre mantiene todos los permisos.';
  end if;

  select id into v_permission_id from permissions where module = p_module and action = p_action;

  if p_enabled then
    insert into role_permissions (role_id, permission_id)
    values (p_role_id, v_permission_id)
    on conflict do nothing;
  else
    delete from role_permissions
    where role_id = p_role_id and permission_id = v_permission_id;
  end if;
end;
$$;

grant execute on function set_role_permission(uuid, text, text, boolean) to authenticated;
