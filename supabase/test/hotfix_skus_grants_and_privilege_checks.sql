-- Hotfix privilegios Fase 1A (solo skus_* nuevas tablas)
-- Idempotente. No toca tablas ajenas.
-- Pegar en SQL Editor tras la migración ya aplicada.

begin;

revoke all on table public.skus_categories from public;
revoke all on table public.skus_categories from anon;
revoke all on table public.skus_categories from authenticated;
grant select on table public.skus_categories to authenticated;

revoke all on table public.skus_category_levels from public;
revoke all on table public.skus_category_levels from anon;
revoke all on table public.skus_category_levels from authenticated;
grant select on table public.skus_category_levels to authenticated;

revoke all on table public.skus_normalization_import_batches from public;
revoke all on table public.skus_normalization_import_batches from anon;
revoke all on table public.skus_normalization_import_batches from authenticated;
grant select on table public.skus_normalization_import_batches to authenticated;

revoke all on table public.skus_code_normalizations from public;
revoke all on table public.skus_code_normalizations from anon;
revoke all on table public.skus_code_normalizations from authenticated;
grant select on table public.skus_code_normalizations to authenticated;

-- Verificación de privilegios
select
  'skus_code_normalizations' as table_name,
  has_table_privilege('authenticated', 'public.skus_code_normalizations', 'select') as can_select,
  has_table_privilege('authenticated', 'public.skus_code_normalizations', 'insert') as can_insert,
  has_table_privilege('authenticated', 'public.skus_code_normalizations', 'update') as can_update,
  has_table_privilege('authenticated', 'public.skus_code_normalizations', 'delete') as can_delete;

select
  has_function_privilege('authenticated', 'public.claim_sku_normalization(uuid)', 'execute') as auth_claim,
  has_function_privilege('anon', 'public.claim_sku_normalization(uuid)', 'execute') as anon_claim,
  has_function_privilege('authenticated', 'public.renew_sku_normalization_claim(uuid)', 'execute') as auth_renew,
  has_function_privilege('anon', 'public.renew_sku_normalization_claim(uuid)', 'execute') as anon_renew,
  has_function_privilege('authenticated', 'public.release_sku_normalization_claim(uuid)', 'execute') as auth_release,
  has_function_privilege('anon', 'public.release_sku_normalization_claim(uuid)', 'execute') as anon_release;

commit;
