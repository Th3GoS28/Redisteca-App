-- ============================================================
-- MIGRACIÓN: fotos de productos
-- Ejecuta esto en el SQL Editor de Supabase
-- ============================================================

insert into storage.buckets (id, name, public)
values ('product-photos', 'product-photos', true)
on conflict (id) do nothing;

create policy "ver fotos de productos" on storage.objects
  for select using (bucket_id = 'product-photos');

create policy "subir fotos de productos" on storage.objects
  for insert with check (bucket_id = 'product-photos' and auth.role() = 'authenticated');
