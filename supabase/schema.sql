-- ============================================================
-- REDISTECA APP - Esquema de base de datos Supabase
-- Sistema de inventario, cotizaciones, pedidos, CRM y finanzas
-- con roles y permisos personalizados
-- ============================================================

-- Extensiones necesarias
create extension if not exists "uuid-ossp";

-- ============================================================
-- 1. ROLES Y PERMISOS
-- ============================================================

create table roles (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,          -- "Dueño", "Gerente", "Vendedor", "Almacén", "Cobranza"...
  description text,
  is_system boolean default false,    -- true = rol protegido (Dueño), no se puede borrar
  created_at timestamptz default now()
);

-- Catálogo fijo de módulos y acciones posibles (referencia, no tabla estricta)
-- módulos: inventory, quotes, orders, clients, finance, reports, users, roles
-- acciones: view, create, edit, delete, approve, export

create table permissions (
  id uuid primary key default uuid_generate_v4(),
  module text not null,
  action text not null,
  unique(module, action)
);

create table role_permissions (
  role_id uuid references roles(id) on delete cascade,
  permission_id uuid references permissions(id) on delete cascade,
  primary key (role_id, permission_id)
);

-- Perfiles de usuario (extiende auth.users de Supabase)
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  phone text,
  avatar_url text,
  role_id uuid references roles(id),
  active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- 2. CLIENTES (CRM)
-- ============================================================

