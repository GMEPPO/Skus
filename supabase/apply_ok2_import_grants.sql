-- Executar no SQL Editor do Supabase (projeto GGMPI) antes de reimportar OK2.
-- Corrige: "OK2 nao concluido: permission denied for schema skus_private"

begin;

grant usage on schema skus_private to service_role;

grant execute on function skus_private.normalize_sku_reference(text) to service_role;

grant execute on function skus_private.enforce_sku_reference_uniqueness() to service_role;

commit;

-- Verificacao (deve devolver true para as 3 linhas):
select
  has_schema_privilege('service_role', 'skus_private', 'USAGE') as service_role_schema_usage,
  has_function_privilege(
    'service_role',
    'skus_private.normalize_sku_reference(text)',
    'EXECUTE'
  ) as service_role_normalize_execute,
  has_function_privilege(
    'service_role',
    'skus_private.enforce_sku_reference_uniqueness()',
    'EXECUTE'
  ) as service_role_enforce_execute;
