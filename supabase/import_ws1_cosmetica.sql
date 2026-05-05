rollback;

begin;

create extension if not exists "pgcrypto";

drop table if exists pg_temp._ws1_families;
drop table if exists pg_temp._ws1_words;

alter table public.skus_words
  drop constraint if exists words_reference_code_format;

alter table public.skus_words
  alter column reference_code type text using btrim(reference_code::text);

alter table public.skus_words
  add constraint words_reference_code_format
  check (reference_code ~ '^[A-Z0-9&.]{2,3}$');

alter table public.skus_families
  add column if not exists reference_code text;

alter table public.skus_families
  drop constraint if exists skus_families_reference_code_format;

alter table public.skus_families
  add constraint skus_families_reference_code_format
  check (reference_code is null or reference_code ~ '^[A-Z0-9&.]{3}$');

insert into public.skus_field_types (code, name, description, sort_order, is_active)
values
  ('format', 'Formato', 'Formato do artigo', 1, true),
  ('product', 'Produto', 'Produto', 2, true),
  ('size', 'Tamanho', 'Tamanho', 3, true),
  ('packaging', 'Embalagem', 'Embalagem', 4, true),
  ('extra', 'Extra', 'Extra', 5, true)
on conflict (code) do update
set name = excluded.name,
    description = excluded.description,
    sort_order = excluded.sort_order,
    is_active = true;

create temp table _ws1_families (
  code text primary key,
  label text not null
);

insert into _ws1_families (code, label)
values
  ('ACB', 'ACHB LAVANDA'),
  ('GAE', 'RS ALGAE'),
  ('ALG', 'ALG OCEAN SPA'),
  ('ALQ', 'ALQVIMIA'),
  ('AMI', 'AMIMO'),
  ('ASE', 'AN SEMONIN'),
  ('ATC', 'AT COLOG POMELO'),
  ('AZZ', 'AZZARO'),
  ('BLT', 'B BLISS'),
  ('ALE', 'BEN ALECRIM'),
  ('BIE', 'BIENVENUE'),
  ('CIB', 'C IBIZA'),
  ('CAS', 'CAS PINK LILY'),
  ('CMO', 'CERERIA BLACK ORC'),
  ('CMR', 'CERERIA BULG ROSE'),
  ('CQM', 'C MONDES'),
  ('CLA', 'CLARINS EAU DIN'),
  ('COD', 'CODAGE'),
  ('CBO', 'CDP BOIS OLIVIE'),
  ('CMB', 'CDP MINT BASIL'),
  ('DAM', 'DAM E&S'),
  ('DOR', 'DAM ORGANIC'),
  ('DAV', 'DAVEIA'),
  ('FCI', 'EDPFM INDELEBIL'),
  ('FAA', 'FAACE'),
  ('FIL', 'RS FILIGRANA'),
  ('FAL', 'CAS FLOR ALGODA'),
  ('FDP', 'RS FLOR POEMAS'),
  ('FRM', 'EDPFM MAGNOLIA'),
  ('G&B', 'PC GOLD BLUE'),
  ('GOR', 'BEN GORDISSIMO'),
  ('GUE', 'GUERLAIN'),
  ('HPO', 'HEIPOA'),
  ('KEI', 'KEIJI'),
  ('LAB', 'LAB PERFUMES'),
  ('LVE', 'CAS LARANJA VER'),
  ('LPP', 'LPP'),
  ('MMP', 'MEMO IRISH L'),
  ('MNA', 'MINE ALLERIA'),
  ('NKI', 'NKI'),
  ('NUP', 'NUXE PRESTIGE'),
  ('NUX', 'NUXE REVE MIEL'),
  ('OCC', 'OCCEAN'),
  ('OMN', 'OMNISENS'),
  ('PMO', 'P MORABITO'),
  ('PER', 'PERRICONE'),
  ('PHY', 'PHYTOMER'),
  ('PLF', 'PC PLUM FLOWER'),
  ('RAI', 'RAIZ'),
  ('RUB', 'PC RUBY RED'),
  ('SWH', 'SCAND WHITE'),
  ('SUN', 'SUNDARI'),
  ('THV', 'THE VERT'),
  ('TRU', 'TRUSSARDI'),
  ('TYP', 'TYPOLOGY'),
  ('VIS', 'VINESIME'),
  ('WHT', 'WHITE TEA');

create temp table _ws1_words (
  category text not null,
  code text not null,
  label text not null,
  sort_order integer not null,
  primary key (category, label)
);

