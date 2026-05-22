-- OBSOLETO.
--
-- Este import dependia de familias, arboles y dependencias palabra-palabra.
-- El modelo actual usa biblioteca global de 6 niveles.
--
-- Ejecuta en su lugar:
--   supabase/reset_global_sku_library.sql

do $$
begin
  raise exception 'import_ws1_cosmetica.sql esta obsoleto. Ejecuta supabase/reset_global_sku_library.sql.';
end $$;
