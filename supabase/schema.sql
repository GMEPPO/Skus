-- Schema base del proyecto SKU con biblioteca global de 6 niveles.
--
-- Para resetear datos e importar Sabsol.xlsx, ejecuta:
--   supabase/reset_global_sku_library.sql

create extension if not exists "pgcrypto";

create table if not exists public.skus_roles (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.skus_permissions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.skus_role_permissions (
  role_id uuid not null references public.skus_roles(id) on delete cascade,
  permission_id uuid not null references public.skus_permissions(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (role_id, permission_id)
);

create table if not exists public.skus_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role_id uuid not null references public.skus_roles(id),
  name text not null,
  email text not null,
  department text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.skus_field_types (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.skus_field_types (code, name, description, sort_order, is_active)
values
  ('brand', 'Familia/Marca', 'Marca o familia comercial que abre la referencia SKU.', 1, true),
  ('format', 'Formato', 'Tipo/formato tecnico del producto.', 2, true),
  ('product', 'Produto', 'Producto o variante comercial.', 3, true),
  ('size', 'Tamanho/Gramaje', 'Tamanho, gramaje o capacidad.', 4, true),
  ('packaging', 'Embalagem', 'Tipo de embalaje.', 5, true),
  ('extra', 'Extra', 'Informacion adicional opcional.', 6, true)
on conflict (code) do update
set name = excluded.name,
    description = excluded.description,
    sort_order = excluded.sort_order,
    is_active = true;

create table if not exists public.skus_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  sort_order integer not null check (sort_order >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
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

create table if not exists public.skus_words (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  normalized_label text not null,
  reference_code text not null,
  default_field_type_id uuid null references public.skus_field_types(id),
  category_level_id uuid null references public.skus_category_levels(id) on delete restrict,
  description text,
  designation text,
  designation_pt text,
  designation_es text,
  designation_en text,
  include_in_designation boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint skus_words_reference_code_format check (reference_code ~ '^[A-Z0-9&.]{1,3}$'),
  constraint skus_words_normalized_unique unique (normalized_label, default_field_type_id)
);

create table if not exists public.skus_sku_sequences (
  id uuid primary key default gen_random_uuid(),
  prefix_key text not null unique,
  last_value bigint not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.skus_sku_generations (
  id uuid primary key default gen_random_uuid(),
  generated_code text not null unique,
  designation text not null,
  designation_pt text not null,
  designation_es text not null,
  designation_en text not null,
  product_image_path text,
  product_image_url text,
  sequence_value bigint not null default 1,
  prefix_snapshot text not null,
  selection_snapshot jsonb not null default '{}'::jsonb,
  snapshot_version integer not null default 1,
  selection_fingerprint text null
    check (
      selection_fingerprint is null
      or selection_fingerprint ~ '^[0-9a-f]{64}$'
    ),
  category_id uuid null references public.skus_categories(id) on delete restrict,
  units_per_box numeric(12,3),
  units_per_box_status text check (units_per_box_status in ('real', 'estimated')),
  multiples numeric(12,3),
  multiples_status text check (multiples_status in ('real', 'estimated')),
  weight numeric(12,3),
  weight_status text check (weight_status in ('real', 'estimated')),
  generated_by uuid references public.skus_profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.skus_normalization_import_batches (
  id uuid primary key default gen_random_uuid(),
  file_name text not null,
  file_sha256 text not null unique check (file_sha256 ~ '^[0-9a-f]{64}$'),
  status text not null check (status in ('processing', 'completed', 'failed')),
  total_rows integer not null default 0 check (total_rows >= 0),
  pending_rows integer not null default 0 check (pending_rows >= 0),
  completed_rows integer not null default 0 check (completed_rows >= 0),
  invalid_rows integer not null default 0 check (invalid_rows >= 0),
  imported_by uuid not null references public.skus_profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  completed_at timestamptz null,
  error_message text null
);

create table if not exists public.skus_code_normalizations (
  id uuid primary key default gen_random_uuid(),
  import_batch_id uuid not null references public.skus_normalization_import_batches(id) on delete restrict,
  source_row_number integer not null check (source_row_number > 0),
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

create table if not exists public.skus_sku_generation_measurement_history (
  id uuid primary key default gen_random_uuid(),
  sku_generation_id uuid not null references public.skus_sku_generations(id) on delete cascade,
  field_name text not null,
  previous_value_numeric numeric(12,3),
  previous_value_status text,
  new_value_numeric numeric(12,3),
  new_value_status text,
  changed_by uuid references public.skus_profiles(id) on delete set null,
  changed_at timestamptz not null default now(),
  request_id uuid null
);

create table if not exists public.skus_admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.skus_profiles(id) on delete set null,
  action text not null,
  target_type text not null,
  target_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists skus_words_field_type_idx on public.skus_words(default_field_type_id);
create index if not exists skus_words_reference_code_idx on public.skus_words(reference_code);
create index if not exists skus_words_category_level_idx on public.skus_words(category_level_id);
create unique index if not exists skus_words_normalized_category_level_uidx
  on public.skus_words (normalized_label, category_level_id)
  where category_level_id is not null;
create index if not exists skus_category_levels_category_sort_idx
  on public.skus_category_levels (category_id, sort_order);
create index if not exists skus_sku_generations_created_at_idx on public.skus_sku_generations(created_at desc);
create index if not exists skus_sku_generations_category_idx on public.skus_sku_generations(category_id);
create unique index if not exists skus_sku_generations_selection_fingerprint_uidx
  on public.skus_sku_generations (selection_fingerprint)
  where selection_fingerprint is not null;
create unique index if not exists skus_sku_gen_meas_hist_request_field_uidx
  on public.skus_sku_generation_measurement_history (request_id, field_name)
  where request_id is not null;
create index if not exists skus_code_normalizations_status_idx on public.skus_code_normalizations(normalization_status);
create index if not exists skus_code_normalizations_legacy_code_idx on public.skus_code_normalizations(legacy_code);
create unique index if not exists skus_code_normalizations_batch_row_uidx
  on public.skus_code_normalizations (import_batch_id, source_row_number)
  where import_batch_id is not null and source_row_number is not null;

-- Seed Cosmética levels (otras categorías sin niveles)
with cosmetica as (
  select id from public.skus_categories where slug = 'cosmetica' limit 1
),
ft as (
  select code, id from public.skus_field_types
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
left join ft on ft.code = v.key
on conflict (category_id, key) do update
set label = excluded.label,
    sort_order = excluded.sort_order,
    is_enabled = true,
    is_required = excluded.is_required,
    participates_in_code = excluded.participates_in_code,
    legacy_field_type_id = excluded.legacy_field_type_id,
    updated_at = now();

alter table public.skus_field_types enable row level security;
alter table public.skus_words enable row level security;
alter table public.skus_sku_sequences enable row level security;
alter table public.skus_sku_generations enable row level security;
alter table public.skus_sku_generation_measurement_history enable row level security;
alter table public.skus_admin_audit_logs enable row level security;
alter table public.skus_categories enable row level security;
alter table public.skus_category_levels enable row level security;
alter table public.skus_normalization_import_batches enable row level security;
alter table public.skus_code_normalizations enable row level security;

drop policy if exists "skus_field_types_select_authenticated" on public.skus_field_types;
create policy "skus_field_types_select_authenticated"
on public.skus_field_types
for select
to authenticated
using (true);

drop policy if exists "skus_words_select_authenticated" on public.skus_words;
create policy "skus_words_select_authenticated"
on public.skus_words
for select
to authenticated
using (true);

drop policy if exists "skus_sku_generations_select_authenticated" on public.skus_sku_generations;
create policy "skus_sku_generations_select_authenticated"
on public.skus_sku_generations
for select
to authenticated
using (true);

drop policy if exists "skus_sku_generation_measurement_history_select_authenticated" on public.skus_sku_generation_measurement_history;
create policy "skus_sku_generation_measurement_history_select_authenticated"
on public.skus_sku_generation_measurement_history
for select
to authenticated
using (true);

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
