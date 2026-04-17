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

create table if not exists public.skus_words (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  normalized_label text not null,
  reference_code char(3) not null,
  default_field_type_id uuid not null references public.skus_field_types(id),
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint words_reference_code_format check (reference_code ~ '^[A-Z0-9]{3}$'),
  constraint words_normalized_unique unique (normalized_label, default_field_type_id)
);

create table if not exists public.skus_word_contexts (
  id uuid primary key default gen_random_uuid(),
  word_id uuid not null references public.skus_words(id) on delete cascade,
  context_type text not null,
  context_value text,
  created_at timestamptz not null default now()
);

alter table public.skus_words
  add column if not exists designation text;

alter table public.skus_words
  add column if not exists designation_pt text;

alter table public.skus_words
  add column if not exists designation_es text;

alter table public.skus_words
  add column if not exists designation_en text;

alter table public.skus_words
  add column if not exists include_in_designation boolean not null default true;

update public.skus_words
set designation = coalesce(designation, label)
where designation is null;

update public.skus_words
set designation_pt = coalesce(designation_pt, designation, label)
where designation_pt is null;

update public.skus_words
set designation_es = coalesce(designation_es, designation_pt, designation, label)
where designation_es is null;

update public.skus_words
set designation_en = coalesce(designation_en, designation_pt, designation, label)
where designation_en is null;

