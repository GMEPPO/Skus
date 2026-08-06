-- Referencia 000 (vazio) em cada nivel da categoria cosmetica.
-- Designacoes vazias; nao entra na designacao PHC.
-- Executar apos import_diccionario_cosmetica.sql (ou sozinho se ainda nao existir).

begin;

with cosmetica as (
  select id from public.skus_categories where slug = 'cosmetica' limit 1
)
insert into public.skus_words (
  label,
  normalized_label,
  reference_code,
  category_level_id,
  default_field_type_id,
  designation,
  designation_pt,
  designation_es,
  designation_en,
  include_in_designation,
  is_active
)
select
  'Vazio',
  'vazio',
  '000',
  cl.id,
  cl.legacy_field_type_id,
  '',
  '',
  '',
  '',
  false,
  true
from public.skus_category_levels cl
join cosmetica c on c.id = cl.category_id
where not exists (
  select 1
  from public.skus_words w
  where w.category_level_id = cl.id
    and w.reference_code = '000'
    and w.is_active = true
);

select
  cl.key as level_key,
  cl.label as level_label,
  w.reference_code,
  w.label,
  w.designation_pt
from public.skus_category_levels cl
join public.skus_categories c on c.id = cl.category_id and c.slug = 'cosmetica'
left join public.skus_words w
  on w.category_level_id = cl.id
 and w.reference_code = '000'
 and w.is_active = true
order by cl.sort_order;

commit;
