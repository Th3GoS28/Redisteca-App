-- ============================================================
-- MIGRACIÓN: firma digital de entrega
-- Ejecuta esto en el SQL Editor de Supabase
-- ============================================================

alter table orders add column if not exists signature_data text;
alter table orders add column if not exists received_by text;
