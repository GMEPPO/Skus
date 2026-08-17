-- Executar no SQL Editor do Supabase quando OK2 antigos ficaram "completed" sem passar pelo gerador.
-- Repoe como pending todas as linhas OK2 importadas que ainda nao geraram SKU.

update public.skus_code_normalizations
set
  normalization_status = 'pending',
  completed_at = null,
  final_new_code = null,
  final_designation_pt = null,
  final_designation_es = null,
  final_designation_en = null
where normalization_status = 'completed'
  and generation_id is null
  and source_status ilike 'ok2';
