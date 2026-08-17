-- Dicionario cosmetica v2: dependencias entre palavras por categoria.
-- Palavra filha so aparece no gerador se a palavra pai estiver selecionada.
-- Nivel 1 (brand) nao usa arestas: todas as marcas aparecem ao escolher cosmetica.

begin;

create table if not exists public.skus_word_parent_edges (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.skus_categories(id) on delete cascade,
  child_word_id uuid not null references public.skus_words(id) on delete cascade,
  parent_word_id uuid not null references public.skus_words(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint skus_word_parent_edges_child_parent_unique unique (child_word_id, parent_word_id),
  constraint skus_word_parent_edges_no_self check (child_word_id <> parent_word_id)
);

create index if not exists skus_word_parent_edges_category_idx
  on public.skus_word_parent_edges (category_id);

create index if not exists skus_word_parent_edges_parent_idx
  on public.skus_word_parent_edges (parent_word_id);

create index if not exists skus_word_parent_edges_child_idx
  on public.skus_word_parent_edges (child_word_id);

comment on table public.skus_word_parent_edges is
  'Restringe palavras filhas a aparecerem apenas quando a palavra pai esta selecionada no gerador.';

alter table public.skus_word_parent_edges enable row level security;

revoke all on table public.skus_word_parent_edges from public;
revoke all on table public.skus_word_parent_edges from anon;
grant select on table public.skus_word_parent_edges to authenticated;

drop policy if exists "skus_word_parent_edges_select_authenticated" on public.skus_word_parent_edges;
create policy "skus_word_parent_edges_select_authenticated"
on public.skus_word_parent_edges
for select
to authenticated
using (true);

commit;
