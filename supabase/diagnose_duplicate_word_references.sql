-- Duplicados de referencia entre palavras activas (excepto 000).

select
  upper(btrim(reference_code)) as referencia,
  count(*) as total,
  array_agg(label order by label) as palavras,
  array_agg(coalesce(cl.label, 'sem nivel') order by label) as niveles
from public.skus_words w
left join public.skus_category_levels cl on cl.id = w.category_level_id
where w.is_active = true
  and upper(btrim(w.reference_code)) <> '000'
group by 1
having count(*) > 1
order by total desc, referencia;
