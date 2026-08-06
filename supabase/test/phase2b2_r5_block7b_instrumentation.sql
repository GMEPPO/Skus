-- ============================================================================
-- FASE 2B.2 R5 — Bloque 7B: instrumentación TEMPORAL (GGMPI ventana controlada)
--
-- USO:
--   1) Sustituir :REQUEST_ID por el UUID del run (sin comillas extras en el replace).
--   2) Ejecutar sección INSTALL.
--   3) Correr el runner PowerShell (caso lock_expired_midway).
--   4) Ejecutar sección REMOVE (obligatorio, even on failure).
--   5) Ejecutar sección VERIFY — debe devolver 0 filas en ambos selects.
--
-- Autorizado por supervisor: trigger scoped a request_id, pg_sleep > lock TTL,
-- sin grants a public/anon/authenticated, eliminar siempre.
-- ============================================================================

-- ========== INSTALL ==========
-- Reemplazar 00000000-0000-0000-0000-000000000001 por el requestId del test.

create or replace function skus_private.phase2b2_r5_7b_sleep_on_history()
returns trigger
language plpgsql
security definer
set search_path = public, skus_private, pg_temp
as $$
begin
  -- Solo el requestId del run de prueba dispara el delay.
  if NEW.request_id = '00000000-0000-0000-0000-000000000001'::uuid then
    perform pg_sleep(4);
  end if;
  return NEW;
end;
$$;

revoke all on function skus_private.phase2b2_r5_7b_sleep_on_history() from public;
revoke all on function skus_private.phase2b2_r5_7b_sleep_on_history() from anon;
revoke all on function skus_private.phase2b2_r5_7b_sleep_on_history() from authenticated;

drop trigger if exists phase2b2_r5_7b_sleep_trg
  on public.skus_sku_generation_measurement_history;

create trigger phase2b2_r5_7b_sleep_trg
  before insert on public.skus_sku_generation_measurement_history
  for each row
  execute function skus_private.phase2b2_r5_7b_sleep_on_history();

-- ========== REMOVE ==========
-- drop trigger if exists phase2b2_r5_7b_sleep_trg
--   on public.skus_sku_generation_measurement_history;
-- drop function if exists skus_private.phase2b2_r5_7b_sleep_on_history();

-- ========== VERIFY (post-REMOVE; expect 0 rows each) ==========
-- select t.tgname, pg_catalog.pg_get_triggerdef(t.oid) as definition
-- from pg_catalog.pg_trigger t
-- where t.tgrelid = 'public.skus_sku_generation_measurement_history'::regclass
--   and not t.tgisinternal
--   and t.tgname = 'phase2b2_r5_7b_sleep_trg'
-- order by t.tgname;
--
-- select n.nspname, p.proname, pg_catalog.pg_get_function_identity_arguments(p.oid)
-- from pg_catalog.pg_proc p
-- join pg_catalog.pg_namespace n on n.oid = p.pronamespace
-- where n.nspname = 'skus_private'
--   and (
--     p.proname ilike '%test%'
--     or p.proname ilike '%sleep%'
--     or p.proname ilike '%phase2b2%'
--     or p.proname ilike '%delay%'
--   )
-- order by p.proname;
