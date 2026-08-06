-- ============================================================================
-- FASE 2B.2 R5 — BLOQUE 3
-- CONSTRAINTS, ÍNDICES Y TIPOS FÍSICOS
-- READ ONLY — NO CREA, ALTERA NI ELIMINA OBJETOS
-- ============================================================================

with
generation_table as (
  select c.oid
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n
    on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'skus_sku_generations'
    and c.relkind in ('r', 'p')
),
generation_columns as (
  select
    a.attname as column_name,
    a.attnum,
    a.atttypid,
    pg_catalog.format_type(a.atttypid, a.atttypmod) as physical_type,
    a.attnotnull as is_not_null
  from generation_table t
  join pg_catalog.pg_attribute a
    on a.attrelid = t.oid
  where a.attnum > 0
    and not a.attisdropped
),
generation_indexes as (
  select
    ic.relname as index_name,
    i.indisunique,
    i.indisvalid,
    i.indisready,
    i.indnkeyatts,
    i.indnatts,
    i.indkey,
    i.indpred,
    pg_catalog.pg_get_expr(i.indpred, i.indrelid) as predicate,
    pg_catalog.pg_get_indexdef(i.indexrelid) as index_definition
  from generation_table t
  join pg_catalog.pg_index i
    on i.indrelid = t.oid
  join pg_catalog.pg_class ic
    on ic.oid = i.indexrelid
),
generated_code_attribute as (
  select *
  from generation_columns
  where column_name = 'generated_code'
),
fingerprint_attribute as (
  select *
  from generation_columns
  where column_name = 'selection_fingerprint'
),
generated_code_unique_indexes as (
  select i.*
  from generation_indexes i
  cross join generated_code_attribute a
  where i.indisunique
    and i.indisvalid
    and i.indisready
    and i.indnkeyatts = 1
    and i.indkey[0] = a.attnum
    and i.indpred is null
),
fingerprint_unique_indexes as (
  select i.*
  from generation_indexes i
  cross join fingerprint_attribute a
  where i.indisunique
    and i.indisvalid
    and i.indisready
    and i.indnkeyatts = 1
    and i.indkey[0] = a.attnum
    and i.indpred is not null
    -- Use precomputed predicate: generation_indexes does not expose indrelid.
    and i.predicate
          ~* 'selection_fingerprint[[:space:]]+IS[[:space:]]+NOT[[:space:]]+NULL'
),
expected_generation_columns as (
  select *
  from (
    values
      ('generated_code',       'text',    true),
      ('selection_fingerprint','text',    false),
      -- Supervisor: designation* are text NOT NULL (R5 always writes coalesce(..., '')).
      ('designation',          'text',    true),
      ('designation_pt',       'text',    true),
      ('designation_es',       'text',    true),
      ('designation_en',       'text',    true),
      ('sequence_value',       null,      true),
      ('units_per_box',        'numeric', false),
      ('units_per_box_status', 'text',    false),
      ('multiples',            'numeric', false),
      ('multiples_status',     'text',    false),
      ('weight',               'numeric', false),
      ('weight_status',        'text',    false)
  ) as x(column_name, expected_base_type, expected_not_null)
),
generation_column_checks as (
  select
    e.column_name,
    e.expected_base_type,
    e.expected_not_null,
    c.physical_type,
    c.is_not_null,
    c.column_name is not null as column_exists,
    case
      when c.column_name is null then false
      when e.expected_base_type = 'text'
        and c.atttypid <> 'pg_catalog.text'::pg_catalog.regtype then false
      when e.expected_base_type = 'numeric'
        and c.atttypid <> 'pg_catalog.numeric'::pg_catalog.regtype then false
      when c.is_not_null is distinct from e.expected_not_null then false
      else true
    end as passed
  from expected_generation_columns e
  left join generation_columns c
    on c.column_name = e.column_name
),
history_table as (
  select c.oid
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n
    on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'skus_sku_generation_measurement_history'
    and c.relkind in ('r', 'p')
),
history_columns as (
  select
    a.attname as column_name,
    a.atttypid,
    pg_catalog.format_type(a.atttypid, a.atttypmod) as physical_type,
    a.attnotnull as is_not_null
  from history_table t
  join pg_catalog.pg_attribute a
    on a.attrelid = t.oid
  where a.attnum > 0
    and not a.attisdropped
),
expected_history_columns as (
  select *
  from (
    values
      ('sku_generation_id', 'uuid'),
      ('field_name',        'text'),
      ('new_value_numeric', 'numeric'),
      ('new_value_status',  'text'),
      ('changed_by',        'uuid')
  ) as x(column_name, expected_base_type)
),
history_column_checks as (
  select
    e.column_name,
    e.expected_base_type,
    c.physical_type,
    c.is_not_null,
    c.column_name is not null as column_exists,
    case
      when c.column_name is null then false
      when e.expected_base_type = 'text'
        then c.atttypid = 'pg_catalog.text'::pg_catalog.regtype
      when e.expected_base_type = 'numeric'
        then c.atttypid = 'pg_catalog.numeric'::pg_catalog.regtype
      when e.expected_base_type = 'uuid'
        then c.atttypid = 'pg_catalog.uuid'::pg_catalog.regtype
      else false
    end as passed
  from expected_history_columns e
  left join history_columns c
    on c.column_name = e.column_name
),
fingerprint_index_detail as (
  select pg_catalog.string_agg(
    pg_catalog.format(
      '%s :: %s',
      index_name,
      index_definition
    ),
    ' | '
    order by index_name
  ) as detail
  from fingerprint_unique_indexes
),
generated_code_index_detail as (
  select pg_catalog.string_agg(
    pg_catalog.format(
      '%s :: %s',
      index_name,
      index_definition
    ),
    ' | '
    order by index_name
  ) as detail
  from generated_code_unique_indexes
)

