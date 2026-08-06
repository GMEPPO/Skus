-- Fase 1A — Migración aditiva (revisión supervisor ChatGPT)
-- Aditiva / no destructiva. Sin UI, sin import Excel, sin RPC de finalización.
-- Ejecutar como una sola transacción.

begin;

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Helpers RBAC (search_path vacío + nombres cualificados)
-- Jerarquía: viewer=10, editor=20, manager=30, admin=40
-- ---------------------------------------------------------------------------
create or replace function public.skus_current_role_code()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select r.code
  from public.skus_profiles p
  join public.skus_roles r on r.id = p.role_id
  where p.id = auth.uid()
    and p.is_active = true
  limit 1;
$$;

create or replace function public.skus_has_min_role(required_role text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      case public.skus_current_role_code()
        when 'admin' then 40
        when 'manager' then 30
        when 'editor' then 20
        when 'viewer' then 10
        else 0
      end
    ) >= (
      case required_role
        when 'admin' then 40
        when 'manager' then 30
        when 'editor' then 20
        when 'viewer' then 10
        else 999
      end
    ),
    false
  );
$$;

revoke all on function public.skus_current_role_code() from public;
revoke all on function public.skus_current_role_code() from anon;
grant execute on function public.skus_current_role_code() to authenticated;

revoke all on function public.skus_has_min_role(text) from public;
revoke all on function public.skus_has_min_role(text) from anon;
grant execute on function public.skus_has_min_role(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 1) Categorías
-- ---------------------------------------------------------------------------
create table if not exists public.skus_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  name text not null,
  sort_order integer not null check (sort_order >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint skus_categories_slug_unique unique (slug)
);

insert into public.skus_categories (slug, name, sort_order, is_active)
values
  ('cosmetica', 'Cosmética', 1, true),
  ('dry-amenities', 'Dry Amenities', 2, true),
  ('accesorios', 'Accesorios', 3, true),
  ('equipamento', 'Equipamento', 4, true),
  ('personalizados', 'Personalizados', 5, true)
on conflict (slug) do update
set name = excluded.name,
    sort_order = excluded.sort_order,
    is_active = true,
    updated_at = now();

-- ---------------------------------------------------------------------------
-- 2) Niveles por categoría (solo cosmética sembrada)
-- ---------------------------------------------------------------------------
create table if not exists public.skus_category_levels (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.skus_categories(id) on delete restrict,
  key text not null,
  label text not null,
  sort_order integer not null check (sort_order >= 0),
  is_enabled boolean not null default true,
  is_required boolean not null default false,
  participates_in_code boolean not null default true,
  legacy_field_type_id uuid null references public.skus_field_types(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint skus_category_levels_category_key_unique unique (category_id, key)
);

create index if not exists skus_category_levels_category_sort_idx
  on public.skus_category_levels (category_id, sort_order);

-- Precondición: deben existir los 6 field_types legacy
do $$
declare
  v_missing integer;
begin
  select count(*) into v_missing
  from (
    values ('brand'), ('format'), ('product'), ('size'), ('packaging'), ('extra')
  ) as required(code)
  where not exists (
    select 1 from public.skus_field_types ft where ft.code = required.code and ft.is_active = true
  );

  if v_missing > 0 then
    raise exception 'phase1a_abort: missing legacy field_types for cosmetics levels (% missing)', v_missing;
  end if;
end $$;

with cosmetica as (
  select id from public.skus_categories where slug = 'cosmetica' limit 1
),
ft as (
  select code, id
  from public.skus_field_types
  where code in ('brand', 'format', 'product', 'size', 'packaging', 'extra')
)
insert into public.skus_category_levels (
  category_id, key, label, sort_order, is_enabled, is_required, participates_in_code, legacy_field_type_id
)
select
  c.id,
  v.key,
  v.label,
  v.sort_order,
  true,
  v.is_required,
  true,
  ft.id
from cosmetica c
cross join (
  values
    ('brand', 'Marca / Linha', 1, false),
    ('format', 'Formato', 2, false),
    ('product', 'Produto / Modelo', 3, false),
    ('size', 'Tamanho Formato', 4, false),
    ('packaging', 'Tipo embalagem', 5, false),
    ('extra', 'Outros', 6, false)
) as v(key, label, sort_order, is_required)
join ft on ft.code = v.key
on conflict (category_id, key) do update
set label = excluded.label,
    sort_order = excluded.sort_order,
    is_enabled = true,
    is_required = excluded.is_required,
    participates_in_code = excluded.participates_in_code,
    legacy_field_type_id = excluded.legacy_field_type_id,
    updated_at = now();

-- Abortar si un legacy_field_type_id mapea a más de un nivel cosmética
do $$
declare
  v_dup integer;
begin
  select count(*) into v_dup
  from (
    select cl.legacy_field_type_id
    from public.skus_category_levels cl
    join public.skus_categories c on c.id = cl.category_id
    where c.slug = 'cosmetica'
      and cl.legacy_field_type_id is not null
    group by cl.legacy_field_type_id
    having count(*) > 1
  ) d;

  if v_dup > 0 then
    raise exception 'phase1a_abort: ambiguous legacy_field_type_id mapping for cosmética levels';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 3) skus_words.category_level_id + backfill
