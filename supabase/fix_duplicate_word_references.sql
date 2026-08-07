-- Corrige referencias duplicadas detectadas em diagnose_duplicate_word_references.sql.
-- Mantem a referencia mais representativa em cada grupo; renomeia as restantes.
-- REVISAR antes de executar: SKUs ja gerados conservam o codigo antigo no historico.
-- Apos executar, voltar a correr diagnose_duplicate_word_references.sql (0 linhas)
-- e depois 20260807100000_skus_words_global_reference_uniqueness.sql

begin;

-- Tamanho: gr vs ml
update public.skus_words set reference_code = '30G', updated_at = now()
where id = 'f8554012-d4fa-4e60-97a3-695204637205'; -- 30gr

update public.skus_words set reference_code = '30M', updated_at = now()
where id = '6920148a-6bd5-4796-8d93-d2567b3bb833'; -- 30ml

update public.skus_words set reference_code = '40G', updated_at = now()
where id = 'ef5f73df-bd02-4a61-821e-23dcf5a6b340'; -- 40gr

update public.skus_words set reference_code = '40M', updated_at = now()
where id = '9534333b-99b0-41c8-8619-6d11315ca317'; -- 40ml

-- ALE: mantem ALE em BENAMOR ALECRIM
update public.skus_words set reference_code = 'ALO', updated_at = now()
where id = '7fc7c5b8-a9a4-4382-be31-8cd8d045c6f0'; -- ALLEGRO

-- ALG: mantem ALG em ALGOTHERM
update public.skus_words set reference_code = 'AGD', updated_at = now()
where id = 'e68c9e24-3e54-491a-b5f5-9b7530b14087'; -- ALGODÃO

-- BOD: mantem BOD em Body Lotion
update public.skus_words set reference_code = 'CLR', updated_at = now()
where id = '8a35bd9e-f17b-42f9-85ee-b0b3a4815037'; -- CREME LIMPEZA ROSTO

update public.skus_words set reference_code = 'LMC', updated_at = now()
where id = '2d716716-0145-4905-b9ea-74b340f94db2'; -- Loção Mão Corpo

-- ECO: mantem ECO em ECOFILL
update public.skus_words set reference_code = 'GEF', updated_at = now()
where id = 'a203e6a5-e995-49f0-b15d-bfc26ee1e7b8'; -- Garrafa Ecofill

update public.skus_words set reference_code = 'REF', updated_at = now()
where id = '1f60bae5-7b8a-4800-a2db-6ed6bd071dcc'; -- Recarga Ecofill

-- GBD: mantem GBD em Gel Banho
update public.skus_words set reference_code = 'GMC', updated_at = now()
where id = '77d270d6-26f6-47c8-bdf5-55c5630df6d0'; -- Gel Mãos Corpo

-- PER: mantem PER em Perfume; PRC para marca PERRICONE
update public.skus_words set reference_code = 'COL', updated_at = now()
where id = '85709218-41cb-47ad-b06d-28e84c5f4675'; -- Colonia

update public.skus_words set reference_code = 'FRG', updated_at = now()
where id = 'e5fe2752-533f-4895-833c-ed2429a56681'; -- Fragrancia

update public.skus_words set reference_code = 'PRC', updated_at = now()
where id = '4648358d-0951-4ad3-983a-ff49aee057e7'; -- PERRICONE

-- PLC: mantem PLC na palavra PLC
update public.skus_words set reference_code = 'PCB', updated_at = now()
where id = '79755574-8d28-43e5-a5a7-dbe683a2214f'; -- Policarbonato

-- PLP: mantem PLP na palavra PLP (PPL ja e Papel no dicionario)
update public.skus_words set reference_code = 'PPN', updated_at = now()
where id = '6dbfe49c-06b2-4d04-954c-5df95418011a'; -- Polipropileno

-- SAB: mantem SAB em Sabonete
update public.skus_words set reference_code = 'GMA', updated_at = now()
where id = '8936d2af-be62-49bf-a0a8-31d347520610'; -- Gel mãos

update public.skus_words set reference_code = 'SLQ', updated_at = now()
where id = '8f067704-95b1-4dfe-a271-5bbe892325c0'; -- Sab Líquido

update public.skus_words set reference_code = 'SBE', updated_at = now()
where id = 'fac116be-e29f-40d3-ae76-cad9c43ca006'; -- Sabonete Esfoliante

commit;

-- Verificacao: deve devolver 0 linhas
select
  upper(btrim(w.reference_code)) as referencia,
  count(*) as total
from public.skus_words w
where w.is_active = true
  and upper(btrim(w.reference_code)) <> '000'
group by 1
having count(*) > 1
order by total desc, referencia;
