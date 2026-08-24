-- Cosmetica: novas palavras + correcoes de designacao (Ago 2026)
-- - Recarga Ecosource (ECS)
-- - Gel Corpo Cabelo EN
-- - Balsamo Corporal (product / BOD)
-- - Gel de Limpeza (product / GBD)
-- - 4,5ML (size / 045)
-- - LUX (extra H2)

begin;

with cosmetica as (
  select id from public.skus_categories where slug = 'cosmetica' limit 1
),
format_level as (
  select cl.id
  from public.skus_category_levels cl
  join cosmetica c on c.id = cl.category_id
  where cl.key = 'format'
  limit 1
)
update public.skus_words w
set
  label = 'Recarga Ecosource',
  normalized_label = 'recarga ecosource',
  designation = 'RECARGA ECOSOURCE',
  designation_pt = 'RECARGA ECOSOURCE',
  designation_es = 'RECARGA ECOSOURCE',
  designation_en = 'REFILL ECOSOURCE'
from format_level fl
where w.category_level_id = fl.id
  and w.reference_code = 'ECS'
  and w.normalized_label in ('recarga ecosouc', 'recarga ecosource');

with cosmetica as (
  select id from public.skus_categories where slug = 'cosmetica' limit 1
),
product_level as (
  select cl.id, cl.legacy_field_type_id
  from public.skus_category_levels cl
  join cosmetica c on c.id = cl.category_id
  where cl.key = 'product'
  limit 1
)
update public.skus_words w
set designation_en = 'Hair and Body Gel'
from product_level pl
where w.category_level_id = pl.id
  and w.normalized_label = 'gel corpo cabelo';

with cosmetica as (
  select id from public.skus_categories where slug = 'cosmetica' limit 1
),
product_level as (
  select cl.id, cl.legacy_field_type_id
  from public.skus_category_levels cl
  join cosmetica c on c.id = cl.category_id
  where cl.key = 'product'
  limit 1
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
  d.label,
  d.normalized_label,
  d.reference_code,
  pl.id,
  pl.legacy_field_type_id,
  d.designation_pt,
  d.designation_pt,
  d.designation_es,
  d.designation_en,
  d.include_in_designation,
  true
from product_level pl
cross join (
  values
    ('Bálsamo Corporal', 'bálsamo corporal', 'BOD', 'Bálsamo Corporal', 'Bálsamo Corporal', 'Body Balm', true),
    ('Gel de Limpeza', 'gel de limpeza', 'GBD', 'Gel Lavant', 'Gel Lavant', 'Gel Lavant', true)
) as d(label, normalized_label, reference_code, designation_pt, designation_es, designation_en, include_in_designation)
where not exists (
  select 1
  from public.skus_words existing
  where existing.category_level_id = pl.id
    and existing.normalized_label = d.normalized_label
);

with cosmetica as (
  select id from public.skus_categories where slug = 'cosmetica' limit 1
),
size_level as (
  select cl.id, cl.legacy_field_type_id
  from public.skus_category_levels cl
  join cosmetica c on c.id = cl.category_id
  where cl.key = 'size'
  limit 1
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
  '4,5ML',
  '4,5ml',
  '045',
  sl.id,
  sl.legacy_field_type_id,
  '4,5ML',
  '4,5ML',
  '4,5ML',
  '4,5ML',
  true,
  true
from size_level sl
where not exists (
  select 1
  from public.skus_words existing
  where existing.category_level_id = sl.id
    and existing.normalized_label = '4,5ml'
);

with cosmetica as (
  select id from public.skus_categories where slug = 'cosmetica' limit 1
),
extra_level as (
  select cl.id, cl.legacy_field_type_id
  from public.skus_category_levels cl
  join cosmetica c on c.id = cl.category_id
  where cl.key = 'extra'
  limit 1
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
  selection_hierarchy,
  is_active
)
select
  'LUX',
  'lux',
  'LUX',
  el.id,
  el.legacy_field_type_id,
  'LUX',
  'LUX',
  'LUX',
  'LUX',
  true,
  2,
  true
from extra_level el
where not exists (
  select 1
  from public.skus_words existing
  where existing.category_level_id = el.id
    and existing.normalized_label = 'lux'
);

commit;
