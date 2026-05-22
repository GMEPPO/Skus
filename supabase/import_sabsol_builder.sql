-- OBSOLETO.
--
-- Este script antes reconstruia familias/arboles desde Sabsol.xlsx.
-- El modelo actual ya no usa familias ni arboles: usa una biblioteca global
-- de 6 niveles.
--
-- Ejecuta en su lugar:
--   supabase/reset_global_sku_library.sql

do $$
begin
  raise exception 'import_sabsol_builder.sql esta obsoleto. Ejecuta supabase/reset_global_sku_library.sql.';
end $$;
