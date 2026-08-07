-- Referencias unicas por nivel (excepto 000 e tamanhos gr/ml/kg/l).
-- Duplicados entre niveles distintos sao permitidos.
-- Executar diagnose_duplicate_word_references.sql antes se a migracao falhar.

create schema if not exists skus_private;

drop index if exists public.skus_words_reference_code_global_uidx;

create or replace function skus_private.word_reference_level_key(
  p_reference_code text,
  p_category_level_id uuid,
  p_field_type_id uuid
)
returns text
language sql
stable
as $$
  select case
    when upper(btrim(coalesce(p_reference_code, ''))) = '000' then null
    when coalesce(
      (select ft.code from public.skus_field_types ft where ft.id = p_field_type_id),
      (
        select ft.code
        from public.skus_category_levels cl
        join public.skus_field_types ft on ft.id = cl.legacy_field_type_id
        where cl.id = p_category_level_id
      ),
      ''
    ) = 'size' then null
    when p_category_level_id is null then null
    else p_category_level_id::text || '|' || upper(btrim(p_reference_code))
  end;
$$;

create unique index if not exists skus_words_reference_code_level_uidx
  on public.skus_words (
    skus_private.word_reference_level_key(reference_code, category_level_id, default_field_type_id)
  )
  where is_active = true
    and upper(btrim(reference_code)) <> '000';
