-- Post-harness R5.1: verify ROLLBACK left no R5 objects behind.
-- Run on GGMPI AFTER phase2b2_r5_golden_rollback.sql succeeded.
-- Expect: all present = false (objects created only by harness must not persist).

select * from (
  select 1 as ord, 'schema_skus_private' as check_id,
    exists(select 1 from pg_namespace where nspname = 'skus_private') as present
  union all
  select 2, 'fn_compute_selection_fingerprint',
    to_regprocedure('skus_private.compute_selection_fingerprint(jsonb)') is not null
  union all
  select 3, 'fn_generate_sku_secure',
    to_regprocedure('public.generate_sku_secure(jsonb)') is not null
  union all
  select 4, 'fn_complete_sku_normalization',
    to_regprocedure('public.complete_sku_normalization(uuid,jsonb)') is not null
  union all
  select 5, 'col_request_id',
    exists(
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = 'skus_sku_generation_measurement_history'
        and column_name = 'request_id'
    )
  union all
  select 6, 'idx_request_field',
    exists(
      select 1 from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = 'skus_sku_gen_meas_hist_request_field_uidx'
    )
  union all
  select 7, 'chk_fingerprint_hex',
    exists(
      select 1 from pg_constraint
      where conname = 'skus_sku_generations_fingerprint_hex_chk'
    )
) q
order by ord;
