-- Reset/migracion para el modelo nuevo de biblioteca global de 6 niveles.
--
-- Ejecutar este script cuando se quiera empezar de cero con el generador SKU:
-- 1. Borra historico antiguo del generador.
-- 2. Elimina tablas obsoletas de familias, arboles y normalizador.
-- 3. Mantiene roles, permisos, perfiles y auditoria.
-- 4. Recrea secuencias e historico sin dependencias a familias/arboles.
-- 5. Importa Sabsol.xlsx como biblioteca global de palabras.
--
-- No borra ni modifica tablas que no empiecen por skus_.
--
-- Backup opcional antes de ejecutar:
-- create table public._backup_skus_families_20260521 as select * from public.skus_families;
-- create table public._backup_skus_words_20260521 as select * from public.skus_words;
-- create table public._backup_skus_sku_generations_20260521 as select * from public.skus_sku_generations;
-- create table public._backup_skus_family_tree_versions_20260521 as select * from public.skus_family_tree_versions;
-- create table public._backup_skus_family_tree_levels_20260521 as select * from public.skus_family_tree_levels;
-- create table public._backup_skus_family_tree_level_words_20260521 as select * from public.skus_family_tree_level_words;
-- create table public._backup_skus_family_tree_edges_20260521 as select * from public.skus_family_tree_edges;

begin;

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

drop table if exists public.skus_sku_generation_measurement_history cascade;
drop table if exists public.skus_sku_generations cascade;
drop table if exists public.skus_sku_sequences cascade;

drop table if exists public.skus_family_tree_edges cascade;
drop table if exists public.skus_family_tree_level_words cascade;
drop table if exists public.skus_family_tree_levels cascade;
drop table if exists public.skus_family_tree_versions cascade;
drop table if exists public.skus_word_dependencies cascade;
drop table if exists public.skus_word_families cascade;
drop table if exists public.skus_word_contexts cascade;
drop table if exists public.skus_families cascade;

drop table if exists public.skus_refnorm_rule_audit cascade;
drop table if exists public.skus_refnorm_rules cascade;
drop table if exists public.skus_refnorm_catalog_entries cascade;
drop table if exists public.skus_refnorm_settings cascade;

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

update public.skus_field_types
set is_active = false
where code not in ('brand', 'format', 'product', 'size', 'packaging', 'extra');

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

alter table public.skus_words
  alter column reference_code type text using trim(reference_code::text);

alter table public.skus_words
  drop constraint if exists words_reference_code_format;

alter table public.skus_words
  drop constraint if exists skus_words_reference_code_format;

alter table public.skus_words
  add constraint skus_words_reference_code_format
  check (reference_code ~ '^[A-Z0-9&.]{1,3}$');

alter table public.skus_words
  drop constraint if exists words_normalized_unique;

alter table public.skus_words
  drop constraint if exists skus_words_normalized_unique;

alter table public.skus_words
  add constraint skus_words_normalized_unique unique (normalized_label, default_field_type_id);

delete from public.skus_words;

insert into public.skus_words (
  label,
  normalized_label,
  reference_code,
  default_field_type_id,
  designation,
  designation_pt,
  designation_es,
  designation_en,
  include_in_designation,
  is_active
)
select
  seed.label,
  lower(trim(seed.label)),
  seed.code,
  field_types.id,
  seed.designation_pt,
  seed.designation_pt,
  seed.designation_es,
  seed.designation_en,
  seed.include_in_designation,
  true