-- ---------------------------------------------------------------------------
alter table public.skus_words
  add column if not exists category_level_id uuid null
    references public.skus_category_levels(id) on delete restrict;

create index if not exists skus_words_category_level_idx
  on public.skus_words (category_level_id);

update public.skus_words w
set category_level_id = cl.id,
    updated_at = now()
from public.skus_category_levels cl
join public.skus_categories c on c.id = cl.category_id
where w.category_level_id is null
  and c.slug = 'cosmetica'
  and cl.legacy_field_type_id = w.default_field_type_id;

do $$
declare
  v_unmapped integer;
begin
  select count(*) into v_unmapped
  from public.skus_words
  where category_level_id is null;

  if v_unmapped > 0 then
    raise exception 'phase1a_abort: % words remain without category_level_id after backfill', v_unmapped;
  end if;
end $$;

create unique index if not exists skus_words_normalized_category_level_uidx
  on public.skus_words (normalized_label, category_level_id)
  where category_level_id is not null;

-- ---------------------------------------------------------------------------
-- 4) skus_sku_generations: category_id + snapshot_version
-- ---------------------------------------------------------------------------
alter table public.skus_sku_generations
  add column if not exists category_id uuid null
    references public.skus_categories(id) on delete restrict,
  add column if not exists snapshot_version integer not null default 1;

create index if not exists skus_sku_generations_category_idx
  on public.skus_sku_generations (category_id);

update public.skus_sku_generations g
set category_id = c.id
from public.skus_categories c
where g.category_id is null
  and c.slug = 'cosmetica';

do $$
declare
  v_unmapped integer;
begin
  select count(*) into v_unmapped
  from public.skus_sku_generations
  where category_id is null;

  if v_unmapped > 0 then
    raise exception 'phase1a_abort: % generations remain without category_id after backfill', v_unmapped;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 5) Import batches + normalizations
-- ---------------------------------------------------------------------------
create table if not exists public.skus_normalization_import_batches (
  id uuid primary key default gen_random_uuid(),
  file_name text not null,
  file_sha256 text not null
    check (file_sha256 ~ '^[0-9a-f]{64}$'),
  status text not null check (status in ('processing', 'completed', 'failed')),
  total_rows integer not null default 0 check (total_rows >= 0),
  pending_rows integer not null default 0 check (pending_rows >= 0),
  completed_rows integer not null default 0 check (completed_rows >= 0),
  invalid_rows integer not null default 0 check (invalid_rows >= 0),
  imported_by uuid not null references public.skus_profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  completed_at timestamptz null,
  error_message text null,
  constraint skus_normalization_import_batches_sha_unique unique (file_sha256)
);

create table if not exists public.skus_code_normalizations (
  id uuid primary key default gen_random_uuid(),
  import_batch_id uuid not null references public.skus_normalization_import_batches(id) on delete restrict,
  source_row_number integer not null check (source_row_number > 0),

  -- Nullable: filas sin Referencia_antiga se conservan (cancelled + MISSING_LEGACY_CODE).
  legacy_code text null,
  legacy_designation text null,

  source_new_code text null,
  source_designation_pt text null,
  source_designation_es text null,
  source_designation_en text null,
  source_status text null,
  source_observations text null,

  normalization_status text not null default 'pending'
    check (normalization_status in ('pending', 'completed', 'cancelled')),
  category_id uuid null references public.skus_categories(id) on delete restrict,
  generation_id uuid null references public.skus_sku_generations(id) on delete restrict,

  final_new_code text null,
  final_designation_pt text null,
  final_designation_es text null,
  final_designation_en text null,

  import_issue text null,

  locked_by uuid null references public.skus_profiles(id) on delete restrict,
  locked_at timestamptz null,
  lock_expires_at timestamptz null,

  completed_by uuid null references public.skus_profiles(id) on delete restrict,
  completed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint skus_code_normalizations_batch_row_unique unique (import_batch_id, source_row_number),
  constraint skus_code_normalizations_lock_consistency check (
    (
      locked_by is null
      and locked_at is null
      and lock_expires_at is null
    )
    or (
      locked_by is not null
      and locked_at is not null
      and lock_expires_at is not null
      and lock_expires_at > locked_at
    )
  )
);

create index if not exists skus_code_normalizations_status_category_idx
  on public.skus_code_normalizations (normalization_status, category_id);

create index if not exists skus_code_normalizations_legacy_code_idx
  on public.skus_code_normalizations (legacy_code);

create index if not exists skus_code_normalizations_pending_lock_idx
  on public.skus_code_normalizations (normalization_status, lock_expires_at)
  where normalization_status = 'pending';

-- ---------------------------------------------------------------------------
-- 6) RLS + privilegios SELECT (sin writes directas authenticated)
-- ---------------------------------------------------------------------------
alter table public.skus_categories enable row level security;
alter table public.skus_category_levels enable row level security;
alter table public.skus_normalization_import_batches enable row level security;
alter table public.skus_code_normalizations enable row level security;

