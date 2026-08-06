-- Indice unico parcial em normalizacoes completadas.
-- Executar so depois de fix_duplicate_sku_references.sql (0 duplicados).

create unique index if not exists skus_code_normalizations_completed_ref_uidx
  on public.skus_code_normalizations (skus_private.normalize_sku_reference(final_new_code))
  where normalization_status = 'completed'
    and final_new_code is not null
    and btrim(final_new_code) <> '';
