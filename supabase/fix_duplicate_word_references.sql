-- Corrige duplicados no MESMO nivel (duplicados entre niveles distintos sao permitidos).
-- REVISAR antes de executar: SKUs ja gerados conservam o codigo antigo no historico.
-- Apos executar, voltar a correr diagnose_duplicate_word_references.sql (0 linhas)
-- e depois 20260807100000_skus_words_global_reference_uniqueness.sql

begin;

-- Formato (ECO x3)
update public.skus_words set reference_code = 'GEF', updated_at = now()
where id = 'a203e6a5-e995-49f0-b15d-bfc26ee1e7b8'; -- Garrafa Ecofill

update public.skus_words set reference_code = 'REF', updated_at = now()
where id = '1f60bae5-7b8a-4800-a2db-6ed6bd071dcc'; -- Recarga Ecofill

-- Produto (BOD x3)
update public.skus_words set reference_code = 'CLR', updated_at = now()
where id = '8a35bd9e-f17b-42f9-85ee-b0b3a4815037'; -- CREME LIMPEZA ROSTO

update public.skus_words set reference_code = 'LMC', updated_at = now()
where id = '2d716716-0145-4905-b9ea-74b340f94db2'; -- Loção Mão Corpo

-- Produto (GBD x2)
update public.skus_words set reference_code = 'GMC', updated_at = now()
where id = '77d270d6-26f6-47c8-bdf5-55c5630df6d0'; -- Gel Mãos Corpo

-- Produto (PER x3 no mesmo nivel)
update public.skus_words set reference_code = 'COL', updated_at = now()
where id = '85709218-41cb-47ad-b06d-28e84c5f4675'; -- Colonia

update public.skus_words set reference_code = 'FRG', updated_at = now()
where id = 'e5fe2752-533f-4895-833c-ed2429a56681'; -- Fragrancia

-- Produto (SAB x4)
update public.skus_words set reference_code = 'GMA', updated_at = now()
where id = '8936d2af-be62-49bf-a0a8-31d347520610'; -- Gel mãos

update public.skus_words set reference_code = 'SLQ', updated_at = now()
where id = '8f067704-95b1-4dfe-a271-5bbe892325c0'; -- Sab Líquido

update public.skus_words set reference_code = 'SBE', updated_at = now()
where id = 'fac116be-e29f-40d3-ae76-cad9c43ca006'; -- Sabonete Esfoliante

commit;

-- Verificacao por nivel: deve devolver 0 linhas.
with word_scopes as (
  select
    w.category_level_id,
    w.reference_code,
    w.normalized_label,
    coalesce(ft_direct.code, ft_level.code, '') as field_type_code
  from public.skus_words w
  left join public.skus_category_levels cl on cl.id = w.category_level_id
  left join public.skus_field_types ft_direct on ft_direct.id = w.default_field_type_id
  left join public.skus_field_types ft_level on ft_level.id = cl.legacy_field_type_id
  where w.is_active = true
    and upper(btrim(w.reference_code)) <> '000'
    and w.category_level_id is not null
    and coalesce(ft_direct.code, ft_level.code, '') <> 'size'
)
select
  category_level_id,
  upper(btrim(reference_code)) as referencia,
  count(distinct normalized_label) as palavras_distintas
from word_scopes
group by category_level_id, upper(btrim(reference_code))
having count(distinct normalized_label) > 1
order by palavras_distintas desc, referencia;
