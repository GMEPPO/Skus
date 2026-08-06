-- ============================================================================
-- FASE 2B.2 R5 — ROLLBACK CONTROLADO (solo objetos introducidos por R5)
-- NO borra tablas principales ni datos legacy.
-- Usar solo tras APPLY de 20260805150000_phase2b2_generate_and_complete_rpc.sql
-- y solo si hay fallo crítico (ver docs/phase2b2-r5-apply-go-nogo.md).
-- ============================================================================
begin;

-- 1) Revoke EXECUTE on public RPCs
revoke all on function public.generate_sku_secure(jsonb) from public, anon, authenticated;
revoke all on function public.complete_sku_normalization(uuid, jsonb) from public, anon, authenticated;

-- 2) Drop public RPCs
drop function if exists public.generate_sku_secure(jsonb);
drop function if exists public.complete_sku_normalization(uuid, jsonb);

-- 3) Drop private helpers (order: dependents first)
drop function if exists skus_private.build_and_persist_generation(uuid, jsonb, boolean);
drop function if exists skus_private.persist_measurement_history(
  uuid, uuid, uuid, numeric, text, numeric, text, numeric, text
);
drop function if exists skus_private.parse_positive_measure(text);
drop function if exists skus_private.compute_selection_fingerprint(jsonb);
drop function if exists skus_private.json_str(text);
drop function if exists skus_private.sha256_hex(text);
drop function if exists skus_private.pick_designation(text, text, text);
drop function if exists skus_private.norm_text(text);
drop function if exists skus_private.parse_uuid(text);
drop function if exists skus_private.is_uuid(text);

-- 4) Drop request_id unique index
drop index if exists public.skus_sku_gen_meas_hist_request_field_uidx;

-- 5) Drop fingerprint hex constraint
alter table public.skus_sku_generations
  drop constraint if exists skus_sku_generations_fingerprint_hex_chk;

-- 6) Drop request_id column ONLY after fixtures cleanup (manual confirmation)
-- Uncomment after cleaning test measurement history rows that use request_id:
-- alter table public.skus_sku_generation_measurement_history
--   drop column if exists request_id;

-- 7) Drop private schema only if empty / owned by R5 helpers
drop schema if exists skus_private;

-- NOTE: comments on designation*/sequence_value/prefix_snapshot are left in place (harmless).

commit;
