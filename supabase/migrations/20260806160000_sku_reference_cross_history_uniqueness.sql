-- Enforce unique SKU reference codes across:
--   - skus_sku_generations.generated_code (new SKUs)
--   - skus_code_normalizations completed final_new_code / source_new_code (normalized)
-- Comparison ignores hyphens and uses uppercase.

create schema if not exists skus_private;

create or replace function skus_private.normalize_sku_reference(p_code text)
returns text
language sql
immutable
as $$
  select upper(regexp_replace(btrim(coalesce(p_code, '')), '-', '', 'g'));
$$;

create or replace function skus_private.enforce_sku_reference_uniqueness()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_ref text;
begin
  if tg_table_name = 'skus_sku_generations' then
    v_ref := skus_private.normalize_sku_reference(new.generated_code);
    if v_ref = '' then
      return new;
    end if;

    if exists (
      select 1
      from public.skus_sku_generations g
      where g.id is distinct from new.id
        and skus_private.normalize_sku_reference(g.generated_code) = v_ref
    ) then
      raise exception 'sku_reference_duplicate';
    end if;

    if exists (
      select 1
      from public.skus_code_normalizations n
      where n.normalization_status = 'completed'
        and skus_private.normalize_sku_reference(coalesce(n.final_new_code, n.source_new_code)) = v_ref
    ) then
      raise exception 'sku_reference_duplicate';
    end if;

    return new;
  end if;

  if tg_table_name = 'skus_code_normalizations' then
    if new.normalization_status is distinct from 'completed' then
      return new;
    end if;

    v_ref := skus_private.normalize_sku_reference(coalesce(new.final_new_code, new.source_new_code));
    if v_ref = '' then
      return new;
    end if;

    if exists (
      select 1
      from public.skus_sku_generations g
      where skus_private.normalize_sku_reference(g.generated_code) = v_ref
        and (new.generation_id is null or g.id is distinct from new.generation_id)
    ) then
      raise exception 'sku_reference_duplicate';
    end if;

    if exists (
      select 1
      from public.skus_code_normalizations n
      where n.id is distinct from new.id
        and n.normalization_status = 'completed'
        and skus_private.normalize_sku_reference(coalesce(n.final_new_code, n.source_new_code)) = v_ref
    ) then
      raise exception 'sku_reference_duplicate';
    end if;

    return new;
  end if;

  return new;
end;
$$;

drop trigger if exists skus_enforce_reference_uniqueness_generations on public.skus_sku_generations;
create trigger skus_enforce_reference_uniqueness_generations
  before insert or update of generated_code
  on public.skus_sku_generations
  for each row
  execute function skus_private.enforce_sku_reference_uniqueness();

drop trigger if exists skus_enforce_reference_uniqueness_normalizations on public.skus_code_normalizations;
create trigger skus_enforce_reference_uniqueness_normalizations
  before insert or update of normalization_status, final_new_code, source_new_code
  on public.skus_code_normalizations
  for each row
  execute function skus_private.enforce_sku_reference_uniqueness();

-- Indice unico: aplicar APOS limpar duplicados existentes.
-- Ver: supabase/diagnose_duplicate_sku_references.sql
--      supabase/fix_duplicate_sku_references.sql
--      supabase/migrations/20260806160001_sku_reference_normalizations_unique_index.sql
