-- Cosmetica / nivel 4 (size) — dicionario novo
-- Fonte: Nivel 4.xlsx (19 tamanhos + Vazio)
-- Dependencias (2 tamanhos -> 2 palavras pai no Nivel 2.xlsx / formato):
--   375ml -> Recarga Ecosouc (ECS)
--   5L    -> Recarga 5L (REC)
-- Executar apos 20260817114500_allow_duplicate_word_references.sql

begin;

with cosmetica as (
  select id from public.skus_categories where slug = 'cosmetica' limit 1
),
size_level as (
  select cl.id, cl.legacy_field_type_id
  from public.skus_category_levels cl
  join cosmetica c on c.id = cl.category_id
  where cl.key = 'size'
  limit 1
),
removed_edges as (
  delete from public.skus_word_parent_edges e
  using public.skus_words w, size_level ll, cosmetica c
  where e.child_word_id = w.id
    and (
      w.category_level_id = ll.id
      or (
        ll.legacy_field_type_id is not null
        and w.default_field_type_id = ll.legacy_field_type_id
        and (
          w.category_level_id is null
          or exists (
            select 1
            from public.skus_category_levels cl
            where cl.category_id = c.id
              and cl.key = 'size'
              and cl.id = w.category_level_id
          )
        )
      )
    )
  returning e.id
),
removed_words as (
  delete from public.skus_words w
  using size_level ll, cosmetica c
  where w.category_level_id = ll.id
     or (
       ll.legacy_field_type_id is not null
       and w.default_field_type_id = ll.legacy_field_type_id
       and (
         w.category_level_id is null
         or exists (
           select 1
           from public.skus_category_levels cl
           where cl.category_id = c.id
             and cl.key = 'size'
             and cl.id = w.category_level_id
         )
       )
     )
  returning w.id
),
dictionary(label, normalized_label, reference_code, designation_pt, designation_es, designation_en, empty_designation, include_in_designation) as (
  values
  ('Vazio', 'vazio', '000', '', '', '', true, true),
  ('100gr', '100gr', '100', '100gr', '100gr', '100gr', false, true),
  ('10ml', '10ml', '010', '10ml', '10ml', '10ml', false, true),
  ('1ml', '1ml', '001', '1ml', '1ml', '1ml', false, true),
  ('20gr', '20gr', '020', '20gr', '20gr', '20gr', false, true),
  ('25gr', '25gr', '025', '25gr', '25gr', '25gr', false, true),
  ('300ml', '300ml', '300', '300ml', '300ml', '300ml', false, true),
  ('30gr', '30gr', '030', '30gr', '30gr', '30gr', false, true),
  ('30ml', '30ml', '030', '30ml', '30ml', '30ml', false, true),
  ('33ml', '33ml', '033', '33ml', '33ml', '33ml', false, true),
  ('375ml', '375ml', '375', '375ml', '375ml', '375ml', false, true),
  ('400ml', '400ml', '400', '400ml', '400ml', '400ml', false, true),
  ('40gr', '40gr', '040', '40gr', '40gr', '40gr', false, true),
  ('40ml', '40ml', '040', '40ml', '40ml', '40ml', false, true),
  ('500ml', '500ml', '500', '500ml', '500ml', '500ml', false, true),
  ('50ml', '50ml', '050', '50ml', '50ml', '50ml', false, true),
  ('55ml', '55ml', '055', '55ml', '55ml', '55ml', false, true),
  ('5L', '5l', '005', '', '', '', true, false),
  ('60ml', '60ml', '060', '60ml', '60ml', '60ml', false, true),
  ('80ml', '80ml', '080', '80ml', '80ml', '80ml', false, true)
),
inserted_words as (
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
    ll.id,
    ll.legacy_field_type_id,
    case
      when d.empty_designation then ''
      else coalesce(nullif(btrim(d.designation_pt), ''), d.label)
    end,
    case when d.empty_designation then '' else coalesce(nullif(btrim(d.designation_pt), ''), d.label) end,
    case
      when d.empty_designation then ''
      else coalesce(nullif(btrim(d.designation_es), ''), coalesce(nullif(btrim(d.designation_pt), ''), d.label))
    end,
    case
      when d.empty_designation then ''
      else coalesce(nullif(btrim(d.designation_en), ''), coalesce(nullif(btrim(d.designation_pt), ''), d.label))
    end,
    d.include_in_designation,
    true
  from dictionary d
  cross join size_level ll
  returning id, normalized_label, label
),
dependency_pairs as (
  select
    c.id as category_id,
    child_w.id as child_word_id,
    parent_w.id as parent_word_id
  from cosmetica c
  cross join size_level sl
  join public.skus_category_levels parent_level
    on parent_level.category_id = c.id
   and parent_level.key = 'format'
  join inserted_words child_w
    on child_w.normalized_label = '375ml'
  join public.skus_words parent_w
    on parent_w.category_level_id = parent_level.id
   and parent_w.normalized_label = 'recarga ecosouc'
   and parent_w.reference_code = 'ECS'
   and parent_w.is_active = true
  union all
  select
    c.id as category_id,
    child_w.id as child_word_id,
    parent_w.id as parent_word_id
  from cosmetica c
  cross join size_level sl
  join public.skus_category_levels parent_level
    on parent_level.category_id = c.id
   and parent_level.key = 'format'
  join inserted_words child_w
    on child_w.normalized_label = '5l'
  join public.skus_words parent_w
    on parent_w.category_level_id = parent_level.id
   and parent_w.normalized_label = 'recarga 5l'
   and parent_w.reference_code = 'REC'
   and parent_w.is_active = true
)
insert into public.skus_word_parent_edges (category_id, child_word_id, parent_word_id)
select category_id, child_word_id, parent_word_id
from dependency_pairs
on conflict (child_word_id, parent_word_id) do nothing;

commit;
