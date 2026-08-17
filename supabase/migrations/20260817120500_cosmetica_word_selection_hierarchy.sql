-- Hierarquia de selecao no gerador (embalagem vs outros dados / extra).
-- selection_hierarchy 1 = Nivel 5.xlsx "Tipo de Embalagem"
-- selection_hierarchy 2 = Nivel 5.xlsx "Outros Dados" (proximo nivel 6 / extra)

begin;

alter table public.skus_words
  add column if not exists selection_hierarchy smallint null
    check (selection_hierarchy is null or selection_hierarchy between 1 and 9);

comment on column public.skus_words.selection_hierarchy is
  'Grupo hierarquico no gerador. Ex.: 1=embalagem principal, 2=outros dados (extra). NULL=sem grupo.';

commit;
