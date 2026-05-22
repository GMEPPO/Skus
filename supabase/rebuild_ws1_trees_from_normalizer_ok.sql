-- OBSOLETO.
--
-- Este script reconstruia arboles familiares desde el normalizador.
-- El normalizador y los arboles ya no forman parte del producto actual.
--
-- Ejecuta en su lugar:
--   supabase/reset_global_sku_library.sql

do $$
begin
  raise exception 'rebuild_ws1_trees_from_normalizer_ok.sql esta obsoleto. Ejecuta supabase/reset_global_sku_library.sql.';
end $$;
