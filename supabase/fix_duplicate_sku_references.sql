-- Corrige duplicados existentes para permitir o indice unico.
-- Mantem o registo mais antigo (completed_at / id) e marca os restantes como cancelled.
-- REVISAR diagnose_duplicate_sku_references.sql antes de executar.

begin;

create schema if not exists skus_private;

create or replace function skus_private.normalize_sku_reference(p_code text)
returns text
language sql
immutable
as $$
  select upper(regexp_replace(btrim(coalesce(p_code, '')), '-', '', 'g'));
$$;

with duplicates as (
  select
    n.id,
    row_number() over (
      partition by skus_private.normalize_sku_reference(n.final_new_code)
      order by n.completed_at nulls last, n.created_at, n.id
    ) as row_num
  from public.skus_code_normalizations n
  where n.normalization_status = 'completed'
    and n.final_new_code is not null
    and btrim(n.final_new_code) <> ''
)
update public.skus_code_normalizations n
set
  normalization_status = 'cancelled',
  updated_at = now()
from duplicates d
where n.id = d.id
  and d.row_num > 1;

-- Resumo apos correcao
select
  skus_private.normalize_sku_reference(final_new_code) as ref_normalizada,
  count(*) as total
from public.skus_code_normalizations
where normalization_status = 'completed'
  and final_new_code is not null
  and btrim(final_new_code) <> ''
group by 1
having count(*) > 1;

commit;

-- Se o select acima devolver 0 linhas, executar:
-- supabase/migrations/20260806160001_sku_reference_normalizations_unique_index.sql
