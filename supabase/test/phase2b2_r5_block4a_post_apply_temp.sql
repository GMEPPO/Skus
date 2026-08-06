-- ============================================================================
-- FASE 2B.2 R5 — BLOQUE 4A
-- POST-APPLY PREFLIGHT EN ENTORNO TEMPORAL (NO GGMPI)
-- ============================================================================

with checks as (
  select
    10 as ord,
    'generate_rpc_exists'::text as check_id,
    pg_catalog.to_regprocedure(
      'public.generate_sku_secure(jsonb)'
    ) is not null as passed,
    coalesce(
      pg_catalog.to_regprocedure(
        'public.generate_sku_secure(jsonb)'
      )::text,
      '<missing>'
    ) as detail

  union all

  select
    20,
    'complete_rpc_exists',
    pg_catalog.to_regprocedure(
      'public.complete_sku_normalization(uuid,jsonb)'
    ) is not null,
    coalesce(
      pg_catalog.to_regprocedure(
        'public.complete_sku_normalization(uuid,jsonb)'
      )::text,
      '<missing>'
    )

  union all

  select
    30,
    'authenticated_generate_execute',
    pg_catalog.has_function_privilege(
      'authenticated',
      'public.generate_sku_secure(jsonb)',
      'EXECUTE'
    ),
    'authenticated EXECUTE generate_sku_secure'

  union all

  select
    40,
    'anon_generate_execute_denied',
    not pg_catalog.has_function_privilege(
      'anon',
      'public.generate_sku_secure(jsonb)',
      'EXECUTE'
    ),
    'anon must not execute generate_sku_secure'

  union all

  select
    50,
    'authenticated_complete_execute',
    pg_catalog.has_function_privilege(
      'authenticated',
      'public.complete_sku_normalization(uuid,jsonb)',
      'EXECUTE'
    ),
    'authenticated EXECUTE complete_sku_normalization'

  union all

  select
    60,
    'anon_complete_execute_denied',
    not pg_catalog.has_function_privilege(
      'anon',
      'public.complete_sku_normalization(uuid,jsonb)',
      'EXECUTE'
    ),
    'anon must not execute complete_sku_normalization'

  union all

  select
    70,
    'authenticated_private_schema_usage_denied',
    not pg_catalog.has_schema_privilege(
      'authenticated',
      'skus_private',
      'USAGE'
    ),
    'authenticated must not have USAGE on skus_private'

  union all

  select
    80,
    'anon_private_schema_usage_denied',
    not pg_catalog.has_schema_privilege(
      'anon',
      'skus_private',
      'USAGE'
    ),
    'anon must not have USAGE on skus_private'

  union all

  select
    90,
    'request_id_column_exists',
    exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name =
          'skus_sku_generation_measurement_history'
        and column_name = 'request_id'
        and data_type = 'uuid'
    ),
    'measurement_history.request_id uuid'

  union all

  select
    100,
    'request_id_unique_index_exists',
    pg_catalog.to_regclass(
      'public.skus_sku_gen_meas_hist_request_field_uidx'
    ) is not null,
    coalesce(
      pg_catalog.to_regclass(
        'public.skus_sku_gen_meas_hist_request_field_uidx'
      )::text,
      '<missing>'
    )

  union all

  select
    110,
    'fingerprint_hex_constraint_exists',
    exists (
      select 1
      from pg_catalog.pg_constraint con
      where con.conrelid =
        'public.skus_sku_generations'::pg_catalog.regclass
        and con.conname =
          'skus_sku_generations_fingerprint_hex_chk'
        and con.convalidated
    ),
    'fingerprint hex constraint validated'
)
select ord, check_id, passed, detail
from checks
order by ord;