insert into _ws1_words (category, code, label, sort_order)
values
  ('format', 'BIS', 'Bisnaga', 10),
  ('product', 'CON', 'Condicionador', 10),
  ('size', '030', '30ml', 10),
  ('packaging', 'CXA', 'Caixa', 10),
  ('extra', '1.8', '1.8', 10),
  ('format', 'ECO', 'ECOFILL', 20),
  ('product', 'BOD', 'Body Lotion', 20),
  ('size', '030', '30gr', 20),
  ('packaging', 'PPL', 'Papel', 20),
  ('extra', 'CLS', 'Clássico', 20),
  ('format', 'ECP', 'Ecopump', 30),
  ('product', 'CHA', 'Champô', 30),
  ('size', '400', '400ml', 30),
  ('packaging', 'SGC', 'Sugar Cane', 30),
  ('extra', 'PLC', 'PLC', 30),
  ('format', 'FRA', 'Frasco', 40),
  ('product', 'CHC', 'Champô/Cond', 40),
  ('size', '300', '300ml', 40),
  ('packaging', 'VAZ', 'VAZ', 40),
  ('extra', 'PLP', 'PLP', 40),
  ('format', 'ECO', 'Garrafa Ecofill', 50),
  ('product', 'GBD', 'Gel Banho', 50),
  ('size', '375', '375ml', 50),
  ('packaging', 'POU', 'Bolsa', 50),
  ('extra', 'SLM', 'SLIM', 50),
  ('format', 'GHT', 'Ghost', 60),
  ('product', 'GCC', 'Gel Corp Cabelo', 60),
  ('size', '100', '100gr', 60),
  ('packaging', 'PLR', 'Plást. Rec.', 60),
  ('extra', 'V01', 'V01', 60),
  ('format', 'MAN', 'Manhattan', 70),
  ('product', 'GBD', 'Gel Mãos Corpo', 70),
  ('size', '500', '500ml', 70),
  ('extra', 'V02', 'V02', 70),
  ('format', 'REC', 'Rec 5L', 80),
  ('product', 'LMC', 'Loção Mão Corpo', 80),
  ('size', '020', '20gr', 80),
  ('extra', 'V03', 'V03', 80),
  ('format', 'ECO', 'Rec Ecofill', 90),
  ('product', 'SAB', 'Sabonete', 90),
  ('size', '025', '25gr', 90),
  ('extra', 'V04', 'V04', 90),
  ('format', 'ECS', 'Rec Ecosource', 100),
  ('product', 'SAB', 'Sab Líquido', 100),
  ('size', '040', '40gr', 100),
  ('extra', 'V05', 'V05', 100),
  ('format', 'SOL', 'Sólido', 110),
  ('product', 'SAI', 'Sais de Banho', 110),
  ('size', '040', '40ml', 110),
  ('extra', 'V06', 'V06', 110),
  ('format', 'STI', 'Stick', 120),
  ('product', 'LMA', 'Loção Mão', 120),
  ('size', '050', '50ml', 120),
  ('format', 'VEL', 'Vela', 130),
  ('size', '060', '60ml', 130),
  ('size', '080', '80ml', 140);

update public.skus_families f
set status = 'archived',
    updated_at = now()
where f.status <> 'archived'
  and not exists (
    select 1
    from _ws1_families wf
    where wf.code = upper(coalesce(f.reference_code, ''))
       or lower(wf.label) = lower(f.name)
  );

update public.skus_families f
set slug = trim(both '-' from lower(regexp_replace(f.slug || '-archived-' || left(f.id::text, 8), '[^a-zA-Z0-9]+', '-', 'g'))),
    updated_at = now()
where f.status = 'archived'
  and exists (
    select 1
    from _ws1_families wf
    where f.slug = trim(both '-' from lower(regexp_replace(wf.code || '-' || wf.label, '[^a-zA-Z0-9]+', '-', 'g')))
  );

update public.skus_families f
set reference_code = wf.code,
    name = wf.label,
    name_pt = wf.label,
    name_es = wf.label,
    name_en = wf.label,
    slug = trim(both '-' from lower(regexp_replace(wf.code || '-' || wf.label, '[^a-zA-Z0-9]+', '-', 'g'))),
    description = 'Familia SKU importada de WS1 1.xlsx',
    status = 'active',
    updated_at = now()
from _ws1_families wf
where wf.code = upper(coalesce(f.reference_code, ''))
   or lower(wf.label) = lower(f.name);

insert into public.skus_families (
  reference_code,
  name,
  name_pt,
  name_es,
  name_en,
  slug,
  description,
  status
)
select
  wf.code,
  wf.label,
  wf.label,
  wf.label,
  wf.label,
  trim(both '-' from lower(regexp_replace(wf.code || '-' || wf.label, '[^a-zA-Z0-9]+', '-', 'g'))),
  'Familia SKU importada de WS1 1.xlsx',
  'active'
from _ws1_families wf
where not exists (
  select 1
  from public.skus_families f
  where wf.code = upper(coalesce(f.reference_code, ''))
     or lower(wf.label) = lower(f.name)
);

update public.skus_words w
set is_active = false,
    updated_at = now()
where w.default_field_type_id in (
  select id
  from public.skus_field_types
  where code in ('format', 'product', 'size', 'packaging', 'extra')
)
and not exists (
  select 1
  from _ws1_words ww
  join public.skus_field_types ft on ft.code = ww.category
  where w.default_field_type_id = ft.id
    and lower(trim(ww.label)) = w.normalized_label
);

