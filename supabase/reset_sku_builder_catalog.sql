-- OBSOLETO.
--
-- Este reset pertenecia al modelo anterior de familias/arboles.
-- El reset vigente es:
--   supabase/reset_global_sku_library.sql
--
-- No se ejecuta automaticamente para evitar borrar datos con el modelo equivocado.

do $$
begin
  raise exception 'reset_sku_builder_catalog.sql esta obsoleto. Ejecuta supabase/reset_global_sku_library.sql.';
end $$;