create table clients (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  rif text,                           -- RIF/identificación fiscal
  phone text,
  email text,
  address text,
  contact_name text,
  notes text,
  active boolean default true,
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- 3. INVENTARIO
-- ============================================================

create table categories (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  parent_id uuid references categories(id)
);

create table products (
  id uuid primary key default uuid_generate_v4(),
  sku text unique not null,
  name text not null,
  description text,
  category_id uuid references categories(id),
  brand text,                         -- Festo, Rosemount, Schneider, KSB, Otro
  unit text default 'unidad',
  cost_price numeric(12,2) default 0,
  sale_price numeric(12,2) default 0,
  stock_quantity numeric(12,2) default 0,
  min_stock numeric(12,2) default 0,  -- para alertas de stock bajo
  location text,                      -- ubicación en almacén
  image_url text,
  active boolean default true,
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table inventory_movements (
  id uuid primary key default uuid_generate_v4(),
  product_id uuid references products(id) not null,
  type text not null check (type in ('entrada','salida','ajuste')),
  quantity numeric(12,2) not null,
  reference_type text,                -- 'pedido', 'cotizacion', 'manual', 'compra'
  reference_id uuid,
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

-- ============================================================
-- 4. COTIZACIONES
-- ============================================================

create table quotes (
  id uuid primary key default uuid_generate_v4(),
  quote_number text unique not null,
  client_id uuid references clients(id) not null,
  status text default 'borrador' check (status in ('borrador','enviada','aprobada','rechazada','convertida')),
  subtotal numeric(12,2) default 0,
  tax numeric(12,2) default 0,
  total numeric(12,2) default 0,
  valid_until date,
  notes text,
  created_by uuid references profiles(id),
  approved_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table quote_items (
  id uuid primary key default uuid_generate_v4(),
  quote_id uuid references quotes(id) on delete cascade,
  product_id uuid references products(id),
  description text not null,
  quantity numeric(12,2) not null,
  unit_price numeric(12,2) not null,
  subtotal numeric(12,2) not null
);

-- ============================================================
-- 5. PEDIDOS
-- ============================================================

create table orders (
  id uuid primary key default uuid_generate_v4(),
  order_number text unique not null,
  quote_id uuid references quotes(id),
  client_id uuid references clients(id) not null,
  status text default 'pendiente' check (status in ('pendiente','procesando','listo','entregado','cancelado')),
  delivery_date date,
  total numeric(12,2) default 0,
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table order_items (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid references orders(id) on delete cascade,
  product_id uuid references products(id),
  quantity numeric(12,2) not null,
  delivered_quantity numeric(12,2) default 0,
  unit_price numeric(12,2) not null,
  subtotal numeric(12,2) not null
);

-- ============================================================
-- 6. FINANZAS (ingresos, egresos, cuentas por cobrar/pagar)
-- ============================================================

create table transactions (
  id uuid primary key default uuid_generate_v4(),
  type text not null check (type in ('ingreso','egreso')),
  category text,                      -- 'venta', 'compra_inventario', 'servicio', 'nomina', etc.
  amount numeric(12,2) not null,
  description text,
  related_client_id uuid references clients(id),
  related_order_id uuid references orders(id),
  due_date date,                      -- fecha de vencimiento (cuenta por cobrar/pagar)
  paid_date date,
  status text default 'pendiente' check (status in ('pendiente','pagado','vencido')),
  payment_method text,
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- 7. NOTIFICACIONES PUSH
-- ============================================================

create table push_subscriptions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  device_type text,                   -- 'ios', 'android', 'desktop'
  created_at timestamptz default now()
);

create table notifications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references profiles(id) on delete cascade,
  title text not null,
  body text,
  type text,                          -- 'cuenta_por_cobrar', 'cuenta_por_pagar', 'entrega_pendiente', 'stock_bajo'
  related_type text,
  related_id uuid,
  read boolean default false,
  created_at timestamptz default now()
);

-- ============================================================
-- 8. FUNCIÓN AUXILIAR: ¿el usuario actual tiene este permiso?
-- ============================================================

create or replace function has_permission(p_module text, p_action text)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1
    from profiles p
    join role_permissions rp on rp.role_id = p.role_id
    join permissions perm on perm.id = rp.permission_id
    where p.id = auth.uid()
      and perm.module = p_module
      and perm.action = p_action
      and p.active = true
  );
$$;

-- ============================================================
-- 9. ROW LEVEL SECURITY
-- ============================================================

alter table profiles enable row level security;
alter table roles enable row level security;
alter table permissions enable row level security;
alter table role_permissions enable row level security;
alter table clients enable row level security;
alter table categories enable row level security;
alter table products enable row level security;
alter table inventory_movements enable row level security;
alter table quotes enable row level security;
alter table quote_items enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table transactions enable row level security;
alter table notifications enable row level security;
alter table push_subscriptions enable row level security;

-- Todo usuario autenticado puede ver su propio perfil
create policy "usuarios ven su propio perfil" on profiles
  for select using (auth.uid() = id);

-- Quien tenga permiso users.view puede ver todos los perfiles
create policy "ver todos los perfiles con permiso" on profiles
  for select using (has_permission('users','view'));

create policy "editar perfiles con permiso" on profiles
  for update using (has_permission('users','edit') or auth.uid() = id);

-- Roles: todos los autenticados pueden leer (para mostrar nombres), solo permiso 'roles' gestiona
create policy "leer roles" on roles for select using (auth.role() = 'authenticated');
create policy "gestionar roles" on roles for all using (has_permission('roles','edit'));

create policy "leer permisos" on permissions for select using (auth.role() = 'authenticated');
create policy "leer role_permissions" on role_permissions for select using (auth.role() = 'authenticated');
create policy "gestionar role_permissions" on role_permissions for all using (has_permission('roles','edit'));

-- Clientes
create policy "ver clientes" on clients for select using (has_permission('clients','view'));
create policy "crear clientes" on clients for insert with check (has_permission('clients','create'));
create policy "editar clientes" on clients for update using (has_permission('clients','edit'));
create policy "borrar clientes" on clients for delete using (has_permission('clients','delete'));

-- Inventario
create policy "ver categorias" on categories for select using (auth.role() = 'authenticated');
create policy "gestionar categorias" on categories for all using (has_permission('inventory','edit'));

create policy "ver productos" on products for select using (has_permission('inventory','view'));
create policy "crear productos" on products for insert with check (has_permission('inventory','create'));
create policy "editar productos" on products for update using (has_permission('inventory','edit'));
create policy "borrar productos" on products for delete using (has_permission('inventory','delete'));

create policy "ver movimientos" on inventory_movements for select using (has_permission('inventory','view'));
create policy "crear movimientos" on inventory_movements for insert with check (has_permission('inventory','edit'));

-- Cotizaciones
create policy "ver cotizaciones" on quotes for select using (has_permission('quotes','view'));
create policy "crear cotizaciones" on quotes for insert with check (has_permission('quotes','create'));
create policy "editar cotizaciones" on quotes for update using (has_permission('quotes','edit'));
create policy "aprobar cotizaciones" on quotes for update using (has_permission('quotes','approve'));
create policy "borrar cotizaciones" on quotes for delete using (has_permission('quotes','delete'));

create policy "ver items cotizacion" on quote_items for select using (has_permission('quotes','view'));
create policy "gestionar items cotizacion" on quote_items for all using (has_permission('quotes','edit'));

-- Pedidos
create policy "ver pedidos" on orders for select using (has_permission('orders','view'));
create policy "crear pedidos" on orders for insert with check (has_permission('orders','create'));
create policy "editar pedidos" on orders for update using (has_permission('orders','edit'));
create policy "borrar pedidos" on orders for delete using (has_permission('orders','delete'));

create policy "ver items pedido" on order_items for select using (has_permission('orders','view'));
create policy "gestionar items pedido" on order_items for all using (has_permission('orders','edit'));

-- Finanzas
create policy "ver finanzas" on transactions for select using (has_permission('finance','view'));
create policy "crear finanzas" on transactions for insert with check (has_permission('finance','create'));
create policy "editar finanzas" on transactions for update using (has_permission('finance','edit'));
create policy "borrar finanzas" on transactions for delete using (has_permission('finance','delete'));

-- Notificaciones: cada usuario ve solo las suyas
create policy "ver mis notificaciones" on notifications for select using (auth.uid() = user_id);
create policy "marcar mis notificaciones" on notifications for update using (auth.uid() = user_id);
create policy "sistema crea notificaciones" on notifications for insert with check (true);

create policy "gestionar mi push subscription" on push_subscriptions for all using (auth.uid() = user_id);

-- ============================================================
-- 10. SEED: catálogo de permisos y rol Dueño con todo
-- ============================================================

insert into permissions (module, action) values
  ('inventory','view'),('inventory','create'),('inventory','edit'),('inventory','delete'),
  ('quotes','view'),('quotes','create'),('quotes','edit'),('quotes','delete'),('quotes','approve'),
  ('orders','view'),('orders','create'),('orders','edit'),('orders','delete'),
  ('clients','view'),('clients','create'),('clients','edit'),('clients','delete'),
  ('finance','view'),('finance','create'),('finance','edit'),('finance','delete'),
  ('reports','view'),('reports','export'),
  ('users','view'),('users','create'),('users','edit'),('users','delete'),
  ('roles','view'),('roles','edit');

insert into roles (name, description, is_system) values
  ('Dueño', 'Acceso total al sistema', true),
  ('Gerente', 'Gestión operativa, sin administración de usuarios', false),
  ('Vendedor', 'Cotizaciones, pedidos y clientes', false),
  ('Almacén', 'Gestión de inventario', false),
  ('Cobranza', 'Gestión de finanzas y cuentas por cobrar', false);

-- Dueño: todos los permisos
insert into role_permissions (role_id, permission_id)
select (select id from roles where name = 'Dueño'), id from permissions;

-- Gerente: todo menos usuarios/roles
insert into role_permissions (role_id, permission_id)
select (select id from roles where name = 'Gerente'), id from permissions
where module not in ('users','roles');

-- Vendedor: cotizaciones, pedidos, clientes (ver inventario, sin editar)
insert into role_permissions (role_id, permission_id)
select (select id from roles where name = 'Vendedor'), id from permissions
where (module in ('quotes','orders','clients') and action in ('view','create','edit'))
   or (module = 'inventory' and action = 'view');

-- Almacén: inventario completo, ver pedidos
insert into role_permissions (role_id, permission_id)
select (select id from roles where name = 'Almacén'), id from permissions
where module = 'inventory'
   or (module = 'orders' and action = 'view');

-- Cobranza: finanzas completo, ver clientes y pedidos
insert into role_permissions (role_id, permission_id)
select (select id from roles where name = 'Cobranza'), id from permissions
where module = 'finance'
   or (module in ('clients','orders') and action = 'view');

-- ============================================================
-- 11. TRIGGER: crear perfil automáticamente al registrar usuario
-- ============================================================

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email), new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
