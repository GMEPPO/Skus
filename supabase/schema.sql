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

create table if not exists public.skus_words (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  normalized_label text not null,
  reference_code text not null,
  default_field_type_id uuid not null references public.skus_field_types(id),
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
  units_per_box numeric(12,3),
  units_per_box_status text check (units_per_box_status in ('real', 'estimated')),
  multiples numeric(12,3),
  multiples_status text check (multiples_status in ('real', 'estimated')),
  weight numeric(12,3),
  weight_status text check (weight_status in ('real', 'estimated')),
  generated_by uuid references public.skus_profiles(id) on delete set null,
  created_at timestamptz not null default now()
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
  changed_at timestamptz not null default now()
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
create index if not exists skus_sku_generations_created_at_idx on public.skus_sku_generations(created_at desc);

alter table public.skus_field_types enable row level security;
alter table public.skus_words enable row level security;
alter table public.skus_sku_sequences enable row level security;
alter table public.skus_sku_generations enable row level security;
alter table public.skus_sku_generation_measurement_history enable row level security;
alter table public.skus_admin_audit_logs enable row level security;

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
