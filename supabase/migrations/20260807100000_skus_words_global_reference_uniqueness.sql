-- Referencias activas unicas entre palavras (excepto 000 e nivel tamanho/gr/ml).
-- Executar diagnose_duplicate_word_references.sql antes se a migracao falhar.

create schema if not exists skus_private;

create or replace function skus_private.word_reference_global_key(
  p_reference_code text,
  p_field_type_id uuid,
  p_category_level_id uuid
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
    else upper(btrim(p_reference_code))
  end;
$$;

create unique index if not exists skus_words_reference_code_global_uidx
  on public.skus_words (
    skus_private.word_reference_global_key(reference_code, default_field_type_id, category_level_id)
  )
  where is_active = true
    and upper(btrim(reference_code)) <> '000';
