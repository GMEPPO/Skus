-- Duplicados de referencia entre palavras activas (excepto 000 e tamanho/gr/ml).

with word_scopes as (
  select
    w.id,
    w.label,
    w.reference_code,
    coalesce(cl.label, 'sem nivel') as nivel,
    coalesce(ft_direct.code, ft_level.code, '') as field_type_code
  from public.skus_words w
  left join public.skus_category_levels cl on cl.id = w.category_level_id
  left join public.skus_field_types ft_direct on ft_direct.id = w.default_field_type_id
  left join public.skus_field_types ft_level on ft_level.id = cl.legacy_field_type_id
  where w.is_active = true
    and upper(btrim(w.reference_code)) <> '000'
),
blocking_duplicates as (
  select *
  from word_scopes
  where field_type_code <> 'size'
)
select
  upper(btrim(reference_code)) as referencia,
  count(*) as total,
  array_agg(label order by label) as palavras,
  array_agg(nivel order by label) as niveles
from blocking_duplicates
group by 1
having count(*) > 1
order by total desc, referencia;

-- Detalle fila a fila (usar para corregir cada duplicado antes da migracao).

with word_scopes as (
  select
    w.id,
    w.label,
    w.reference_code,
    coalesce(cl.label, 'sem nivel') as nivel,
    coalesce(ft_direct.name, ft_level.name, 'sem tipo') as tipo_campo,
    coalesce(ft_direct.code, ft_level.code, '') as field_type_code
  from public.skus_words w
  left join public.skus_category_levels cl on cl.id = w.category_level_id
  left join public.skus_field_types ft_direct on ft_direct.id = w.default_field_type_id
  left join public.skus_field_types ft_level on ft_level.id = cl.legacy_field_type_id
  where w.is_active = true
    and upper(btrim(w.reference_code)) <> '000'
),
duplicate_refs as (
  select upper(btrim(reference_code)) as referencia
  from word_scopes
  where field_type_code <> 'size'
  group by 1
  having count(*) > 1
)
select
  upper(btrim(ws.reference_code)) as referencia,
  ws.id as word_id,
  ws.label as palavra,
  ws.reference_code as referencia_original,
  ws.nivel,
  ws.tipo_campo
from word_scopes ws
join duplicate_refs dr on dr.referencia = upper(btrim(ws.reference_code))
where ws.field_type_code <> 'size'
order by referencia, ws.label;
