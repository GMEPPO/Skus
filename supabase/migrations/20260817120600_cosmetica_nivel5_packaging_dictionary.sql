-- Cosmetica / nivel 5 (packaging) — dicionario novo
-- Fonte: Nivel 5.xlsx hierarquia 1 (8 embalagens + Vazio)
-- Hierarquia 2 ("Outros Dados") -> nivel 6 / extra (ver scripts/nivel6-extra-words-data.json)
-- Dependencias:
--   Caixa/Flowpack/ALLEGRO -> Sabonete(s) solidos (product / Nivel 3.xlsx)
--   Papel -> Sais de Banho (product / SAI)
--   Aluminio/Policarbonato/Polipropileno -> Ecofill (format / ECO, Garrafa ou Recarga)
-- NOTA gerador: arestas multiplas pais com OR para Caixa, Flowpack, ALLEGRO, Papel, Aluminio CLS, Aluminio SLM, Polipropileno, Policarbonato
-- Executar apos 20260817120500_cosmetica_word_selection_hierarchy.sql

begin;

delete from public.skus_word_parent_edges e
using public.skus_words w,
      public.skus_category_levels cl,
      public.skus_categories c
where e.child_word_id = w.id
  and c.id = cl.category_id
  and c.slug = 'cosmetica'
  and cl.key = 'packaging'
  and (
    w.category_level_id = cl.id
    or (
      cl.legacy_field_type_id is not null
      and w.default_field_type_id = cl.legacy_field_type_id
    )
  );

delete from public.skus_words w
using public.skus_category_levels cl,
      public.skus_categories c
where c.id = cl.category_id
  and c.slug = 'cosmetica'
  and cl.key = 'packaging'
  and (
    w.category_level_id = cl.id
    or (
      cl.legacy_field_type_id is not null
      and w.default_field_type_id = cl.legacy_field_type_id
    )
  );

