-- Cosmetica / nivel 2 (format) — dicionario novo
-- Fonte: Nivel 2.xlsx (15 formatos + Vazio)
-- Nivel 2 depende apenas da categoria cosmetica (sem arestas pai-filho)
-- Traducoes conforme coluna de observacoes do Excel
-- ATENCAO: Garrafa Ecofill e Recarga Ecofill partilham referencia ECO (validar antes de aplicar)

begin;

with cosmetica as (
  select id from public.skus_categories where slug = 'cosmetica' limit 1
),
format_level as (
  select cl.id, cl.legacy_field_type_id
  from public.skus_category_levels cl
  join cosmetica c on c.id = cl.category_id
  where cl.key = 'format'
  limit 1
),
removed_edges as (
  delete from public.skus_word_parent_edges e
  using public.skus_words w, format_level ll, cosmetica c
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
              and cl.key = 'format'
              and cl.id = w.category_level_id
          )
        )
      )
    )
  returning e.id
),
removed_words as (
  delete from public.skus_words w
  using format_level ll, cosmetica c
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
             and cl.key = 'format'
             and cl.id = w.category_level_id
         )
       )
     )
  returning w.id
),
dictionary(label, normalized_label, reference_code, designation_pt, designation_es, designation_en, include_in_designation) as (
  values
  ('Vazio', 'vazio', '000', '', '', '', false),
  ('Bisnaga', 'bisnaga', 'BIS', 'Bisnaga', 'Bisnaga', 'Sachet', false),
  ('Boião', 'boião', 'BOI', 'Boião', 'Tarro', 'Jar', false),
  ('Ecopump', 'ecopump', 'ECP', 'Ecopump', 'Ecopump', 'Ecopump', false),
  ('ESTOJO', 'estojo', 'EST', 'ESTOJO', 'ESTUCHE', 'Case', false),
  ('Frasco', 'frasco', 'FRA', 'Frasco', 'Frasco', 'Bottle', false),
  ('Garrafa Ecofill', 'garrafa ecofill', 'ECO', 'Garrafa Ecofill', 'Botella Ecofill', 'Bottle Ecofill', false),
  ('Ghost', 'ghost', 'GHT', 'Ghost', 'Ghost', 'Ghost', false),
  ('Manhattan', 'manhattan', 'MAN', 'Manhattan', 'Manhattan', 'Manhattan', false),
  ('Recarga 5L', 'recarga 5l', 'REC', 'Recarga 5L', 'Rec 5L', 'Ref 5L', false),
  ('Recarga Ecofill', 'recarga ecofill', 'ECO', 'Recarga Ecofill', 'Recarga Ecofill', 'Refill Ecofill', false),
  ('Recarga Ecosouc', 'recarga ecosouc', 'ECS', 'Recarga Ecosouc', 'Recarga Ecosouc', 'Refill Ecosouc', false),
  ('Sólido', 'sólido', 'SOL', 'Sólido', 'Sólido', 'Solid', false),
  ('Stick', 'stick', 'STI', 'Stick', 'Stick', 'Stick', false),
  ('TABULEIRO', 'tabuleiro', 'TAB', 'TABULEIRO', 'Bandeja', 'Tray', false),
  ('Vela', 'vela', 'VEL', 'Vela', 'Vela', 'Candle', false)
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
  ll.id,
  ll.legacy_field_type_id,
  coalesce(nullif(btrim(d.designation_pt), ''), d.label),
  coalesce(nullif(btrim(d.designation_pt), ''), d.label),
  coalesce(nullif(btrim(d.designation_es), ''), coalesce(nullif(btrim(d.designation_pt), ''), d.label)),
  coalesce(nullif(btrim(d.designation_en), ''), coalesce(nullif(btrim(d.designation_pt), ''), d.label)),
  d.include_in_designation,
  true
from dictionary d
cross join format_level ll
returning label, reference_code, designation_pt, designation_es, designation_en;

commit;
