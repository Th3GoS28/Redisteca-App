-- ============================================================
-- MIGRACIÓN: bitácora de visitas (CRM de campo)
-- Ejecuta esto en el SQL Editor de Supabase
-- ============================================================

create table if not exists visits (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid references clients(id) not null,
  visited_at timestamptz default now(),
  contact_name text,
  summary text not null,
  next_step text,
  next_step_date date,
  photo_url text,
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

alter table visits enable row level security;

-- Reutiliza los permisos del módulo "clients" (no crea uno nuevo)
create policy "ver visitas" on visits for select using (has_permission('clients','view'));
create policy "crear visitas" on visits for insert with check (
  has_permission('clients','create') or has_permission('clients','edit')
);
create policy "editar visitas" on visits for update using (
  has_permission('clients','edit') or created_by = auth.uid()
);
create policy "borrar visitas" on visits for delete using (has_permission('clients','delete'));

-- Bucket de almacenamiento para las fotos de visitas (opcional, solo si
-- quieres adjuntar fotos). Si prefieres omitir fotos por ahora, puedes
-- saltarte este bloque sin problema.
insert into storage.buckets (id, name, public)
values ('visit-photos', 'visit-photos', true)
on conflict (id) do nothing;

create policy "ver fotos de visitas" on storage.objects
  for select using (bucket_id = 'visit-photos');

create policy "subir fotos de visitas" on storage.objects
  for insert with check (bucket_id = 'visit-photos' and auth.role() = 'authenticated');
