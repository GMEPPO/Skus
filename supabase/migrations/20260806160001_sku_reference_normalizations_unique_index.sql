-- Indice unico parcial em normalizacoes completadas.
-- Executar so depois de fix_duplicate_sku_references.sql (0 duplicados).

create schema if not exists skus_private;

create or replace function skus_private.normalize_sku_reference(p_code text)
returns text
language sql
immutable
as $$
  select upper(regexp_replace(btrim(coalesce(p_code, '')), '-', '', 'g'));
$$;

create unique index if not exists skus_code_normalizations_completed_ref_uidx
  on public.skus_code_normalizations (skus_private.normalize_sku_reference(final_new_code))
  where normalization_status = 'completed'
    and final_new_code is not null
    and btrim(final_new_code) <> '';