select
  10 as ord,
  'table_skus_sku_generations_exists' as check_id,
  exists (select 1 from generation_table) as passed,
  case
    when exists (select 1 from generation_table)
      then 'public.skus_sku_generations exists'
    else 'public.skus_sku_generations missing'
  end as detail

union all

select
  20,
  'generated_code_unique_effective',
  exists (select 1 from generated_code_unique_indexes),
  coalesce(
    (select detail from generated_code_index_detail),
    'No valid non-partial single-column unique index found'
  )

union all

select
  30,
  'selection_fingerprint_unique_partial_effective',
  exists (select 1 from fingerprint_unique_indexes),
  coalesce(
    (select detail from fingerprint_index_detail),
    'No valid partial unique index with selection_fingerprint IS NOT NULL found'
  )

union all

select
  40,
  'fingerprint_hex_constraint_absent_before_r5',
  not exists (
    select 1
    from pg_catalog.pg_constraint con
    join generation_table t
      on t.oid = con.conrelid
    where con.conname = 'skus_sku_generations_fingerprint_hex_chk'
  ),
  case
    when exists (
      select 1
      from pg_catalog.pg_constraint con
      join generation_table t
        on t.oid = con.conrelid
      where con.conname = 'skus_sku_generations_fingerprint_hex_chk'
    )
      then 'Constraint unexpectedly already exists'
    else 'Constraint absent as expected before R5 APPLY'
  end

union all

select
  100 + pg_catalog.row_number() over (order by column_name),
  'generation_column_' || column_name,
  passed,
  pg_catalog.format(
    'exists=%s; actual_type=%s; actual_not_null=%s; expected_type=%s; expected_not_null=%s',
    column_exists,
    coalesce(physical_type, '<missing>'),
    coalesce(is_not_null::text, '<missing>'),
    coalesce(expected_base_type, '<contract does not require exact type>'),
    expected_not_null
  )
from generation_column_checks

union all

select
  200,
  'table_measurement_history_exists',
  exists (select 1 from history_table),
  case
    when exists (select 1 from history_table)
      then 'public.skus_sku_generation_measurement_history exists'
    else 'measurement history table missing'
  end

union all

select
  210 + pg_catalog.row_number() over (order by column_name),
  'history_column_' || column_name,
  passed,
  pg_catalog.format(
    'exists=%s; actual_type=%s; actual_not_null=%s; expected_type=%s',
    column_exists,
    coalesce(physical_type, '<missing>'),
    coalesce(is_not_null::text, '<missing>'),
    expected_base_type
  )
from history_column_checks

union all

select
  300,
  'request_id_absent_before_r5',
  not exists (
    select 1
    from history_columns
    where column_name = 'request_id'
  ),
  case
    when exists (
      select 1
      from history_columns
      where column_name = 'request_id'
    )
      then 'request_id unexpectedly exists before R5 APPLY'
    else 'request_id absent as expected before R5 APPLY'
  end

order by ord;
