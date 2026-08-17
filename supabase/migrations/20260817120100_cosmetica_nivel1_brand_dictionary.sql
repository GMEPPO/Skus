-- Cosmetica / nivel 1 (brand) — dicionario novo
-- Fonte: nivel 1.xlsx (60 marcas + Vazio)
-- Nivel 1 depende apenas da categoria cosmetica (sem arestas pai-filho)
-- Executar apos 20260817120000_cosmetica_dictionary_dependencies.sql

begin;

delete from public.skus_word_parent_edges e
using public.skus_words w,
      public.skus_category_levels cl,
      public.skus_categories c
where e.child_word_id = w.id
  and c.id = cl.category_id
  and c.slug = 'cosmetica'
  and cl.key = 'brand'
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
  and cl.key = 'brand'
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
brand_level as (
  select cl.id, cl.legacy_field_type_id
  from public.skus_category_levels cl
  join cosmetica c on c.id = cl.category_id
  where cl.key = 'brand'
  limit 1
),
dictionary(label, normalized_label, reference_code, designation_pt, designation_es, designation_en, include_in_designation) as (
  values
  ('Vazio', 'vazio', '000', '', '', '', true),
  ('ACH BRITO LAVANDA', 'ach brito lavanda', 'ACB', 'ACHB LAVANDA', 'ACHB LAVANDA', 'ACHB LAVANDA', true),
  ('ALGOTHERM OCEAN SPA', 'algotherm ocean spa', 'ALG', 'ALG OCEAN SPA', 'ALG OCEAN SPA', 'ALG OCEAN SPA', true),
  ('ALQVIMIA', 'alqvimia', 'ALQ', 'ALQVIMIA', 'ALQVIMIA', 'ALQVIMIA', true),
  ('AMIMO', 'amimo', 'AMI', 'AMIMO', 'AMIMO', 'AMIMO', true),
  ('ANNE SEMONIN', 'anne semonin', 'ASE', 'AN SEMNONIN', 'AN SEMNONIN', 'AN SEMNONIN', true),
  ('ATELIER COLOGNE POMELO', 'atelier cologne pomelo', 'ATC', 'AT COLOG POMELO', 'AT COLOG POMELO', 'AT COLOG POMELO', true),
  ('AZZARO', 'azzaro', 'AZZ', 'AZZARO', 'AZZARO', 'AZZARO', true),
  ('BALTIC BLISS', 'baltic bliss', 'BLT', 'B BLISS', 'B BLISS', 'B BLISS', true),
  ('BENAMOR ALECRIM', 'benamor alecrim', 'ALE', 'BEN ALECRIM', 'BEN ALECRIM', 'BEN ALECRIM', true),
  ('BENAMOR GORDISSIMO', 'benamor gordissimo', 'GOR', 'BEN GORDISSIMO', 'BEN GORDISSIMO', 'BEN GORDISSIMO', true),
  ('BIENVENUE', 'bienvenue', 'BIE', 'BIENVENUE', 'BIENVENUE', 'BIENVENUE', true),
  ('CAMPOS IBIZA', 'campos ibiza', 'CIB', 'C IBIZA', 'C IBIZA', 'C IBIZA', true),
  ('CASTELBEL FLOR DE ALGODÃO', 'castelbel flor de algodão', 'FAL', 'CAS FLOR ALGODA', 'CAS FLOR ALGODA', 'CAS FLOR ALGODA', true),
  ('CASTELBEL LARANJA VERBENA', 'castelbel laranja verbena', 'LVE', 'CAS LARANJA VER', 'CAS LARANJA VER', 'CAS LARANJA VER', true),
  ('CASTELBEL PINK LILY', 'castelbel pink lily', 'CAS', 'CAS PINK LILY', 'CAS PINK LILY', 'CAS PINK LILY', true),
  ('CERERIA MOLLA BLACK ORCHID', 'cereria molla black orchid', 'CMO', 'CERERIA BLACK ORC', 'CERERIA BLACK ORC', 'CERERIA BLACK ORC', true),
  ('CERERIA MOLLA BULG ROSE', 'cereria molla bulg rose', 'CMR', 'CERERIA BULG ROSE', 'CERERIA BULG ROSE', 'CERERIA BULG ROSE', true),
  ('CINQ MONDES', 'cinq mondes', 'CQM', 'C MONDES', 'C MONDES', 'C MONDES', true),
  ('CLARINS', 'clarins', 'CLA', 'CLARINS EAU DIN', 'CLARINS EAU DIN', 'CLARINS EAU DIN', true),
  ('CODAGE', 'codage', 'COD', 'CODAGE', 'CODAGE', 'CODAGE', true),
  ('COMPAGNIE PROVENCE BOIS OLIVIER', 'compagnie provence bois olivier', 'CBO', 'CDP BOIS OLIVIE', 'CDP BOIS OLIVIE', 'CDP BOIS OLIVIE', true),
  ('COMPAGNIE PROVENCE MINT BASIL', 'compagnie provence mint basil', 'CMB', 'CDP MINT BASIL', 'CDP MINT BASIL', 'CDP MINT BASIL', true),
  ('DAMANA E&S', 'damana e&s', 'DAM', 'DAM E&S', 'DAM E&S', 'DAM E&S', true),
  ('DAMANA ORGANIC', 'damana organic', 'DOR', 'DAM ORGANIC', 'DAM ORGANIC', 'DAM ORGANIC', true),
  ('DAVEIA', 'daveia', 'DAV', 'DAVEIA', 'DAVEIA', 'DAVEIA', true),
  ('EDPFM INDELEBIL', 'edpfm indelebil', 'FCI', 'EDPFM INDELEBIL', 'EDPFM INDELEBIL', 'EDPFM INDELEBIL', true),
  ('EDPFM MAGNOLIA', 'edpfm magnolia', 'FRM', 'EDPFM MAGNOLIA', 'EDPFM MAGNOLIA', 'EDPFM MAGNOLIA', true),
  ('FAACE', 'faace', 'FAA', 'FAACE', 'FAACE', 'FAACE', true),
  ('FRAGONARD FIGIER FLEUR', 'fragonard figier fleur', 'FGF', 'FRAG FIG FLEUR', 'FRAG FIG FLEUR', 'FRAG FIG FLEUR', true),
  ('FRAGONARD SOLEIL DE GRASSE', 'fragonard soleil de grasse', 'SLG', 'FRAG SOL GRASSE', 'FRAG SOL GRASSE', 'FRAG SOL GRASSE', true),
  ('FRAGONARD VRAI', 'fragonard vrai', 'VRA', 'FRAG VRAI', 'FRAG VRAI', 'FRAG VRAI', true),
  ('GUERLAIN ABEILLE', 'guerlain abeille', 'GUE', 'GUERLAIN ABEILL', 'GUERLAIN ABEILL', 'GUERLAIN ABEILL', true),
  ('HEIPOA', 'heipoa', 'HPO', 'HEIPOA', 'HEIPOA', 'HEIPOA', true),
  ('KEIJI', 'keiji', 'KEI', 'KEIJI', 'KEIJI', 'KEIJI', true),
  ('LAB PERFUMES', 'lab perfumes', 'LAB', 'LAB PERFUMES', 'LAB PERFUMES', 'LAB PERFUMES', true),
  ('LE PETIT PRINCE', 'le petit prince', 'LPP', 'LPP', 'LPP', 'LPP', true),
  ('MEMO PARIS', 'memo paris', 'MMP', 'MEMO IRISH L', 'MEMO IRISH L', 'MEMO IRISH L', true),
  ('MINE ALLERIA', 'mine alleria', 'MNA', 'MINE ALLERIA', 'MINE ALLERIA', 'MINE ALLERIA', true),
  ('NKI', 'nki', 'NKI', 'NKI', 'NKI', 'NKI', true),
  ('NUXE PRESTIGE', 'nuxe prestige', 'NUP', 'NUXE PRESTIGE', 'NUXE PRESTIGE', 'NUXE PRESTIGE', true),
  ('NUXE REVE MIEL', 'nuxe reve miel', 'NUX', 'NUXE REVE MIEL', 'NUXE REVE MIEL', 'NUXE REVE MIEL', true),
  ('OCCEAN', 'occean', 'OCC', 'OCCEAN', 'OCCEAN', 'OCCEAN', true),
  ('OMNISENS', 'omnisens', 'OMN', 'OMNISENS', 'OMNISENS', 'OMNISENS', true),
  ('PASCAL MORABITO', 'pascal morabito', 'PMO', 'P MORABITO', 'P MORABITO', 'P MORABITO', true),
  ('PERRICONE', 'perricone', 'PER', 'PERRICONE', 'PERRICONE', 'PERRICONE', true),
  ('PHYTOMER', 'phytomer', 'PHY', 'PHYTOMER', 'PHYTOMER', 'PHYTOMER', true),
  ('PORTUS CALE GOLD&BLUE', 'portus cale gold&blue', 'G&B', 'PC GOLD BLUE', 'PC GOLD BLUE', 'PC GOLD BLUE', true),
  ('PORTUS CALE PLUM FLOWER', 'portus cale plum flower', 'PLF', 'PC PLUM FLOWER', 'PC PLUM FLOWER', 'PC PLUM FLOWER', true),
  ('PORTUS CALE RUBY RED', 'portus cale ruby red', 'RUB', 'PC RUBY RED', 'PC RUBY RED', 'PC RUBY RED', true),
  ('RAIZ', 'raiz', 'RAI', 'RAIZ', 'RAIZ', 'RAIZ', true),
  ('REAL SABOARIA ALGAE', 'real saboaria algae', 'GAE', 'RS ALGAE', 'RS ALGAE', 'RS ALGAE', true),
  ('REAL SABOARIA FILIGRANA', 'real saboaria filigrana', 'FIL', 'RS FILIGRANA', 'RS FILIGRANA', 'RS FILIGRANA', true),
  ('REAL SABOARIA FLOR DOS POEMAS', 'real saboaria flor dos poemas', 'FDP', 'RS FLOR POEMAS', 'RS FLOR POEMAS', 'RS FLOR POEMAS', true),
  ('SCANDINAVIAN WHITE', 'scandinavian white', 'SWH', 'SCAND WHITE', 'SCAND WHITE', 'SCAND WHITE', true),
  ('SUNDARI', 'sundari', 'SUN', 'SUNDARI', 'SUNDARI', 'SUNDARI', true),
  ('THE VERT', 'the vert', 'THV', 'THE VERT', 'THE VERT', 'THE VERT', true),
  ('TRUSSARDI', 'trussardi', 'TRU', 'TRUSSARDI', 'TRUSSARDI', 'TRUSSARDI', true),
  ('TYPOLOGY', 'typology', 'TYP', 'TYPOLOGY', 'TYPOLOGY', 'TYPOLOGY', true),
  ('VINESIME', 'vinesime', 'VIS', 'VINESIME', 'VINESIME', 'VINESIME', true),
  ('WHITE TEA', 'white tea', 'WHT', 'WHITE TEA', 'WHITE TEA', 'WHITE TEA', true)
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
  bl.id,
  bl.legacy_field_type_id,
  coalesce(nullif(btrim(d.designation_pt), ''), d.label),
  coalesce(nullif(btrim(d.designation_pt), ''), d.label),
  coalesce(nullif(btrim(d.designation_es), ''), coalesce(nullif(btrim(d.designation_pt), ''), d.label)),
  coalesce(nullif(btrim(d.designation_en), ''), coalesce(nullif(btrim(d.designation_pt), ''), d.label)),
  d.include_in_designation,
  true
from dictionary d
cross join brand_level bl
returning label, reference_code;

-- Verificacao rapida pos-carga (executar manualmente se quiser):
-- select count(*) from public.skus_words w
-- join public.skus_category_levels cl on cl.id = w.category_level_id
-- join public.skus_categories c on c.id = cl.category_id
-- where c.slug = 'cosmetica' and cl.key = 'brand' and w.is_active = true;

commit;