from (
values
  ('brand', 'ACB', 'ACHB LAVANDA', 'ACHB LAVANDA', 'ACHB Lavanda', 'ACHB Lavender', true, 101),
  ('brand', 'ALE', 'BEN ALECRIM', 'BEN ALECRIM', 'BEN Alecrim', 'BEN Rosemary', true, 102),
  ('brand', 'ALG', 'ALG OCEAN SPA', 'ALG OCEAN SPA', 'ALG Ocean Spa', 'ALG Ocean Spa', true, 103),
  ('brand', 'ALQ', 'ALQVIMIA', 'ALQVIMIA', 'ALQVIMIA', 'ALQVIMIA', true, 104),
  ('brand', 'AMI', 'AMIMO', 'AMIMO', 'AMIMO', 'AMIMO', true, 105),
  ('brand', 'ASE', 'AN SEMONIN', 'AN SEMONIN', 'AN SEMONIN', 'AN SEMONIN', true, 106),
  ('brand', 'ATC', 'AT COLOG POMELO', 'AT COLOG POMELO', 'AT Colog Pomelo', 'AT Colog Grapefruit', true, 107),
  ('brand', 'AZZ', 'AZZARO', 'AZZARO', 'AZZARO', 'AZZARO', true, 108),
  ('brand', 'BIE', 'BIENVENUE', 'BIENVENUE', 'BIENVENUE', 'BIENVENUE', true, 109),
  ('brand', 'CAS', 'CAS Pink Lily', 'CAS Pink Lily', 'CAS Pink Lily', 'CAST Pink Lily', true, 110),
  ('brand', 'CIB', 'C IBIZA', 'C IBIZA', 'C IBIZA', 'C IBIZA', true, 111),
  ('brand', 'CLA', 'CLARINS EAU DIN', 'CLARINS EAU DIN', 'CLARINS EAU DIN', 'CLARINS EAU DIN', true, 112),
  ('brand', 'COD', 'CODAGE', 'CODAGE', 'CODAGE', 'CODAGE', true, 113),
  ('brand', 'CQM', 'C MONDES', 'C MONDES', 'C MONDES', 'C MONDES', true, 114),
  ('brand', 'DAM', 'DAM E&S', 'DAM E&S', 'DAM E&S', 'DAM E&S', true, 115),
  ('brand', 'DAV', 'DAVEIA', 'DAVEIA', 'DAVEIA', 'DAVEIA', true, 116),
  ('brand', 'DOR', 'DAM ORGANIC', 'DAM ORGANIC', 'DAM ORGANIC', 'DAM ORGANIC', true, 117),
  ('brand', 'FAA', 'FAACE', 'FAACE', 'FAACE', 'FAACE', true, 118),
  ('brand', 'FAL', 'CAS FLOR ALGOD', 'CAS FLOR ALGOD', 'CAS FLOR ALGOD', 'CAS FLOR ALGOD', true, 119),
  ('brand', 'FDP', 'RS FLOR POEMAS', 'RS FLOR POEMAS', 'RS FLOR POEMAS', 'RS FLOR POEMAS', true, 120),
  ('brand', 'FRM', 'EDPFM MAGNOLIA', 'EDPFM MAGNOLIA', 'EDPFM Magnolia', 'EDPFM Magnolia', true, 121),
  ('brand', 'G&B', 'PC GOLD BLUE', 'PC GOLD BLUE', 'PC Gold Blue', 'PC Gold Blue', true, 122),
  ('brand', 'GAE', 'RS ALGAE', 'RS ALGAE', 'RS Algae', 'RS Algae', true, 123),
  ('brand', 'GOR', 'BEN GORDISSIMO', 'BEN GORDISSIMO', 'BEN Gordissimo', 'BEN Gordissimo', true, 124),
  ('brand', 'GUE', 'GUERLAIN', 'GUERLAIN', 'GUERLAIN', 'GUERLAIN', true, 125),
  ('brand', 'KEI', 'KEIJI', 'KEIJI', 'KEIJI', 'KEIJI', true, 126),
  ('brand', 'LVE', 'CAS LARANJA VER', 'CAS LARANJA VER', 'CAS Naranja Verbena', 'CAS Orange Verbena', true, 127),
  ('brand', 'MMP', 'MEMO IRISH L', 'MEMO IRISH L', 'MEMO IRISH L', 'MEMO IRISH L', true, 128),
  ('brand', 'NKI', 'NKI', 'NKI', 'NKI', 'NKI', true, 129),
  ('brand', 'NUP', 'NUXE PRESTIGE', 'NUXE PRESTIGE', 'NUXE PRESTIGE', 'NUXE PRESTIGE', true, 130),
  ('brand', 'NUX', 'NUXE REVE MIEL', 'NUXE REVE MIEL', 'NUXE REVE MIEL', 'NUXE REVE MIEL', true, 131),
  ('brand', 'OMN', 'OMNISENS', 'OMNISENS', 'OMNISENS', 'OMNISENS', true, 132),
  ('brand', 'PHY', 'PHYTOMER', 'PHYTOMER', 'PHYTOMER', 'PHYTOMER', true, 133),
  ('brand', 'PMO', 'P MORABITO', 'P MORABITO', 'P MORABITO', 'P MORABITO', true, 134),
  ('brand', 'RUB', 'PC RUBY RED', 'PC RUBY RED', 'PC RUBY RED', 'PC RUBY RED', true, 135),
  ('brand', 'TRU', 'TRUSSARDI', 'TRUSSARDI', 'TRUSSARDI', 'TRUSSARDI', true, 136),
  ('brand', 'TYP', 'TYPOLOGY', 'TYPOLOGY', 'TYPOLOGY', 'TYPOLOGY', true, 137),
  ('brand', 'VIS', 'VINESIME', 'VINESIME', 'VINESIME', 'VINESIME', true, 138),
  ('brand', 'VRA', 'FRAGONARD VRAI', 'FRAGONARD VRAI', 'FRAGONARD VRAI', 'FRAGONARD VRAI', true, 139),
  ('format', 'SOL', 'Solido', 'Solido', 'Solido', 'Solid', false, 201),
  ('product', 'SAB', 'Sabonete', 'Sabonete', 'Jabon', 'Soap', true, 301),
  ('product', 'SAB', 'Sab Massagem', 'Sab Massagem', 'Jabon Masaje', 'Soap Massage', true, 302),
  ('product', 'SAB', 'Sabonete Esfoliante', 'Sabonete Esfoliante', 'Jabon Exfoliante', 'Soap exfoliating', true, 303),
  ('size', '020', '20g', '20g', '20g', '20g', true, 401),
  ('size', '020', '20g (Esfoliante)', '20g', '20g', '20g', true, 402),
  ('size', '025', '25g', '25g', '25g', '25g', true, 403),
  ('size', '030', '30g', '30g', '30g', '30g', true, 404),
  ('size', '040', '40g', '40g', '40g', '40g', true, 405),
  ('size', '040', '40gr', '40gr', '40g', '40g', true, 406),
  ('size', '050', '50g', '50g', '50g', '50g', true, 407),
  ('size', '100', '100g', '100g', '100g', '100g', true, 408),
  ('packaging', 'ALE', 'ALLEGRO', 'ALLEGRO', 'ALLEGRO', 'ALLEGRO', true, 501),
  ('packaging', 'CXA', 'Caixa Cartao', 'Caixa Cartao', 'Caja Carton', 'Card Box', true, 502),
  ('packaging', 'FLW', 'Flowpack', 'Flowpack', 'Flowpack', 'Flowpack', true, 503),
  ('packaging', 'PLI', 'PLISSADO', 'PLISSADO', 'PLISADO', 'PLEATED PAPER', true, 504),
  ('packaging', 'TPT', 'Transparente', 'Transparente', 'Transparente', 'Transparent', true, 505)
) as seed(level_code, code, label, designation_pt, designation_es, designation_en, include_in_designation, sort_order)
join public.skus_field_types field_types on field_types.code = seed.level_code
order by seed.sort_order;

create table public.skus_sku_sequences (
  id uuid primary key default gen_random_uuid(),
  prefix_key text not null unique,
  last_value bigint not null default 0,
  updated_at timestamptz not null default now()
);

create table public.skus_sku_generations (
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

create table public.skus_sku_generation_measurement_history (
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

commit;

select 'active_level_codes' as metric, string_agg(code, ',' order by sort_order) as value
from public.skus_field_types
where is_active
union all
select 'brand_words', count(*)::text
from public.skus_words words
join public.skus_field_types field_types on field_types.id = words.default_field_type_id
where field_types.code = 'brand'
union all
select 'total_words', count(*)::text
from public.skus_words
union all
select 'obsolete_tables_still_existing', count(*)::text
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'skus_families',
    'skus_word_families',
    'skus_word_dependencies',
    'skus_word_contexts',
    'skus_family_tree_versions',
    'skus_family_tree_levels',
    'skus_family_tree_level_words',
    'skus_family_tree_edges',
    'skus_refnorm_settings',
    'skus_refnorm_rules',
    'skus_refnorm_rule_audit',
    'skus_refnorm_catalog_entries'
  );
