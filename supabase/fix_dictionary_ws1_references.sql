-- Corrige duplicados no MESMO nivel (WS1). Duplicados entre niveles distintos sao permitidos.
-- Ordem: sync_dictionary_ws1_(1).sql -> este script -> diagnose -> migracao indice.

begin;

-- Formato (ECO x3)
update public.skus_words set reference_code = 'GEF', updated_at = now()
where normalized_label = 'garrafa ecofill' and is_active = true;

update public.skus_words set reference_code = 'REF', updated_at = now()
where normalized_label = 'recarga ecofill' and is_active = true;

-- Produto (BOD x3)
update public.skus_words set reference_code = 'CLR', updated_at = now()
where normalized_label = 'creme limpeza rosto' and is_active = true;

update public.skus_words set reference_code = 'LMC', updated_at = now()
where normalized_label = 'loção mão corpo' and is_active = true;

-- Produto (GBD x2)
update public.skus_words set reference_code = 'GMC', updated_at = now()
where normalized_label = 'gel mãos corpo' and is_active = true;

-- Produto (PER x3 no mesmo nivel; PERRICONE e marca noutro nivel mantem PER)
update public.skus_words set reference_code = 'COL', updated_at = now()
where normalized_label = 'colonia' and is_active = true;

update public.skus_words set reference_code = 'FRG', updated_at = now()
where normalized_label = 'fragrancia' and is_active = true;

-- Produto (SAB x4)
update public.skus_words set reference_code = 'GMA', updated_at = now()
where normalized_label = 'gel mãos' and is_active = true;

update public.skus_words set reference_code = 'SLQ', updated_at = now()
where normalized_label = 'sab líquido' and is_active = true;

update public.skus_words set reference_code = 'SBE', updated_at = now()
where normalized_label = 'sabonete esfoliante' and is_active = true;

commit;
