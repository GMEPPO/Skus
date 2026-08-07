-- Duplicados: mesma referencia usada por palavras distintas (excepto 000 e tamanho gr/ml/kg/l).

with word_scopes as (
  select
    w.id,
    w.label,
    w.normalized_label,
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
blocking as (
  select *
  from word_scopes
  where field_type_code <> 'size'
)
select
  upper(btrim(reference_code)) as referencia,
  count(distinct normalized_label) as palavras_distintas,
  array_agg(distinct label order by label) as palavras,
  array_agg(distinct nivel order by nivel) as niveles
from blocking
group by 1
having count(distinct normalized_label) > 1
order by palavras_distintas desc, referencia;

-- Detalle fila a fila.

with word_scopes as (
  select
    w.id,
    w.label,
    w.normalized_label,
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
  having count(distinct normalized_label) > 1
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
