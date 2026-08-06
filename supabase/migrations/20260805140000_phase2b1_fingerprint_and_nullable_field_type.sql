-- Fase 2B.1 — Additive schema for catalog + fingerprint
-- Solo objetos public.skus_*. No tocar tablas ajenas.
-- NO incluye RPC generate_sku_secure / complete (eso es 2B.2).

begin;

-- Compat: niveles nuevos sin field_type legacy
alter table public.skus_words
  alter column default_field_type_id drop not null;

-- Fingerprint de combinación canónica (solo generaciones v2+)
alter table public.skus_sku_generations
  add column if not exists selection_fingerprint text null;

create unique index if not exists skus_sku_generations_selection_fingerprint_uidx
  on public.skus_sku_generations (selection_fingerprint)
  where selection_fingerprint is not null;

comment on column public.skus_sku_generations.selection_fingerprint is
  'Canonical combination hash for v2+ generations; NULL for historical v1';

commit;
