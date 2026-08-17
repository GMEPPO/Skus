-- Cosmetica / nivel 6 (extra / Outros) — dicionario novo
-- Fonte: nivel 6.xlsx (10 palavras) + Nivel 5.xlsx hierarquia 2 (10 palavras) + Vazio
-- Segmento sempre no fim da referencia SKU
-- Hierarquia 2 (Nivel 5): mostrar no extra se nenhuma embalagem H1 aplicavel (logica UI pendente)
-- Dependencias: 1.8 -> Ecofill (format / ECO)
-- Executar apos 20260817120500_cosmetica_word_selection_hierarchy.sql e 20260817120600_...nivel5...

begin;

with cosmetica as (
  select id from public.skus_categories where slug = 'cosmetica' limit 1
),
extra_level as (
  select cl.id, cl.legacy_field_type_id
  from public.skus_category_levels cl
  join cosmetica c on c.id = cl.category_id
  where cl.key = 'extra'
  limit 1
),
removed_edges as (
  delete from public.skus_word_parent_edges e
  using public.skus_words w, extra_level ll, cosmetica c
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
              and cl.key = 'extra'
              and cl.id = w.category_level_id
          )
        )
      )
    )
  returning e.id
),
removed_words as (
  delete from public.skus_words w
  using extra_level ll, cosmetica c
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
             and cl.key = 'extra'
             and cl.id = w.category_level_id
         )
       )
     )
  returning w.id
),
dictionary(label, normalized_label, reference_code, selection_hierarchy, designation_pt, designation_es, designation_en, empty_designation, include_in_designation) as (
  values
  ('Vazio', 'vazio', '000', null, '', '', '', true, true),
  ('1.8', '1.8', '1.8', null, '1.8', '1.8', '1.8', false, true),
  ('ALGODÃO', 'algodão', 'ALG', 2, 'ALGODÃO', 'ALGODÓN', 'COTTON', false, true),
  ('AMENDOA', 'amendoa', 'AME', 2, 'AMENDOA', 'ALMENDRA', 'ALMOND', false, true),
  ('Bordeaux', 'bordeaux', 'BD', null, 'Bordeaux', 'Burdeos', 'Bordeaux', false, true),
  ('Branco', 'branco', 'BR', null, 'Branco', 'Blanco', 'White', false, true),
  ('CREME DE CORPO', 'creme de corpo', 'CC0', 2, 'CREME CORPO', 'CREMA DE CUERPO', 'BODY CREAM', false, true),
  ('CREME DE NOITE', 'creme de noite', 'CN0', 2, 'CREME DE NOITE', 'CREMA DE NOCHE', 'NIGHT CREAM', false, true),
  ('CREME FACIAL', 'creme facial', 'CF0', 2, 'CREME FACIAL', 'CREMA FACIAL', 'FACE CREAM', false, true),
  ('CREME LIMPEZA ROSTO', 'creme limpeza rosto', 'CL0', 2, 'CREME LIMPEZA', 'CREMA LIMPIEZA ROSTRO', 'FACE CLEANSING CREAM', false, true),
  ('Creme Mãos', 'creme mãos', 'CM0', 2, 'CREME MÃOS', 'CREMA DE MANOS', 'HAND CREAM', false, true),
  ('ESFOLIANTE', 'esfoliante', 'ESF', 2, '', '', '', true, false),
  ('Limão', 'limão', 'LIM', 2, 'Limão', 'Limón', 'Lemon', false, true),
  ('PRESTIGE', 'prestige', 'PRE', null, 'PRESTIGE', 'PRESTIGE', 'PRESTIGE', false, true),
  ('TANGERINA', 'tangerina', 'TAN', 2, 'TANGERINA', 'MANDARINA', 'TANGERINE', false, true),
  ('V01', 'v01', 'V01', null, 'V01', 'V01', 'V01', false, true),
  ('V02', 'v02', 'V02', null, 'V02', 'V02', 'V02', false, true),
  ('V03', 'v03', 'V03', null, 'V03', 'V03', 'V03', false, true),
  ('V04', 'v04', 'V04', null, 'V04', 'V04', 'V04', false, true),
  ('V05', 'v05', 'V05', null, 'V05', 'V05', 'V05', false, true),
  ('V06', 'v06', 'V06', null, 'V06', 'V06', 'V06', false, true)
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
  cross join extra_level ll
  returning id, normalized_label, label
),
dependency_pairs as (
  select
    c.id as category_id,
    child_w.id as child_word_id,
    parent_w.id as parent_word_id
  from cosmetica c
  cross join extra_level el
  join public.skus_category_levels parent_level
    on parent_level.category_id = c.id
   and parent_level.key = 'format'
  join inserted_words child_w
    on child_w.normalized_label = '1.8'
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
  cross join extra_level el
  join public.skus_category_levels parent_level
    on parent_level.category_id = c.id
   and parent_level.key = 'format'
  join inserted_words child_w
    on child_w.normalized_label = '1.8'
  join public.skus_words parent_w
    on parent_w.category_level_id = parent_level.id
   and parent_w.normalized_label = 'recarga ecofill'
   and parent_w.reference_code = 'ECO'
   and parent_w.is_active = true
)
insert into public.skus_word_parent_edges (category_id, child_word_id, parent_word_id)
select category_id, child_word_id, parent_word_id
from dependency_pairs
where child_word_id is not null
on conflict (child_word_id, parent_word_id) do nothing;

commit;
