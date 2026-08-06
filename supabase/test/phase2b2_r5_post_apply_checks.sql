-- ============================================================================
-- FASE 2B.2 R5 — POST-APPLY CHECKS (ENTORNO TEMPORAL OR FUTURE GGMPI APPLY)
-- After R5 is committed. Expect all passed = true.
-- ============================================================================

with checks as (
  select
    10 as ord,
    'generate_rpc_exists'::text as check_id,
    to_regprocedure('public.generate_sku_secure(jsonb)') is not null as passed,
    coalesce(to_regprocedure('public.generate_sku_secure(jsonb)')::text, '<missing>') as detail
  union all
  select
    20,
    'complete_rpc_exists',
    to_regprocedure('public.complete_sku_normalization(uuid,jsonb)') is not null,
    coalesce(to_regprocedure('public.complete_sku_normalization(uuid,jsonb)')::text, '<missing>')
  union all
  select
    30,
    'schema_skus_private_exists',
    exists(select 1 from pg_namespace where nspname = 'skus_private'),
    'skus_private'
  union all
  select
    40,
    'request_id_column_exists',
    exists(
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = 'skus_sku_generation_measurement_history'
        and column_name = 'request_id'
        and data_type = 'uuid'
    ),
    'measurement_history.request_id uuid'
  union all
  select
    50,
    'request_id_unique_index_exists',
    to_regclass('public.skus_sku_gen_meas_hist_request_field_uidx') is not null,
    coalesce(to_regclass('public.skus_sku_gen_meas_hist_request_field_uidx')::text, '<missing>')
  union all
  select
    60,
    'fingerprint_hex_constraint_exists',
    exists(
      select 1 from pg_constraint
      where conname = 'skus_sku_generations_fingerprint_hex_chk'
        and convalidated
    ),
    'skus_sku_generations_fingerprint_hex_chk'
  union all
  select
    70,
    'anon_generate_execute_denied',
    not has_function_privilege('anon', 'public.generate_sku_secure(jsonb)', 'EXECUTE'),
    'anon must not EXECUTE generate'
  union all
  select
    80,
    'authenticated_generate_execute',
    has_function_privilege('authenticated', 'public.generate_sku_secure(jsonb)', 'EXECUTE'),
    'authenticated EXECUTE generate'
)
select ord, check_id, passed, detail
from checks
order by ord;
