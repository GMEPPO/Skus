-- Modo de correspondencia entre varias palabras pai (OR vs AND).

begin;

alter table public.skus_words
  add column if not exists parent_match_mode text not null default 'any'
    check (parent_match_mode in ('any', 'all'));

comment on column public.skus_words.parent_match_mode is
  'any = basta um pai (OR); all = todos os pais (AND). Ignorado sem arestas.';

commit;
