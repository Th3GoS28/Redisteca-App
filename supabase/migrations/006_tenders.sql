-- ============================================================
-- MIGRACIÓN: licitaciones
-- Ejecuta esto en el SQL Editor de Supabase
-- ============================================================

create table if not exists tenders (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  client_id uuid references clients(id),
  deadline_date date,
  status text default 'preparacion' check (status in ('preparacion','enviada','ganada','perdida')),
  documents_required text,
  competitors text,
  quote_id uuid references quotes(id),
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table tenders enable row level security;

-- Reutiliza los permisos de "quotes" (una licitación es, en el fondo,
-- una cotización con reglas de negocio distintas)
create policy "ver licitaciones" on tenders for select using (has_permission('quotes','view'));
create policy "crear licitaciones" on tenders for insert with check (has_permission('quotes','create'));
create policy "editar licitaciones" on tenders for update using (has_permission('quotes','edit'));
create policy "borrar licitaciones" on tenders for delete using (has_permission('quotes','delete'));
