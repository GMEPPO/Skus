-- Permite varias palavras activas com a mesma referencia no mesmo nivel.
-- A validacao passa a ser apenas um aviso na UI ao criar/editar palavras.

begin;

drop index if exists public.skus_words_reference_code_level_uidx;

commit;
