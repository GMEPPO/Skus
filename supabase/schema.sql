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

create table if not exists public.skus_families (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  description text,
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  active_tree_version_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
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

alter table public.skus_families
  add constraint skus_families_active_tree_version_fk
  foreign key (active_tree_version_id) references public.skus_family_tree_versions(id);

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
  generated_by uuid references public.skus_profiles(id),
  created_at timestamptz not null default now()
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

alter table public.skus_roles enable row level security;
alter table public.skus_permissions enable row level security;
alter table public.skus_role_permissions enable row level security;
alter table public.skus_profiles enable row level security;
alter table public.skus_field_types enable row level security;
alter table public.skus_words enable row level security;
alter table public.skus_word_contexts enable row level security;
alter table public.skus_families enable row level security;
alter table public.skus_family_tree_versions enable row level security;
alter table public.skus_family_tree_levels enable row level security;
alter table public.skus_family_tree_level_words enable row level security;
alter table public.skus_family_tree_edges enable row level security;
alter table public.skus_sku_sequences enable row level security;
alter table public.skus_sku_generations enable row level security;
alter table public.skus_admin_audit_logs enable row level security;

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
