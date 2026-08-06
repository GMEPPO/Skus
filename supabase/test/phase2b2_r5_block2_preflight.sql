-- ============================================================================
-- FASE 2B.2 R5 — BLOQUE 2: PREFLIGHT INFRAESTRUCTURA Y PROPIETARIOS
-- READ ONLY. NO CREA, ALTERA NI ELIMINA OBJETOS.
-- Run on GGMPI (pmovliksftlcjvjxvqhm). Expect: all passed = true.
-- ============================================================================

with
current_role_info as (
  select
    current_user as execution_role,
    session_user as session_role,
    coalesce(r.rolsuper, false) as is_superuser,
    current_user not in ('anon', 'authenticated') as execution_role_is_trusted
  from pg_catalog.pg_roles r
  where r.rolname = current_user
),
extension_info as (
  select
    e.oid as extension_oid,
    e.extname,
    n.nspname as extension_schema,
    pg_catalog.pg_get_userbyid(e.extowner) as extension_owner
  from pg_catalog.pg_extension e
  join pg_catalog.pg_namespace n
    on n.oid = e.extnamespace
  where e.extname = 'pgcrypto'
),
digest_info as (
  select
    p.oid as function_oid,
    n.nspname as function_schema,
    p.proname as function_name,
    pg_catalog.pg_get_function_identity_arguments(p.oid) as identity_arguments,
    pg_catalog.pg_get_userbyid(p.proowner) as function_owner
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n
    on n.oid = p.pronamespace
  where n.nspname = 'extensions'
    and p.proname = 'digest'
    and pg_catalog.pg_get_function_identity_arguments(p.oid) = 'bytea, text'
),
target_relations as (
  select *
  from (
    values
      ('skus_categories'),
      ('skus_category_levels'),
      ('skus_words'),
      ('skus_sku_generations'),
      ('skus_sku_generation_measurement_history'),
      ('skus_code_normalizations'),
      ('skus_normalization_import_batches')
  ) as t(relation_name)
),
relation_owners as (
  select
    t.relation_name,
    c.oid is not null as object_exists,
    pg_catalog.pg_get_userbyid(c.relowner) as object_owner,
    case
      when c.oid is null then false
      when pg_catalog.pg_get_userbyid(c.relowner) = current_user then true
      when pg_catalog.pg_has_role(
        current_user,
        pg_catalog.pg_get_userbyid(c.relowner),
        'MEMBER'
      ) then true
      else false
    end as execution_role_can_act_as_owner
  from target_relations t
  left join pg_catalog.pg_class c
    on c.relname = t.relation_name
  left join pg_catalog.pg_namespace n
    on n.oid = c.relnamespace
   and n.nspname = 'public'
),
prerequisite_functions as (
  select *
  from (
    values
      ('public.skus_current_role_code()'),
      ('public.skus_has_min_role(text)')
  ) as f(signature)
),
prerequisite_function_info as (
  select
    f.signature,
    p.oid is not null as function_exists,
    pg_catalog.pg_get_userbyid(p.proowner) as function_owner,
    case
      when p.oid is null then false
      when pg_catalog.pg_get_userbyid(p.proowner) = current_user then true
      when pg_catalog.pg_has_role(
        current_user,
        pg_catalog.pg_get_userbyid(p.proowner),
        'MEMBER'
      ) then true
      else false
    end as execution_role_can_act_as_owner
  from prerequisite_functions f
  left join pg_catalog.pg_proc p
    on p.oid = pg_catalog.to_regprocedure(f.signature)
)

select
  10 as ord,
  'execution_role' as check_id,
  i.execution_role_is_trusted as passed,
  format(
    'current_user=%s; session_user=%s; superuser=%s',
    i.execution_role,
    i.session_role,
    i.is_superuser
  ) as detail
from current_role_info i

union all

select
  20,
  'pgcrypto_installed',
  exists (select 1 from extension_info),
  coalesce(
    (
      select format(
        'schema=%s; owner=%s',
        extension_schema,
        extension_owner
      )
      from extension_info
    ),
    'pgcrypto not found'
  )

union all

select
  30,
  'pgcrypto_in_extensions_schema',
  exists (
    select 1
    from extension_info
    where extension_schema = 'extensions'
  ),
  coalesce(
    (
      select format('schema=%s', extension_schema)
      from extension_info
    ),
    'pgcrypto not found'
  )

union all

select
  40,
  'digest_bytea_text_exists',
  exists (select 1 from digest_info),
  coalesce(
    (
      select format(
        '%I.%I(%s); owner=%s',
        function_schema,
        function_name,
        identity_arguments,
        function_owner
      )
      from digest_info
    ),
    'extensions.digest(bytea,text) not found'
  )

union all

select
  50,
  'current_user_has_extensions_usage',
  pg_catalog.has_schema_privilege(
    current_user,
    'extensions',
    'USAGE'
  ),
  format(
    'role=%s; privilege=USAGE',
    current_user
  )

union all

select
  60,
  'current_user_has_digest_execute',
  case
    when pg_catalog.to_regprocedure(
      'extensions.digest(bytea,text)'
    ) is null then false
    else pg_catalog.has_function_privilege(
      current_user,
      'extensions.digest(bytea,text)',
      'EXECUTE'
    )
  end,
  format(
    'role=%s; function=extensions.digest(bytea,text)',
    current_user
  )

union all

select
  70,
  'current_user_can_create_schema',
  pg_catalog.has_database_privilege(
    current_user,
    current_database(),
    'CREATE'
  ),
  format(
    'database=%s; role=%s',
    current_database(),
    current_user
  )

union all

select
  80,
  'current_user_has_public_usage',
  pg_catalog.has_schema_privilege(
    current_user,
    'public',
    'USAGE'
  ),
  format('role=%s', current_user)

union all

select
  90,
  'current_user_has_public_create',
  pg_catalog.has_schema_privilege(
    current_user,
    'public',
    'CREATE'
  ),
  format('role=%s', current_user)

union all

select
  100 + row_number() over (order by relation_name),
  'relation_owner_' || relation_name,
  object_exists and execution_role_can_act_as_owner,
  format(
    'exists=%s; owner=%s; can_act_as_owner=%s',
    object_exists,
    coalesce(object_owner, '<missing>'),
    execution_role_can_act_as_owner
  )
from relation_owners

union all

select
  200 + row_number() over (order by signature),
  'prerequisite_' ||
    regexp_replace(signature, '[^a-zA-Z0-9]+', '_', 'g'),
  function_exists and execution_role_can_act_as_owner,
  format(
    'signature=%s; exists=%s; owner=%s; can_act_as_owner=%s',
    signature,
    function_exists,
    coalesce(function_owner, '<missing>'),
    execution_role_can_act_as_owner
  )
from prerequisite_function_info

order by ord;