create table if not exists public.skus_families (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  name_pt text,
  name_es text,
  name_en text,
  slug text not null unique,
  description text,
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  active_tree_version_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.skus_families
  add column if not exists name_pt text;

alter table public.skus_families
  add column if not exists name_es text;

alter table public.skus_families
  add column if not exists name_en text;

update public.skus_families
set name_pt = coalesce(name_pt, name)
where name_pt is null;

update public.skus_families
set name_es = coalesce(name_es, name_pt, name)
where name_es is null;

update public.skus_families
set name_en = coalesce(name_en, name_pt, name)
where name_en is null;

create table if not exists public.skus_word_families (
  word_id uuid not null references public.skus_words(id) on delete cascade,
  family_id uuid not null references public.skus_families(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (word_id, family_id)
);

create table if not exists public.skus_word_dependencies (
  child_word_id uuid not null references public.skus_words(id) on delete cascade,
  parent_word_id uuid not null references public.skus_words(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (child_word_id, parent_word_id),
  constraint skus_word_dependencies_no_self check (child_word_id <> parent_word_id)
);

create table if not exists public.skus_family_tree_versions (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.skus_families(id) on delete cascade,
  version_number integer not null,
  status text not null default 'draft' check (status in ('draft', 'published', 'superseded')),
  created_by uuid references public.skus_profiles(id),
  created_at timestamptz not null default now(),
  published_at timestamptz,
  unique (family_id, version_number)
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'skus_families_active_tree_version_fk'
  ) then
    alter table public.skus_families
      add constraint skus_families_active_tree_version_fk
      foreign key (active_tree_version_id) references public.skus_family_tree_versions(id);
  end if;
end $$;

create table if not exists public.skus_family_tree_levels (
  id uuid primary key default gen_random_uuid(),
  tree_version_id uuid not null references public.skus_family_tree_versions(id) on delete cascade,
  field_type_id uuid not null references public.skus_field_types(id),
  level_order integer not null,
  label_override text,
  is_required boolean not null default true,
  designation_included boolean not null default true,
  created_at timestamptz not null default now(),
  unique (tree_version_id, level_order)
);

create table if not exists public.skus_family_tree_level_words (
  id uuid primary key default gen_random_uuid(),
  tree_level_id uuid not null references public.skus_family_tree_levels(id) on delete cascade,
  word_id uuid not null references public.skus_words(id) on delete cascade,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (tree_level_id, word_id)
);

create table if not exists public.skus_family_tree_edges (
  id uuid primary key default gen_random_uuid(),
  tree_version_id uuid not null references public.skus_family_tree_versions(id) on delete cascade,
  from_level_id uuid not null references public.skus_family_tree_levels(id) on delete cascade,
  from_word_id uuid not null references public.skus_words(id) on delete cascade,
  to_level_id uuid not null references public.skus_family_tree_levels(id) on delete cascade,
  to_word_id uuid not null references public.skus_words(id) on delete cascade,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (tree_version_id, from_level_id, from_word_id, to_level_id, to_word_id)
);

create table if not exists public.skus_sku_sequences (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.skus_families(id) on delete cascade,
  prefix_key text not null,
  last_value bigint not null default 0,
  updated_at timestamptz not null default now(),
  unique (family_id, prefix_key)
);

create table if not exists public.skus_sku_generations (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.skus_families(id),
  tree_version_id uuid not null references public.skus_family_tree_versions(id),
  generated_code text not null unique,
  designation text not null,
  sequence_value bigint not null,
  prefix_snapshot text not null,
  selection_snapshot jsonb not null default '{}'::jsonb,
  units_per_box numeric(12,3),
  units_per_box_status text check (units_per_box_status in ('real', 'estimated')),
  multiples numeric(12,3),
  multiples_status text check (multiples_status in ('real', 'estimated')),
  weight numeric(12,3),
  weight_status text check (weight_status in ('real', 'estimated')),
  generated_by uuid references public.skus_profiles(id),
  created_at timestamptz not null default now()
);

alter table public.skus_sku_generations
  add column if not exists units_per_box numeric(12,3);

alter table public.skus_sku_generations
  add column if not exists units_per_box_status text;

alter table public.skus_sku_generations
  add column if not exists multiples numeric(12,3);

alter table public.skus_sku_generations
  add column if not exists multiples_status text;

alter table public.skus_sku_generations
  add column if not exists weight numeric(12,3);

alter table public.skus_sku_generations
  add column if not exists weight_status text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'skus_sku_generations_units_per_box_status_check'
  ) then
    alter table public.skus_sku_generations
      add constraint skus_sku_generations_units_per_box_status_check
      check (units_per_box_status in ('real', 'estimated'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'skus_sku_generations_multiples_status_check'
  ) then
    alter table public.skus_sku_generations
      add constraint skus_sku_generations_multiples_status_check
      check (multiples_status in ('real', 'estimated'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'skus_sku_generations_weight_status_check'
  ) then
    alter table public.skus_sku_generations
      add constraint skus_sku_generations_weight_status_check
      check (weight_status in ('real', 'estimated'));
  end if;
end $$;

create table if not exists public.skus_sku_generation_measurement_history (
  id uuid primary key default gen_random_uuid(),
  sku_generation_id uuid not null references public.skus_sku_generations(id) on delete cascade,
  field_name text not null check (field_name in ('units_per_box', 'multiples', 'weight')),
  old_value_numeric numeric(12,3),
  old_value_status text check (old_value_status in ('real', 'estimated')),
  new_value_numeric numeric(12,3),
  new_value_status text not null check (new_value_status in ('real', 'estimated')),
  changed_by uuid references public.skus_profiles(id),
  changed_at timestamptz not null default now()
);

create table if not exists public.skus_admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.skus_profiles(id),
  entity_type text not null,
  entity_id uuid,
  action text not null,
  payload jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.skus_refnorm_catalog_entries (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('brand', 'format', 'product', 'size', 'packaging', 'extra')),
  canonical_value text not null,
  code text not null,
  usable boolean not null default true,
  enabled boolean not null default true,
  labels_json jsonb not null default '{"pt":"","es":"","en":""}'::jsonb,
  detection_aliases_json jsonb not null default '[]'::jsonb,
  notes text,
  metadata_json jsonb not null default '{}'::jsonb,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.skus_refnorm_rules (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  enabled boolean not null default true,
  priority integer not null default 100,
  stage text not null check (stage in ('preprocess', 'detect', 'reference', 'designation', 'validation')),
  match_type text not null check (match_type in ('exact', 'contains', 'startsWith', 'endsWith', 'regex')),
  match_logic text not null default 'and' check (match_logic in ('and', 'or')),
  conditions_json jsonb not null default '[]'::jsonb,
  actions_json jsonb not null default '[]'::jsonb,
  notes text,
  source text not null default 'user' check (source in ('system', 'user')),
  created_by uuid references public.skus_profiles(id),
  updated_by uuid references public.skus_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.skus_refnorm_settings (
  id uuid primary key default gen_random_uuid(),
  char_limit_pt integer not null default 60,
  char_limit_es integer not null default 60,
  char_limit_en integer not null default 60,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.skus_refnorm_rule_audit (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  payload jsonb not null default '{}'::jsonb,
  actor_id uuid references public.skus_profiles(id),
  created_at timestamptz not null default now()
);

alter table public.skus_roles enable row level security;
alter table public.skus_permissions enable row level security;
alter table public.skus_role_permissions enable row level security;
alter table public.skus_profiles enable row level security;
alter table public.skus_field_types enable row level security;
alter table public.skus_words enable row level security;
alter table public.skus_word_contexts enable row level security;
alter table public.skus_word_families enable row level security;
alter table public.skus_word_dependencies enable row level security;
alter table public.skus_families enable row level security;
alter table public.skus_family_tree_versions enable row level security;
alter table public.skus_family_tree_levels enable row level security;
alter table public.skus_family_tree_level_words enable row level security;
alter table public.skus_family_tree_edges enable row level security;
alter table public.skus_sku_sequences enable row level security;
alter table public.skus_sku_generations enable row level security;
alter table public.skus_sku_generation_measurement_history enable row level security;
alter table public.skus_admin_audit_logs enable row level security;
alter table public.skus_refnorm_catalog_entries enable row level security;
alter table public.skus_refnorm_rules enable row level security;
alter table public.skus_refnorm_settings enable row level security;
alter table public.skus_refnorm_rule_audit enable row level security;

drop policy if exists "skus_profiles_select_own" on public.skus_profiles;
create policy "skus_profiles_select_own"
on public.skus_profiles
for select
to authenticated
using (auth.uid() = id);

drop policy if exists "skus_profiles_insert_own" on public.skus_profiles;
create policy "skus_profiles_insert_own"
on public.skus_profiles
for insert
to authenticated
with check (auth.uid() = id);

drop policy if exists "skus_profiles_update_own" on public.skus_profiles;
create policy "skus_profiles_update_own"
on public.skus_profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "skus_roles_select_authenticated" on public.skus_roles;
create policy "skus_roles_select_authenticated"
on public.skus_roles
for select
to authenticated
using (true);

drop policy if exists "skus_permissions_select_authenticated" on public.skus_permissions;
create policy "skus_permissions_select_authenticated"
on public.skus_permissions
for select
to authenticated
using (true);

drop policy if exists "skus_role_permissions_select_authenticated" on public.skus_role_permissions;
create policy "skus_role_permissions_select_authenticated"
on public.skus_role_permissions
for select
to authenticated
using (true);

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

drop policy if exists "skus_word_contexts_select_authenticated" on public.skus_word_contexts;
create policy "skus_word_contexts_select_authenticated"
on public.skus_word_contexts
for select
to authenticated
using (true);

drop policy if exists "skus_word_families_select_authenticated" on public.skus_word_families;
create policy "skus_word_families_select_authenticated"
on public.skus_word_families
for select
to authenticated
using (true);

drop policy if exists "skus_word_dependencies_select_authenticated" on public.skus_word_dependencies;
create policy "skus_word_dependencies_select_authenticated"
on public.skus_word_dependencies
for select
to authenticated
using (true);

drop policy if exists "skus_families_select_authenticated" on public.skus_families;
create policy "skus_families_select_authenticated"
on public.skus_families
for select
to authenticated
using (true);

drop policy if exists "skus_family_tree_versions_select_authenticated" on public.skus_family_tree_versions;
create policy "skus_family_tree_versions_select_authenticated"
on public.skus_family_tree_versions
for select
to authenticated
using (true);

drop policy if exists "skus_family_tree_levels_select_authenticated" on public.skus_family_tree_levels;
create policy "skus_family_tree_levels_select_authenticated"
on public.skus_family_tree_levels
for select
to authenticated
using (true);

drop policy if exists "skus_family_tree_level_words_select_authenticated" on public.skus_family_tree_level_words;
create policy "skus_family_tree_level_words_select_authenticated"
on public.skus_family_tree_level_words
for select
to authenticated
using (true);

drop policy if exists "skus_family_tree_edges_select_authenticated" on public.skus_family_tree_edges;
create policy "skus_family_tree_edges_select_authenticated"
on public.skus_family_tree_edges
for select
to authenticated
using (true);

drop policy if exists "skus_sku_sequences_select_authenticated" on public.skus_sku_sequences;
create policy "skus_sku_sequences_select_authenticated"
on public.skus_sku_sequences
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

drop policy if exists "skus_admin_audit_logs_select_authenticated" on public.skus_admin_audit_logs;
create policy "skus_admin_audit_logs_select_authenticated"
on public.skus_admin_audit_logs
for select
to authenticated
using (true);

drop policy if exists "skus_refnorm_catalog_entries_select_authenticated" on public.skus_refnorm_catalog_entries;
create policy "skus_refnorm_catalog_entries_select_authenticated"
on public.skus_refnorm_catalog_entries
for select
to authenticated
using (true);

drop policy if exists "skus_refnorm_rules_select_authenticated" on public.skus_refnorm_rules;
create policy "skus_refnorm_rules_select_authenticated"
on public.skus_refnorm_rules
for select
to authenticated
using (true);

drop policy if exists "skus_refnorm_settings_select_authenticated" on public.skus_refnorm_settings;
create policy "skus_refnorm_settings_select_authenticated"
on public.skus_refnorm_settings
for select
to authenticated
using (true);

drop policy if exists "skus_refnorm_rule_audit_select_authenticated" on public.skus_refnorm_rule_audit;
create policy "skus_refnorm_rule_audit_select_authenticated"
on public.skus_refnorm_rule_audit
for select
to authenticated
using (true);

insert into public.skus_roles (code, name, description)
values
  ('admin', 'Administrador', 'Acesso total'),
  ('manager', 'Gestor', 'Gere famílias, vocabulário e geração'),
  ('editor', 'Editor', 'Gera SKUs e consulta catálogos'),
  ('viewer', 'Leitor', 'Consulta dados publicados')
on conflict (code) do nothing;

insert into public.skus_permissions (code, name, description)
values
  ('user.manage', 'Gerir utilizadores', 'Criar e editar utilizadores'),
  ('word.manage', 'Gerir vocabulário', 'Criar e editar palavras'),
  ('family.manage', 'Gerir famílias', 'Editar famílias e árvores'),
  ('tree.publish', 'Publicar árvores', 'Promover versões draft para publicadas'),
  ('sku.generate', 'Gerar SKU', 'Executar gerações de código'),
  ('audit.read', 'Ver auditoria', 'Consultar histórico administrativo')
on conflict (code) do nothing;
