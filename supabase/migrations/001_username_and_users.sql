-- ============================================================
-- MIGRACIÓN: username + gestión de usuarios
-- Ejecuta esto en el SQL Editor de Supabase (proyecto ya existente)
-- ============================================================

-- 1. Agrega columna de username al perfil
alter table profiles add column if not exists username text unique;

-- 2. Función pública para resolver username -> email antes de iniciar sesión
--    (necesaria porque el login de Supabase solo acepta correo, no username)
create or replace function email_for_username(p_username text)
returns text
language sql
security definer
stable
as $$
  select email from profiles where username = p_username and active = true;
$$;

-- Permite que cualquiera (incluso sin sesión) llame esta función,
-- ya que se necesita ANTES de poder iniciar sesión.
grant execute on function email_for_username(text) to anon, authenticated;

-- 3. Función para que el listado de usuarios muestre también el nombre del rol
--    (ya cubierto por el join en el frontend, no requiere cambios aquí)

-- 4. Da un username por defecto a los usuarios que ya existen (usando lo que
--    tengan antes de la @ en su correo), para que no quede nadie sin username
update profiles
set username = split_part(email, '@', 1)
where username is null;