with cosmetica as (
  select id from public.skus_categories where slug = 'cosmetica' limit 1
),
packaging_level as (
  select cl.id, cl.legacy_field_type_id
  from public.skus_category_levels cl
  join cosmetica c on c.id = cl.category_id
  where cl.key = 'packaging'
  limit 1
),
dictionary(label, normalized_label, reference_code, selection_hierarchy, designation_pt, designation_es, designation_en, empty_designation, include_in_designation) as (
  values
  ('Vazio', 'vazio', '000', null, '', '', '', true, true),
  ('ALLEGRO', 'allegro', 'ALE', 1, 'ALLEGRO', 'ALLEGRO', 'ALLEGRO', false, true),
  ('Aluminio CLS', 'aluminio cls', 'ALU', 1, 'Aluminio CLS', 'Aluminio CLS', 'Aluminum CLS', false, true),
  ('Aluminio SLM', 'aluminio slm', 'ALU', 1, 'Aluminio SLM', 'Aluminio SLM', 'Aluminum SLM', false, true),
  ('Caixa', 'caixa', 'CXA', 1, 'Caixa', 'Caja', 'Box', false, true),
  ('Flowpack', 'flowpack', 'FLW', 1, 'Flowpack', 'Flowpack', 'Flowpack', false, true),
  ('Papel', 'papel', 'PPL', 1, 'Papel', 'Papel', 'Paper', false, true),
  ('Policarbonato', 'policarbonato', 'PLC', 1, 'Policarbonato', 'PC', 'PC', false, true),
  ('Polipropileno', 'polipropileno', 'PLP', 1, 'Polipropileno', 'PP', 'PP', false, true)
),
inserted_words as (
  insert into public.skus_words (
    label,
    normalized_label,
    reference_code,
    category_level_id,
    default_field_type_id,
    selection_hierarchy,
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
    d.selection_hierarchy,
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
  cross join packaging_level ll
  returning id, normalized_label, label
),
dependency_pairs as (
  select
    c.id as category_id,
    child_w.id as child_word_id,
    parent_w.id as parent_word_id
  from cosmetica c
  cross join packaging_level pl
  join public.skus_category_levels parent_level
    on parent_level.category_id = c.id
   and parent_level.key = 'product'
  join inserted_words child_w
    on child_w.normalized_label = 'caixa'
  join public.skus_words parent_w
    on parent_w.category_level_id = parent_level.id
   and parent_w.normalized_label = 'sabonete'
   and parent_w.reference_code = 'SAB'
   and parent_w.is_active = true
  union all
  select
    c.id as category_id,
    child_w.id as child_word_id,
    parent_w.id as parent_word_id
  from cosmetica c
  cross join packaging_level pl
  join public.skus_category_levels parent_level
    on parent_level.category_id = c.id
   and parent_level.key = 'product'
  join inserted_words child_w
    on child_w.normalized_label = 'caixa'
  join public.skus_words parent_w
    on parent_w.category_level_id = parent_level.id
   and parent_w.normalized_label = 'sabonete esfoliante'
   and parent_w.reference_code = 'SAB'
   and parent_w.is_active = true
  union all
  select
    c.id as category_id,
    child_w.id as child_word_id,
    parent_w.id as parent_word_id
  from cosmetica c
  cross join packaging_level pl
  join public.skus_category_levels parent_level
    on parent_level.category_id = c.id
   and parent_level.key = 'product'
  join inserted_words child_w
    on child_w.normalized_label = 'flowpack'
  join public.skus_words parent_w
    on parent_w.category_level_id = parent_level.id
   and parent_w.normalized_label = 'sabonete'
   and parent_w.reference_code = 'SAB'
   and parent_w.is_active = true
  union all
  select
    c.id as category_id,
    child_w.id as child_word_id,
    parent_w.id as parent_word_id
  from cosmetica c
  cross join packaging_level pl
  join public.skus_category_levels parent_level
    on parent_level.category_id = c.id
   and parent_level.key = 'product'
  join inserted_words child_w
    on child_w.normalized_label = 'flowpack'
  join public.skus_words parent_w
    on parent_w.category_level_id = parent_level.id
   and parent_w.normalized_label = 'sabonete esfoliante'
   and parent_w.reference_code = 'SAB'
   and parent_w.is_active = true
  union all
  select
    c.id as category_id,
    child_w.id as child_word_id,
    parent_w.id as parent_word_id
  from cosmetica c
  cross join packaging_level pl
  join public.skus_category_levels parent_level
    on parent_level.category_id = c.id
   and parent_level.key = 'product'
  join inserted_words child_w
    on child_w.normalized_label = 'allegro'
  join public.skus_words parent_w
    on parent_w.category_level_id = parent_level.id
   and parent_w.normalized_label = 'sabonete'
   and parent_w.reference_code = 'SAB'
   and parent_w.is_active = true
  union all
  select
    c.id as category_id,
    child_w.id as child_word_id,
    parent_w.id as parent_word_id
  from cosmetica c
  cross join packaging_level pl
  join public.skus_category_levels parent_level
    on parent_level.category_id = c.id
   and parent_level.key = 'product'
  join inserted_words child_w
    on child_w.normalized_label = 'allegro'
  join public.skus_words parent_w
    on parent_w.category_level_id = parent_level.id
   and parent_w.normalized_label = 'sabonete esfoliante'
   and parent_w.reference_code = 'SAB'
   and parent_w.is_active = true
  union all
  select
    c.id as category_id,
    child_w.id as child_word_id,
    parent_w.id as parent_word_id
  from cosmetica c
  cross join packaging_level pl
  join public.skus_category_levels parent_level
    on parent_level.category_id = c.id
   and parent_level.key = 'product'
  join inserted_words child_w
    on child_w.normalized_label = 'papel'
  join public.skus_words parent_w
    on parent_w.category_level_id = parent_level.id
   and parent_w.normalized_label = 'sais de banho'
   and parent_w.reference_code = 'SAI'
   and parent_w.is_active = true
  union all
  select
    c.id as category_id,
    child_w.id as child_word_id,
    parent_w.id as parent_word_id
  from cosmetica c
  cross join packaging_level pl
  join public.skus_category_levels parent_level
    on parent_level.category_id = c.id
   and parent_level.key = 'format'
  join inserted_words child_w
    on child_w.normalized_label = 'aluminio cls'
  join public.skus_words parent_w
    on parent_w.category_level_id = parent_level.id
   and parent_w.normalized_label = 'garrafa ecofill'
   and parent_w.reference_code = 'ECO'
   and parent_w.is_active = true
  union all
  select
    c.id as category_id,
    child_w.id as child_word_id,
    parent_w.id as parent_word_id
  from cosmetica c
  cross join packaging_level pl
  join public.skus_category_levels parent_level
    on parent_level.category_id = c.id
   and parent_level.key = 'format'
  join inserted_words child_w
    on child_w.normalized_label = 'aluminio cls'
  join public.skus_words parent_w
    on parent_w.category_level_id = parent_level.id
   and parent_w.normalized_label = 'recarga ecofill'
   and parent_w.reference_code = 'ECO'
   and parent_w.is_active = true
  union all
  select
    c.id as category_id,
    child_w.id as child_word_id,
    parent_w.id as parent_word_id
  from cosmetica c
  cross join packaging_level pl
  join public.skus_category_levels parent_level
    on parent_level.category_id = c.id
   and parent_level.key = 'format'
  join inserted_words child_w
    on child_w.normalized_label = 'aluminio slm'
  join public.skus_words parent_w
    on parent_w.category_level_id = parent_level.id
   and parent_w.normalized_label = 'garrafa ecofill'
   and parent_w.reference_code = 'ECO'
   and parent_w.is_active = true
  union all
  select
    c.id as category_id,
    child_w.id as child_word_id,
    parent_w.id as parent_word_id
  from cosmetica c
  cross join packaging_level pl
  join public.skus_category_levels parent_level
    on parent_level.category_id = c.id
   and parent_level.key = 'format'
  join inserted_words child_w
    on child_w.normalized_label = 'aluminio slm'
  join public.skus_words parent_w
    on parent_w.category_level_id = parent_level.id
   and parent_w.normalized_label = 'recarga ecofill'
   and parent_w.reference_code = 'ECO'
   and parent_w.is_active = true
  union all
  select
    c.id as category_id,
    child_w.id as child_word_id,
    parent_w.id as parent_word_id
  from cosmetica c
  cross join packaging_level pl
  join public.skus_category_levels parent_level
    on parent_level.category_id = c.id
   and parent_level.key = 'format'
  join inserted_words child_w
    on child_w.normalized_label = 'polipropileno'
  join public.skus_words parent_w
    on parent_w.category_level_id = parent_level.id
   and parent_w.normalized_label = 'garrafa ecofill'
   and parent_w.reference_code = 'ECO'
   and parent_w.is_active = true
  union all
  select
    c.id as category_id,
    child_w.id as child_word_id,
    parent_w.id as parent_word_id
  from cosmetica c
  cross join packaging_level pl
  join public.skus_category_levels parent_level
    on parent_level.category_id = c.id
   and parent_level.key = 'format'
  join inserted_words child_w
    on child_w.normalized_label = 'polipropileno'
  join public.skus_words parent_w
    on parent_w.category_level_id = parent_level.id
   and parent_w.normalized_label = 'recarga ecofill'
   and parent_w.reference_code = 'ECO'
   and parent_w.is_active = true
  union all
  select
    c.id as category_id,
    child_w.id as child_word_id,
    parent_w.id as parent_word_id
  from cosmetica c
  cross join packaging_level pl
  join public.skus_category_levels parent_level
    on parent_level.category_id = c.id
   and parent_level.key = 'format'
  join inserted_words child_w
    on child_w.normalized_label = 'policarbonato'
  join public.skus_words parent_w
    on parent_w.category_level_id = parent_level.id
   and parent_w.normalized_label = 'garrafa ecofill'
   and parent_w.reference_code = 'ECO'
   and parent_w.is_active = true
  union all
  select
    c.id as category_id,
    child_w.id as child_word_id,
    parent_w.id as parent_word_id
  from cosmetica c
  cross join packaging_level pl
  join public.skus_category_levels parent_level
    on parent_level.category_id = c.id
   and parent_level.key = 'format'
  join inserted_words child_w
    on child_w.normalized_label = 'policarbonato'
  join public.skus_words parent_w
    on parent_w.category_level_id = parent_level.id
   and parent_w.normalized_label = 'recarga ecofill'
   and parent_w.reference_code = 'ECO'
   and parent_w.is_active = true
)
insert into public.skus_word_parent_edges (category_id, child_word_id, parent_word_id)
select category_id, child_word_id, parent_word_id
from dependency_pairs
on conflict (child_word_id, parent_word_id) do nothing;

commit;
