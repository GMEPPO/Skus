-- Cosmetica / nivel 3 (product) — dicionario novo
-- Fonte: Nivel 3.xlsx (24 produtos + Vazio)
-- Nivel 3 depende apenas da categoria cosmetica (sem arestas pai-filho)
-- Traducoes conforme coluna de observacoes do Excel
-- ATENCAO: varias palavras partilham a mesma abreviatura (BOD(7), PER(4), CHA(2), GBD(2), SAB(4))

begin;

with cosmetica as (
  select id from public.skus_categories where slug = 'cosmetica' limit 1
),
product_level as (
  select cl.id, cl.legacy_field_type_id
  from public.skus_category_levels cl
  join cosmetica c on c.id = cl.category_id
  where cl.key = 'product'
  limit 1
),
removed_edges as (
  delete from public.skus_word_parent_edges e
  using public.skus_words w, product_level ll
  where e.child_word_id = w.id
    and w.category_level_id = ll.id
  returning e.id
),
removed_words as (
  delete from public.skus_words w
  using product_level ll
  where w.category_level_id = ll.id
  returning w.id
),
dictionary(label, normalized_label, reference_code, designation_pt, designation_es, designation_en, empty_designation, include_in_designation) as (
  values
  ('Vazio', 'vazio', '000', '', '', '', true, true),
  ('Amaciador', 'amaciador', 'CON', 'Condicionador', 'Acondicionador', 'Conditioner', false, true),
  ('Body Lotion', 'body lotion', 'BOD', 'Body Lotion', 'Body Lotion', 'Body Lotion', false, true),
  ('Bruma', 'bruma', 'PER', 'Bruma', 'Bruma', 'Mist', false, true),
  ('Champô', 'champô', 'CHA', 'Champô', 'Champú', 'Shampoo', false, true),
  ('Champô/Amaciador', 'champô/amaciador', 'CHA', 'Champô/Cond', 'Champú/Acond', 'Shampoo/Conditioner', false, true),
  ('Colonia', 'colonia', 'PER', 'Colonia', 'Colonia', 'Cologne', false, true),
  ('CREME DE NOITE', 'creme de noite', 'BOD', '', '', '', true, false),
  ('CREME FACIAL', 'creme facial', 'BOD', '', '', '', true, false),
  ('CREME LIMPEZA ROSTO', 'creme limpeza rosto', 'BOD', '', '', '', true, false),
  ('Creme Mãos', 'creme mãos', 'BOD', '', '', '', true, false),
  ('EAU DINAMIZANT', 'eau dinamizant', 'EAU', 'EAU', 'EAU', 'EAU', false, true),
  ('Fragrancia', 'fragrancia', 'PER', 'Fragrancia', 'Fragancia', 'Fragrance', false, true),
  ('Gel Banho', 'gel banho', 'GBD', 'Gel Banho', 'Gel de Baño', 'Shower Gel', false, true),
  ('Gel Corpo Cabelo', 'gel corpo cabelo', 'GCC', 'Gel Corp Cabelo', 'Gel Cuerpo Cabello', 'Body Hair Gel', false, true),
  ('Gel mãos', 'gel mãos', 'SAB', 'Gel mãos', 'Gel de manos', 'Hand Gel', false, true),
  ('Gel Mãos Corpo', 'gel mãos corpo', 'GBD', 'Gel Mãos Corpo', 'Gel Manos Cuerpo', 'Hand Body Gel', false, true),
  ('Loção Mão', 'loção mão', 'BOD', 'Loção Mão', 'Loción de manos', 'Hand Lotion', false, true),
  ('Loção Mão Corpo', 'loção mão corpo', 'BOD', 'Loção Mão Corpo', 'Loción Manos Cuerpo', 'Hand Body Lotion', false, true),
  ('OLEO PRODIGIOSO', 'oleo prodigioso', 'DIV', 'OLEO PRODIGIOSO', 'ACEITE PRODIGIOSO', 'PRODIGIOUS OIL', false, true),
  ('Perfume', 'perfume', 'PER', 'Perfume', 'Perfume', 'Perfume', false, true),
  ('Sab Líquido', 'sab líquido', 'SAB', 'Sab Líquido', 'Jabón Líquido', 'Liquid Soap', false, true),
  ('Sabonete', 'sabonete', 'SAB', 'Sabonete', 'Jabón', 'Soap', false, true),
  ('Sabonete Esfoliante', 'sabonete esfoliante', 'SAB', 'Sabonete Esfoliante', 'Jabón Exfoliante', 'Exfoliating Soap', false, true),
  ('Sais de Banho', 'sais de banho', 'SAI', 'Sais Banho', 'Sales de baño', 'Bath Salts', false, true)
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
cross join product_level ll
returning d.label, d.reference_code, d.designation_pt, d.designation_es, d.designation_en;

commit;
