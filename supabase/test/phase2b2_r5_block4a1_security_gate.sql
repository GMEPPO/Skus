-- ============================================================================
-- FASE 2B.2 R5 — BLOQUE 4A.1 SECURITY GATE (GGMPI post-APPLY)
-- READ ONLY. Expect 13/13 passed = true before Auth runner.
-- ============================================================================

with
helpers as (
  select p.oid, n.nspname, p.proname,
         pg_catalog.pg_get_function_identity_arguments(p.oid) as args,
         pg_catalog.pg_get_userbyid(p.proowner) as owner
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'skus_private'
),
rpcs as (
  select p.oid, n.nspname, p.proname,
         pg_catalog.pg_get_function_identity_arguments(p.oid) as args,
         pg_catalog.pg_get_userbyid(p.proowner) as owner
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in ('generate_sku_secure', 'complete_sku_normalization')
),
checks as (
  select 10 as ord, 'generate_rpc_exists'::text as check_id,
    to_regprocedure('public.generate_sku_secure(jsonb)') is not null as passed,
    coalesce(to_regprocedure('public.generate_sku_secure(jsonb)')::text, '<missing>') as detail

  union all
  select 20, 'complete_rpc_exists',
    to_regprocedure('public.complete_sku_normalization(uuid,jsonb)') is not null,
    coalesce(to_regprocedure('public.complete_sku_normalization(uuid,jsonb)')::text, '<missing>')

  union all
  select 30, 'schema_skus_private_exists',
    exists(select 1 from pg_namespace where nspname = 'skus_private'),
    'skus_private'

  union all
  select 40, 'request_id_column_uuid',
    exists(
      select 1 from information_schema.columns
      where table_schema='public'
        and table_name='skus_sku_generation_measurement_history'
        and column_name='request_id' and data_type='uuid'
    ),
    'request_id uuid'

  union all
  select 50, 'request_id_unique_index',
    to_regclass('public.skus_sku_gen_meas_hist_request_field_uidx') is not null,
    coalesce(to_regclass('public.skus_sku_gen_meas_hist_request_field_uidx')::text, '<missing>')

  union all
  select 60, 'fingerprint_hex_constraint',
    exists(
      select 1 from pg_constraint
      where conname='skus_sku_generations_fingerprint_hex_chk' and convalidated
    ),
    'fingerprint hex chk'

  union all
  select 70, 'anon_generate_execute_denied',
    not has_function_privilege('anon', 'public.generate_sku_secure(jsonb)', 'EXECUTE'),
    'anon !EXECUTE generate'

  union all
  select 80, 'authenticated_generate_execute',
    has_function_privilege('authenticated', 'public.generate_sku_secure(jsonb)', 'EXECUTE'),
    'authenticated EXECUTE generate'

  union all
  select 90, 'authenticated_complete_execute',
    has_function_privilege('authenticated', 'public.complete_sku_normalization(uuid,jsonb)', 'EXECUTE'),
    'authenticated EXECUTE complete'

  union all
  select 100, 'authenticated_private_usage_denied',
    not has_schema_privilege('authenticated', 'skus_private', 'USAGE'),
    'authenticated !USAGE skus_private'

  union all
  select 110, 'authenticated_private_create_denied',
    not has_schema_privilege('authenticated', 'skus_private', 'CREATE'),
    'authenticated !CREATE skus_private'

  union all
  select 120, 'anon_authenticated_helpers_execute_denied',
    not exists (
      select 1 from helpers h
      where has_function_privilege('anon', h.oid, 'EXECUTE')
         or has_function_privilege('authenticated', h.oid, 'EXECUTE')
    ),
    coalesce(
      (select string_agg(format('%s(%s)', proname, args), ', ')
       from helpers h
       where has_function_privilege('anon', h.oid, 'EXECUTE')
          or has_function_privilege('authenticated', h.oid, 'EXECUTE')),
      'no helper EXECUTE for anon/authenticated'
    )

  union all
  select 130, 'rpc_and_helper_owners_not_client_roles',
    not exists (
      select 1 from (
        select owner from helpers
        union all
        select owner from rpcs
      ) o
      where o.owner in ('anon', 'authenticated')
    )
    and exists (select 1 from helpers)
    and exists (select 1 from rpcs),
    coalesce(
      (select string_agg(distinct owner, ', ') from (
         select owner from helpers union all select owner from rpcs
       ) x),
      '<missing owners>'
    )
)
select ord, check_id, passed, detail
from checks
order by ord;