insert into public.skus_words (
  label,
  normalized_label,
  reference_code,
  default_field_type_id,
  designation,
  designation_pt,
  designation_es,
  designation_en,
  include_in_designation,
  is_active
)
select
  ww.label,
  lower(trim(ww.label)),
  ww.code,
  ft.id,
  ww.label,
  ww.label,
  ww.label,
  ww.label,
  true,
  true
from _ws1_words ww
join public.skus_field_types ft on ft.code = ww.category
on conflict (normalized_label, default_field_type_id) do update
set reference_code = excluded.reference_code,
    label = excluded.label,
    designation = excluded.designation,
    designation_pt = excluded.designation_pt,
    designation_es = excluded.designation_es,
    designation_en = excluded.designation_en,
    include_in_designation = true,
    is_active = true,
    updated_at = now();

insert into public.skus_word_families (word_id, family_id)
select distinct
  w.id,
  f.id
from public.skus_families f
join _ws1_families wf on wf.code = f.reference_code
cross join _ws1_words ww
join public.skus_field_types ft on ft.code = ww.category
join public.skus_words w
  on w.default_field_type_id = ft.id
 and w.normalized_label = lower(trim(ww.label))
where f.status = 'active'
  and w.is_active = true
on conflict do nothing;

insert into public.skus_family_tree_versions (family_id, version_number, status, published_at)
select
  f.id,
  coalesce((select max(tv.version_number) from public.skus_family_tree_versions tv where tv.family_id = f.id), 0) + 1,
  'published',
  now()
from public.skus_families f
join _ws1_families wf on wf.code = f.reference_code
where f.status = 'active'
  and not exists (
    select 1
    from public.skus_family_tree_versions tv
    where tv.family_id = f.id
      and tv.status = 'published'
  );

update public.skus_families f
set active_tree_version_id = (
      select tv.id
      from public.skus_family_tree_versions tv
      where tv.family_id = f.id
        and tv.status = 'published'
      order by tv.version_number desc
      limit 1
    ),
    updated_at = now()
where f.status = 'active'
  and exists (select 1 from _ws1_families wf where wf.code = f.reference_code);

insert into public.skus_family_tree_levels (
  tree_version_id,
  field_type_id,
  level_order,
  label_override,
  is_required,
  designation_included
)
select
  tv.id,
  ft.id,
  case ft.code
    when 'format' then 1
    when 'product' then 2
    when 'size' then 3
    when 'packaging' then 4
    when 'extra' then 5
  end,
  null,
  true,
  true
from public.skus_families f
join _ws1_families wf on wf.code = f.reference_code
join public.skus_family_tree_versions tv
  on tv.family_id = f.id
 and (tv.status in ('published', 'draft') or tv.id = f.active_tree_version_id)
cross join public.skus_field_types ft
where f.status = 'active'
  and ft.code in ('format', 'product', 'size', 'packaging', 'extra')
on conflict (tree_version_id, level_order) do update
set field_type_id = excluded.field_type_id,
    label_override = excluded.label_override,
    is_required = true,
    designation_included = true;

insert into public.skus_family_tree_level_words (
  tree_level_id,
  word_id,
  sort_order
)
select distinct
  lvl.id,
  w.id,
  ww.sort_order
from public.skus_families f
join _ws1_families wf on wf.code = f.reference_code
join public.skus_family_tree_versions tv
  on tv.family_id = f.id
 and (tv.status in ('published', 'draft') or tv.id = f.active_tree_version_id)
join public.skus_family_tree_levels lvl on lvl.tree_version_id = tv.id
join public.skus_field_types ft on ft.id = lvl.field_type_id
join _ws1_words ww on ww.category = ft.code
join public.skus_words w
  on w.default_field_type_id = ft.id
 and w.normalized_label = lower(trim(ww.label))
where f.status = 'active'
  and w.is_active = true
on conflict (tree_level_id, word_id) do update
set sort_order = excluded.sort_order;

with imported_words as (
  select distinct w.id
  from _ws1_words ww
  join public.skus_field_types ft on ft.code = ww.category
  join public.skus_words w
    on w.default_field_type_id = ft.id
   and w.normalized_label = lower(trim(ww.label))
)
delete from public.skus_word_dependencies d
using imported_words iw
where d.child_word_id = iw.id
   or d.parent_word_id = iw.id;

delete from public.skus_family_tree_edges e
using public.skus_family_tree_versions tv,
      public.skus_families f,
      _ws1_families wf
where e.tree_version_id = tv.id
  and tv.family_id = f.id
  and wf.code = f.reference_code
  and f.status = 'active';

commit;

select
  ft.code as nivel,
  count(distinct w.id) as opciones
from public.skus_words w
join public.skus_field_types ft on ft.id = w.default_field_type_id
where w.is_active = true
  and ft.code in ('format', 'product', 'size', 'packaging', 'extra')
group by ft.code
order by min(ft.sort_order);