revoke all on table public.skus_categories from public;
revoke all on table public.skus_categories from anon;
grant select on table public.skus_categories to authenticated;

revoke all on table public.skus_category_levels from public;
revoke all on table public.skus_category_levels from anon;
grant select on table public.skus_category_levels to authenticated;

revoke all on table public.skus_normalization_import_batches from public;
revoke all on table public.skus_normalization_import_batches from anon;
grant select on table public.skus_normalization_import_batches to authenticated;

revoke all on table public.skus_code_normalizations from public;
revoke all on table public.skus_code_normalizations from anon;
grant select on table public.skus_code_normalizations to authenticated;

drop policy if exists "skus_categories_select_authenticated" on public.skus_categories;
create policy "skus_categories_select_authenticated"
on public.skus_categories for select to authenticated using (true);

drop policy if exists "skus_category_levels_select_authenticated" on public.skus_category_levels;
create policy "skus_category_levels_select_authenticated"
on public.skus_category_levels for select to authenticated using (true);

drop policy if exists "skus_normalization_import_batches_select_authenticated" on public.skus_normalization_import_batches;
create policy "skus_normalization_import_batches_select_authenticated"
on public.skus_normalization_import_batches for select to authenticated using (true);

drop policy if exists "skus_code_normalizations_select_authenticated" on public.skus_code_normalizations;
create policy "skus_code_normalizations_select_authenticated"
on public.skus_code_normalizations for select to authenticated using (true);

-- ---------------------------------------------------------------------------
-- 7) RPC claim / renew / release
-- ---------------------------------------------------------------------------
create or replace function public.claim_sku_normalization(p_normalization_id uuid)
returns public.skus_code_normalizations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.skus_code_normalizations;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  if not public.skus_has_min_role('editor') then
    raise exception 'forbidden';
  end if;

  update public.skus_code_normalizations n
  set
    locked_by = v_uid,
    locked_at = now(),
    lock_expires_at = now() + interval '10 minutes',
    updated_at = now()
  where n.id = p_normalization_id
    and n.normalization_status = 'pending'
    and (
      n.locked_by is null
      or n.lock_expires_at < now()
      or n.locked_by = v_uid
    )
  returning * into v_row;

  if v_row.id is null then
    select * into v_row
    from public.skus_code_normalizations n
    where n.id = p_normalization_id;

    if v_row.id is null then
      raise exception 'not_found';
    end if;
    if v_row.normalization_status = 'completed' then
      raise exception 'completed';
    end if;
    if v_row.normalization_status = 'cancelled' then
      raise exception 'cancelled';
    end if;
    if v_row.locked_by is not null
       and v_row.locked_by <> v_uid
       and v_row.lock_expires_at is not null
       and v_row.lock_expires_at >= now() then
      raise exception 'locked_by_other_user';
    end if;
    raise exception 'claim_failed';
  end if;

  return v_row;
end;
$$;

create or replace function public.renew_sku_normalization_claim(p_normalization_id uuid)
returns public.skus_code_normalizations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.skus_code_normalizations;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  if not public.skus_has_min_role('editor') then
    raise exception 'forbidden';
  end if;

  -- No renovar locks expirados: debe volver a claim
  update public.skus_code_normalizations n
  set
    lock_expires_at = now() + interval '10 minutes',
    updated_at = now()
  where n.id = p_normalization_id
    and n.normalization_status = 'pending'
    and n.locked_by = v_uid
    and n.lock_expires_at is not null
    and n.lock_expires_at >= now()
  returning * into v_row;

  if v_row.id is null then
    raise exception 'renew_failed';
  end if;

  return v_row;
end;
$$;

create or replace function public.release_sku_normalization_claim(p_normalization_id uuid)
returns public.skus_code_normalizations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.skus_code_normalizations;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  if not public.skus_has_min_role('editor') then
    raise exception 'forbidden';
  end if;

  update public.skus_code_normalizations n
  set
    locked_by = null,
    locked_at = null,
    lock_expires_at = null,
    updated_at = now()
  where n.id = p_normalization_id
    and n.normalization_status = 'pending'
    and n.locked_by = v_uid
  returning * into v_row;

  if v_row.id is null then
    raise exception 'release_failed';
  end if;

  return v_row;
end;
$$;

revoke all on function public.claim_sku_normalization(uuid) from public;
revoke all on function public.claim_sku_normalization(uuid) from anon;
grant execute on function public.claim_sku_normalization(uuid) to authenticated;

revoke all on function public.renew_sku_normalization_claim(uuid) from public;
revoke all on function public.renew_sku_normalization_claim(uuid) from anon;
grant execute on function public.renew_sku_normalization_claim(uuid) to authenticated;

revoke all on function public.release_sku_normalization_claim(uuid) from public;
revoke all on function public.release_sku_normalization_claim(uuid) from anon;
grant execute on function public.release_sku_normalization_claim(uuid) to authenticated;

commit;
