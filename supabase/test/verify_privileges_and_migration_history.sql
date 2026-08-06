-- Verificación privilegios (4 tablas Fase 1A) — ejecutar SOLO esto primero
select
  c.relname,
  has_table_privilege('authenticated', format('public.%I', c.relname), 'select') as can_select,
  has_table_privilege('authenticated', format('public.%I', c.relname), 'insert') as can_insert,
  has_table_privilege('authenticated', format('public.%I', c.relname), 'update') as can_update,
  has_table_privilege('authenticated', format('public.%I', c.relname), 'delete') as can_delete
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in (
    'skus_categories',
    'skus_category_levels',
    'skus_normalization_import_batches',
    'skus_code_normalizations'
  )
order by c.relname;

-- Historial CLI (puede NO existir si se aplicó todo por SQL Editor)
-- Si falla con 42P01, ignóralo: documentamos el ledger manual abajo.
select version, name
from supabase_migrations.schema_migrations
order by version desc
limit 10;
