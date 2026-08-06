-- Diagnostico de referencias SKU duplicadas (normalizadas, sin guiones).
-- Executar no Supabase SQL Editor antes de criar o indice unico.
-- Cria a funcao auxiliar se ainda nao existir.

create schema if not exists skus_private;

create or replace function skus_private.normalize_sku_reference(p_code text)
returns text
language sql
immutable
as $$
  select upper(regexp_replace(btrim(coalesce(p_code, '')), '-', '', 'g'));
$$;

-- 1) Duplicados dentro de normalizaciones completadas
select
  skus_private.normalize_sku_reference(n.final_new_code) as ref_normalizada,
  count(*) as total,
  array_agg(n.legacy_code order by n.completed_at nulls last, n.id) as legacy_codes,
  array_agg(n.final_new_code order by n.completed_at nulls last, n.id) as final_codes,
  array_agg(n.id::text order by n.completed_at nulls last, n.id) as ids
from public.skus_code_normalizations n
where n.normalization_status = 'completed'
  and n.final_new_code is not null
  and btrim(n.final_new_code) <> ''
group by 1
having count(*) > 1
order by total desc, ref_normalizada;

-- 2) Referencias de normalizadas que ja existem em codigos novos
select
  skus_private.normalize_sku_reference(n.final_new_code) as ref_normalizada,
  n.legacy_code,
  n.final_new_code,
  g.generated_code,
  n.id as normalization_id,
  g.id as generation_id
from public.skus_code_normalizations n
join public.skus_sku_generations g
  on skus_private.normalize_sku_reference(g.generated_code)
   = skus_private.normalize_sku_reference(n.final_new_code)
where n.normalization_status = 'completed'
  and n.final_new_code is not null
  and btrim(n.final_new_code) <> ''
order by 1, n.legacy_code;

-- 3) Duplicados dentro de skus_sku_generations
select
  skus_private.normalize_sku_reference(g.generated_code) as ref_normalizada,
  count(*) as total,
  array_agg(g.generated_code order by g.created_at, g.id) as codes,
  array_agg(g.id::text order by g.created_at, g.id) as ids
from public.skus_sku_generations g
group by 1
having count(*) > 1
order by total desc, ref_normalizada;
