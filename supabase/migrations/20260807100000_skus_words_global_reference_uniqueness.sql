-- Referencias activas globalmente unicas (excepto 000, permitido una por nivel).
-- Executar diagnose_duplicate_word_references.sql antes se a migracao falhar.

create unique index if not exists skus_words_reference_code_global_uidx
  on public.skus_words (upper(btrim(reference_code)))
  where is_active = true
    and upper(btrim(reference_code)) <> '000';
