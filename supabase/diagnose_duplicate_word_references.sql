-- Duplicados de referencia entre palavras activas (excepto 000).

select
  upper(btrim(w.reference_code)) as referencia,
  count(*) as total,
  array_agg(w.label order by w.label) as palavras,
  array_agg(coalesce(cl.label, 'sem nivel') order by w.label) as niveles
from public.skus_words w
left join public.skus_category_levels cl on cl.id = w.category_level_id
where w.is_active = true
  and upper(btrim(w.reference_code)) <> '000'
group by 1
having count(*) > 1
order by total desc, referencia;

-- Detalle fila a fila (usar para corregir cada duplicado antes da migracao).

select
  upper(btrim(w.reference_code)) as referencia,
  w.id as word_id,
  w.label as palavra,
  w.reference_code as referencia_original,
  coalesce(cl.label, 'sem nivel') as nivel,
  coalesce(ft.name, 'sem tipo') as tipo_campo
from public.skus_words w
left join public.skus_category_levels cl on cl.id = w.category_level_id
left join public.skus_field_types ft on ft.id = w.default_field_type_id
where w.is_active = true
  and upper(btrim(w.reference_code)) <> '000'
  and upper(btrim(w.reference_code)) in (
    select upper(btrim(reference_code))
    from public.skus_words
    where is_active = true
      and upper(btrim(reference_code)) <> '000'
    group by 1
    having count(*) > 1
  )
order by referencia, w.label;
