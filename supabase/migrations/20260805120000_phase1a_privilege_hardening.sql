-- Fase 1A — Privilege hardening (post-aplicación)
-- Idempotente. Solo tablas public.skus_* de Fase 1A.
-- No tocar tablas ajenas al dominio SKUS.

begin;

revoke all on table public.skus_categories from public;
revoke all on table public.skus_categories from anon;
revoke all on table public.skus_categories from authenticated;
grant select on table public.skus_categories to authenticated;

revoke all on table public.skus_category_levels from public;
revoke all on table public.skus_category_levels from anon;
revoke all on table public.skus_category_levels from authenticated;
grant select on table public.skus_category_levels to authenticated;

revoke all on table public.skus_normalization_import_batches from public;
revoke all on table public.skus_normalization_import_batches from anon;
revoke all on table public.skus_normalization_import_batches from authenticated;
grant select on table public.skus_normalization_import_batches to authenticated;

revoke all on table public.skus_code_normalizations from public;
revoke all on table public.skus_code_normalizations from anon;
revoke all on table public.skus_code_normalizations from authenticated;
grant select on table public.skus_code_normalizations to authenticated;

commit;
