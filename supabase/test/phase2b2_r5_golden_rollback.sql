-- ============================================================================
-- FASE 2B.2 — R5 (revisión supervisor)
-- DO NOT APPLY on GGMPI until explicit OK.
-- Scope: public.skus_* + schema skus_private only.
-- Does NOT create schema extensions nor install/move pgcrypto.
-- ============================================================================

begin;

-- Preflight only: require existing extensions.digest + privileges (infra out of scope).
do $chk$
declare
  v_ext_schema text;
  v_proc_ok boolean;
begin
  select n.nspname
  into v_ext_schema
  from pg_extension x
  join pg_namespace n on n.oid = x.extnamespace
  where x.extname = 'pgcrypto'
  limit 1;

  if v_ext_schema is distinct from 'extensions' then
    raise exception
      '2B.2 R5 abort: pgcrypto must already live in schema extensions (found=%). Do not install/move from this migration.',
      coalesce(v_ext_schema, '<missing>');
  end if;

  v_proc_ok := to_regprocedure('extensions.digest(bytea, text)') is not null;
  if not v_proc_ok then
    raise exception
      '2B.2 R5 abort: extensions.digest(bytea, text) missing. Infrastructure must provide pgcrypto in schema extensions before apply.';
  end if;

  if not has_schema_privilege(current_user, 'extensions', 'USAGE') then
    raise exception
      '2B.2 R5 abort: current_user (%) lacks USAGE on schema extensions.',
      current_user;
  end if;

  if not has_function_privilege('extensions.digest(bytea, text)', 'EXECUTE') then
    raise exception
      '2B.2 R5 abort: current_user (%) lacks EXECUTE on extensions.digest(bytea, text).',
      current_user;
  end if;
end;
$chk$;

create schema if not exists skus_private;
revoke all on schema skus_private from public;
revoke all on schema skus_private from anon;
revoke all on schema skus_private from authenticated;

-- Defensive fingerprint shape (históricos v1 siguen NULL)
alter table public.skus_sku_generations
  drop constraint if exists skus_sku_generations_fingerprint_hex_chk;

alter table public.skus_sku_generations
  add constraint skus_sku_generations_fingerprint_hex_chk
  check (
    selection_fingerprint is null
    or selection_fingerprint ~ '^[0-9a-f]{64}$'
  );

-- Idempotencia de mediciones por requestId (misma TX que generate)
alter table public.skus_sku_generation_measurement_history
  add column if not exists request_id uuid null;

create unique index if not exists skus_sku_gen_meas_hist_request_field_uidx
  on public.skus_sku_generation_measurement_history (request_id, field_name)
  where request_id is not null;

comment on column public.skus_sku_generations.sequence_value is
  'Legacy sentinel: new secure generations store 1 (no sequence suffix in code). Prefer NULL in a later migration.';
comment on column public.skus_sku_generations.prefix_snapshot is
  'Stores the structural generated_code (no separate sequence prefix in 2B.2).';
comment on column public.skus_sku_generations.designation is
  'Physical type: text (unlimited). No silent truncation in 2B.2 RPCs.';
comment on column public.skus_sku_generations.designation_pt is
  'Physical type: text (unlimited). No silent truncation in 2B.2 RPCs.';
comment on column public.skus_sku_generations.designation_es is
  'Physical type: text (unlimited). No silent truncation in 2B.2 RPCs.';
comment on column public.skus_sku_generations.designation_en is
  'Physical type: text (unlimited). No silent truncation in 2B.2 RPCs.';

-- ---------------------------------------------------------------------------
-- UUID / JSON helpers
-- ---------------------------------------------------------------------------
create or replace function skus_private.is_uuid(p text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p is not null and p ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
$$;

create or replace function skus_private.parse_uuid(p text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  if not skus_private.is_uuid(p) then
    raise exception 'invalid_payload';
  end if;
  return p::uuid;
end;
$$;

create or replace function skus_private.norm_text(p text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(regexp_replace(btrim(coalesce(p, '')), '\s+', ' ', 'g'), '');
$$;

create or replace function skus_private.pick_designation(
  p_locale text,
  p_designation text,
  p_label text
)
returns text
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    skus_private.norm_text(p_locale),
    skus_private.norm_text(p_designation),
    skus_private.norm_text(p_label),
    ''
  );
$$;

-- ---------------------------------------------------------------------------
-- Fingerprint: SHA-256 hex of explicit canonical text (NOT jsonb::text)
-- Contract keys order:
--   root: categoryId, codeFormatVersion, levels
--   level: codeSegment, levelId, selection
--   selection word: kind, wordId
--   selection empty: kind
-- ---------------------------------------------------------------------------
create or replace function skus_private.sha256_hex(p text)
returns text
language sql
immutable
set search_path = ''
as $$
  select pg_catalog.encode(
    extensions.digest(pg_catalog.convert_to(p, 'UTF8'), 'sha256'),
    'hex'
  );
$$;

create or replace function skus_private.json_str(p text)
returns text
language sql
immutable
set search_path = ''
as $$
  -- Quoted JSON string (portable contract; values are UUID / abbr / 000).
  select pg_catalog.to_json(p)::text;
$$;

create or replace function skus_private.compute_selection_fingerprint(p_snapshot jsonb)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_canonical text;
  v_levels_text text;
  v_elem jsonb;
  v_sort int;
  v_level_id text;
  v_participates boolean;
  v_kind text;
  v_code_segment text;
  v_code_raw jsonb;
  v_word_id text;
  v_level_json text;
  v_tmp jsonb := '[]'::jsonb;
  v_seen_ids text[] := array[]::text[];
  v_sort_text text;
begin
  if jsonb_typeof(p_snapshot) is distinct from 'object' then
    raise exception 'invalid_payload';
  end if;

  -- version must be JSON number 2 (no unsafe cast of arbitrary text)
  if jsonb_typeof(p_snapshot->'version') is distinct from 'number'
     or (p_snapshot->'version') is distinct from '2'::jsonb then
    raise exception 'invalid_snapshot_version';
  end if;

  if jsonb_typeof(p_snapshot->'codeFormatVersion') is distinct from 'number'
     or (p_snapshot->'codeFormatVersion') is distinct from '1'::jsonb then
    raise exception 'invalid_payload';
  end if;

  if not skus_private.is_uuid(p_snapshot#>>'{category,id}') then
    raise exception 'invalid_payload';
  end if;
  if jsonb_typeof(p_snapshot->'levels') is distinct from 'array' then
    raise exception 'invalid_payload';
  end if;

  for v_elem in
    select value from jsonb_array_elements(p_snapshot->'levels')
  loop
    if jsonb_typeof(v_elem) is distinct from 'object' then
      raise exception 'invalid_payload';
    end if;

    -- isEnabled must be JSON boolean true (disabled levels never in fingerprint snapshot)
    if jsonb_typeof(v_elem->'isEnabled') is distinct from 'boolean'
       or (v_elem->'isEnabled') is distinct from 'true'::jsonb then
      raise exception 'invalid_payload';
    end if;

    -- sortOrder: JSON number + integer only (reject string "1")
    if jsonb_typeof(v_elem->'sortOrder') is distinct from 'number' then
      raise exception 'invalid_payload';
    end if;
    v_sort_text := (v_elem->'sortOrder')::text;
    if v_sort_text !~ '^-?[0-9]+$' then
      raise exception 'invalid_payload';
    end if;
    begin
      v_sort := v_sort_text::int;
    exception when others then
      raise exception 'invalid_payload';
    end;

    v_level_id := lower(v_elem->>'levelId');
    if not skus_private.is_uuid(v_level_id) then
      raise exception 'invalid_payload';
    end if;
    if v_level_id = any (v_seen_ids) then
      raise exception 'invalid_payload';
    end if;
    v_seen_ids := array_append(v_seen_ids, v_level_id);

    -- participatesInCode: JSON boolean only (reject string "true")
    if jsonb_typeof(v_elem->'participatesInCode') is distinct from 'boolean' then
      raise exception 'invalid_payload';
    end if;
    v_participates := (v_elem->'participatesInCode') = 'true'::jsonb;

    if jsonb_typeof(v_elem->'selection') is distinct from 'object' then
      raise exception 'invalid_payload';
    end if;
    v_kind := v_elem#>>'{selection,kind}';
    if v_kind is distinct from 'word' and v_kind is distinct from 'empty' then
      raise exception 'invalid_payload';
    end if;

    v_code_raw := v_elem->'codeSegment';

    -- Fingerprint filter: omit non-participating empty (codeSegment must be JSON null)
    if not v_participates and v_kind = 'empty' then
      if v_code_raw is distinct from 'null'::jsonb then
        raise exception 'invalid_payload';
      end if;
      continue;
    end if;

    if v_kind = 'word' then
      v_word_id := lower(v_elem#>>'{selection,wordId}');
      if not skus_private.is_uuid(v_word_id) then
        raise exception 'invalid_payload';
      end if;
      if v_participates then
        if jsonb_typeof(v_code_raw) is distinct from 'string' then
          raise exception 'invalid_payload';
        end if;
        v_code_segment := v_elem->>'codeSegment';
        if v_code_segment is null or v_code_segment !~ '^[A-Z0-9&.]{1,3}$' then
          raise exception 'invalid_payload';
        end if;
      else
        if v_code_raw is distinct from 'null'::jsonb then
          raise exception 'invalid_payload';
        end if;
        v_code_segment := null;
      end if;

      v_level_json := format(
        '{"codeSegment":%s,"levelId":%s,"selection":{"kind":"word","wordId":%s}}',
        case when v_code_segment is null then 'null' else skus_private.json_str(v_code_segment) end,
        skus_private.json_str(v_level_id),
        skus_private.json_str(v_word_id)
      );
    else
      -- empty participating only: codeSegment must be exactly "000"
      if jsonb_typeof(v_code_raw) is distinct from 'string'
         or (v_elem->>'codeSegment') is distinct from '000' then
        raise exception 'invalid_payload';
      end if;
      v_code_segment := '000';
      v_level_json := format(
        '{"codeSegment":%s,"levelId":%s,"selection":{"kind":"empty"}}',
        skus_private.json_str(v_code_segment),
        skus_private.json_str(v_level_id)
      );
    end if;

    v_tmp := v_tmp || jsonb_build_array(jsonb_build_object(
      '_sort', v_sort,
      '_levelId', v_level_id,
      '_json', v_level_json
    ));
  end loop;

  select coalesce(
    string_agg(e->>'_json', ',' order by (e->>'_sort')::int, e->>'_levelId'),
    ''
  )
  into v_levels_text
  from jsonb_array_elements(v_tmp) e;

  v_canonical := format(
    'sku-selection:v2:{"categoryId":%s,"codeFormatVersion":1,"levels":[%s]}',
    skus_private.json_str(lower(p_snapshot#>>'{category,id}')),
    v_levels_text
  );

  return skus_private.sha256_hex(v_canonical);
end;
$$;

create or replace function skus_private.parse_positive_measure(p_raw text)
returns numeric
language plpgsql
immutable
set search_path = ''
as $$
declare
  v numeric;
  v_norm text;
begin
  if p_raw is null or btrim(p_raw) = '' then
    return null;
  end if;
  v_norm := lower(btrim(p_raw));
  if v_norm in ('nan', 'infinity', '+infinity', '-infinity', 'inf', '+inf', '-inf') then
    raise exception 'invalid_payload';
  end if;
  begin
    v := p_raw::numeric;
  exception when others then
    raise exception 'invalid_payload';
  end;
  if v = 'NaN'::numeric
     or v = 'Infinity'::numeric
     or v = '-Infinity'::numeric then
    raise exception 'invalid_payload';
  end if;
  if v <= 0 then
    raise exception 'invalid_payload';
  end if;
  return v;
end;
$$;

-- Persist measurement history with requestId conflict detection
create or replace function skus_private.persist_measurement_history(
  p_generation_id uuid,
  p_uid uuid,
  p_request_id uuid,
  p_units numeric,
  p_units_status text,
  p_multiples numeric,
  p_multiples_status text,
  p_weight numeric,
  p_weight_status text
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  r record;
begin
  if p_request_id is null
     or p_units is null or p_multiples is null or p_weight is null
     or p_units_status is null or p_multiples_status is null or p_weight_status is null then
    return;
  end if;

  insert into public.skus_sku_generation_measurement_history (
    sku_generation_id, field_name, new_value_numeric, new_value_status, changed_by, request_id
  ) values
    (p_generation_id, 'units_per_box', p_units, p_units_status, p_uid, p_request_id),
    (p_generation_id, 'multiples', p_multiples, p_multiples_status, p_uid, p_request_id),
    (p_generation_id, 'weight', p_weight, p_weight_status, p_uid, p_request_id)
  on conflict (request_id, field_name) where request_id is not null do nothing;

  for r in
    select * from (
      values
        ('units_per_box'::text, p_units, p_units_status),
        ('multiples', p_multiples, p_multiples_status),
        ('weight', p_weight, p_weight_status)
    ) as t(field_name, new_value_numeric, new_value_status)
  loop
    if not exists (
      select 1
      from public.skus_sku_generation_measurement_history h
      where h.request_id = p_request_id
        and h.field_name = r.field_name
        and h.sku_generation_id = p_generation_id
        and h.new_value_numeric is not distinct from r.new_value_numeric
        and h.new_value_status is not distinct from r.new_value_status
        and h.changed_by is not distinct from p_uid
    ) then
      raise exception 'measurement_request_conflict';
    end if;
  end loop;
end;
$$;

revoke all on function skus_private.is_uuid(text) from public, anon, authenticated;
revoke all on function skus_private.parse_uuid(text) from public, anon, authenticated;
revoke all on function skus_private.norm_text(text) from public, anon, authenticated;
revoke all on function skus_private.pick_designation(text, text, text) from public, anon, authenticated;
revoke all on function skus_private.sha256_hex(text) from public, anon, authenticated;
revoke all on function skus_private.json_str(text) from public, anon, authenticated;
revoke all on function skus_private.compute_selection_fingerprint(jsonb) from public, anon, authenticated;
revoke all on function skus_private.parse_positive_measure(text) from public, anon, authenticated;
revoke all on function skus_private.persist_measurement_history(uuid, uuid, uuid, numeric, text, numeric, text, numeric, text)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Core builder (SECURITY INVOKER — called only from DEFINER RPCs)
-- ---------------------------------------------------------------------------
create or replace function skus_private.build_and_persist_generation(
  p_uid uuid,
  p_payload jsonb,
  p_require_measures boolean
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_category_id uuid;
  v_category record;
  v_level record;
  v_word record;
  v_sel_raw jsonb;
  v_payload_sel jsonb;
  v_is_empty boolean;
  v_has_selection boolean;
  v_word_id uuid;
  v_code_segments text[] := array[]::text[];
  v_code text;
  v_pt_parts text[] := array[]::text[];
  v_es_parts text[] := array[]::text[];
  v_en_parts text[] := array[]::text[];
  v_levels_out jsonb := '[]'::jsonb;
  v_snapshot jsonb;
  v_fingerprint text;
  v_existing public.skus_sku_generations;
  v_inserted public.skus_sku_generations;
  v_target public.skus_sku_generations;
  v_created boolean := false;
  v_code_segment text;
  v_selection jsonb;
  v_ref text;
  v_des_pt text;
  v_des_es text;
  v_des_en text;
  v_enabled_count int := 0;
  v_code_level_count int := 0;
  v_units numeric;
  v_multiples numeric;
  v_weight numeric;
  v_units_status text;
  v_multiples_status text;
  v_weight_status text;
  v_request_id uuid;
  v_key text;
  v_has_any_measure_field boolean;
  v_has_complete_measure_set boolean;
  v_request_raw text;
  v_token text;
begin
  if p_uid is null then
    raise exception 'not_authenticated';
  end if;

  if jsonb_typeof(p_payload) is distinct from 'object' then
    raise exception 'invalid_payload';
  end if;

  v_category_id := skus_private.parse_uuid(nullif(p_payload->>'categoryId', ''));

  select c.* into v_category
  from public.skus_categories c
  where c.id = v_category_id;
  if not found then
    raise exception 'category_not_found';
  end if;
  if not coalesce(v_category.is_active, false) then
    raise exception 'category_inactive';
  end if;

  if p_payload ? 'selections' and jsonb_typeof(p_payload->'selections') is distinct from 'object' then
    raise exception 'invalid_payload';
  end if;
  v_payload_sel := coalesce(p_payload->'selections', '{}'::jsonb);

  for v_key in select jsonb_object_keys(v_payload_sel)
  loop
    if not skus_private.is_uuid(v_key) then
      raise exception 'invalid_payload';
    end if;
    if not exists (
      select 1 from public.skus_category_levels l
      where l.category_id = v_category_id and l.id = lower(v_key)::uuid
    ) then
      raise exception 'unknown_level';
    end if;
  end loop;

  select
    count(*) filter (where l.is_enabled),
    count(*) filter (where l.is_enabled and l.participates_in_code)
  into v_enabled_count, v_code_level_count
  from public.skus_category_levels l
  where l.category_id = v_category_id;

  if v_enabled_count = 0 then
    raise exception 'category_has_no_levels';
  end if;
  if v_code_level_count = 0 then
    raise exception 'category_has_no_code_levels';
  end if;

  -- measures contract:
  --   none: measures omitted | null | {} AND no requestId
  --   complete: 3 finite values > 0 + 3 statuses + requestId UUID string
  --   partial (incl. six explicit nulls): invalid_payload
  --   measures wrong JSON type (string/array/bool/number): invalid_payload
  --   requestId empty string / wrong type: invalid_payload
  --   NaN / Infinity / Inf: invalid_payload
  if p_payload ? 'measures'
     and p_payload->'measures' is distinct from 'null'::jsonb
     and jsonb_typeof(p_payload->'measures') is distinct from 'object' then
    raise exception 'invalid_payload';
  end if;

  if p_payload ? 'requestId' then
    if p_payload->'requestId' = 'null'::jsonb then
      v_request_raw := null;
    elsif jsonb_typeof(p_payload->'requestId') is distinct from 'string' then
      raise exception 'invalid_payload';
    elsif (p_payload->>'requestId') = '' then
      raise exception 'invalid_payload';
    else
      v_request_raw := p_payload->>'requestId';
      if not skus_private.is_uuid(v_request_raw) then
        raise exception 'invalid_payload';
      end if;
    end if;
  else
    v_request_raw := null;
  end if;

  v_has_any_measure_field :=
    v_request_raw is not null
    or (
      p_payload ? 'measures'
      and jsonb_typeof(p_payload->'measures') = 'object'
      and (p_payload->'measures') <> '{}'::jsonb
    );

  if p_require_measures or v_has_any_measure_field then
    v_units := skus_private.parse_positive_measure(nullif(p_payload#>>'{measures,unitsPerBox}', ''));
    v_multiples := skus_private.parse_positive_measure(nullif(p_payload#>>'{measures,multiples}', ''));
    v_weight := skus_private.parse_positive_measure(nullif(p_payload#>>'{measures,weight}', ''));
    v_units_status := nullif(p_payload#>>'{measures,unitsPerBoxStatus}', '');
    v_multiples_status := nullif(p_payload#>>'{measures,multiplesStatus}', '');
    v_weight_status := nullif(p_payload#>>'{measures,weightStatus}', '');

    v_has_complete_measure_set :=
      v_units is not null
      and v_multiples is not null
      and v_weight is not null
      and v_units_status in ('real', 'estimated')
      and v_multiples_status in ('real', 'estimated')
      and v_weight_status in ('real', 'estimated')
      and v_request_raw is not null
      and skus_private.is_uuid(v_request_raw);

    if not v_has_complete_measure_set then
      raise exception 'invalid_payload';
    end if;
    v_request_id := v_request_raw::uuid;
  else
    v_units := null;
    v_multiples := null;
    v_weight := null;
    v_units_status := null;
    v_multiples_status := null;
    v_weight_status := null;
    v_request_id := null;
  end if;

  for v_level in
    select * from public.skus_category_levels l
    where l.category_id = v_category_id
    order by l.sort_order, l.id
  loop
    v_sel_raw := v_payload_sel -> v_level.id::text;
    v_has_selection := v_sel_raw is not null and v_sel_raw <> 'null'::jsonb;
    v_is_empty := false;
    v_word_id := null;

    if v_has_selection then
      if jsonb_typeof(v_sel_raw) = 'string' then
        v_token := v_sel_raw #>> '{}';
        if v_token = '__empty__' then
          v_is_empty := true;
        elsif v_token like '__empty__:%' then
          if not skus_private.is_uuid(substr(v_token, length('__empty__:') + 1)) then
            raise exception 'invalid_payload';
          end if;
          v_is_empty := true;
        else
          v_word_id := skus_private.parse_uuid(v_token);
        end if;
      elsif jsonb_typeof(v_sel_raw) = 'object' then
        if v_sel_raw->>'kind' = 'empty' then
          v_is_empty := true;
        elsif v_sel_raw->>'kind' = 'word' then
          v_word_id := skus_private.parse_uuid(v_sel_raw->>'wordId');
        else
          raise exception 'invalid_payload';
        end if;
      else
        raise exception 'invalid_payload';
      end if;
    else
      v_is_empty := true;
    end if;

    if not v_level.is_enabled then
      if v_has_selection then
        raise exception 'level_disabled';
      end if;
      continue;
    end if;

    if v_level.is_required and v_is_empty then
      raise exception 'level_required';
    end if;

    if not v_is_empty then
      select w.* into v_word from public.skus_words w where w.id = v_word_id;
      if not found or v_word.category_level_id is distinct from v_level.id then
        raise exception 'word_not_in_level';
      end if;
      if not coalesce(v_word.is_active, false) then
        raise exception 'word_inactive';
      end if;

      v_ref := upper(btrim(v_word.reference_code));
      if v_ref is null or v_ref !~ '^[A-Z0-9&.]{1,3}$' then
        raise exception 'invalid_reference_code';
      end if;

      v_code_segment := case when v_level.participates_in_code then v_ref else null end;
      v_des_pt := skus_private.pick_designation(v_word.designation_pt, v_word.designation, v_word.label);
      v_des_es := skus_private.pick_designation(v_word.designation_es, v_word.designation, v_word.label);
      v_des_en := skus_private.pick_designation(v_word.designation_en, v_word.designation, v_word.label);

      v_selection := jsonb_build_object(
        'kind', 'word',
        'wordId', v_word.id,
        'label', v_word.label,
        'referenceCode', v_ref,
        'includeInDesignation', coalesce(v_word.include_in_designation, true),
        'designations', jsonb_build_object(
          'pt', v_des_pt,
          'es', v_des_es,
          'en', v_des_en
        )
      );

      if coalesce(v_word.include_in_designation, true) then
        if v_des_pt <> '' then v_pt_parts := array_append(v_pt_parts, v_des_pt); end if;
        if v_des_es <> '' then v_es_parts := array_append(v_es_parts, v_des_es); end if;
        if v_des_en <> '' then v_en_parts := array_append(v_en_parts, v_des_en); end if;
      end if;
    else
      v_code_segment := case when v_level.participates_in_code then '000' else null end;
      v_selection := jsonb_build_object('kind', 'empty');
    end if;

    if v_level.participates_in_code then
      v_code_segments := array_append(v_code_segments, coalesce(v_code_segment, '000'));
    end if;

    v_levels_out := v_levels_out || jsonb_build_array(jsonb_build_object(
      'levelId', v_level.id,
      'key', v_level.key,
      'label', v_level.label,
      'sortOrder', v_level.sort_order,
      'isEnabled', true,
      'isRequired', v_level.is_required,
      'participatesInCode', v_level.participates_in_code,
      'codeSegment', to_jsonb(v_code_segment),
      'selection', v_selection
    ));
  end loop;

  if coalesce(array_length(v_code_segments, 1), 0) = 0 then
    raise exception 'category_has_no_code_levels';
  end if;

  v_code := array_to_string(v_code_segments, '-');

  v_snapshot := jsonb_build_object(
    'version', 2,
    'codeFormatVersion', 1,
    'category', jsonb_build_object(
      'id', v_category.id,
      'slug', v_category.slug,
      'name', v_category.name
    ),
    'levels', v_levels_out
  );

  v_fingerprint := skus_private.compute_selection_fingerprint(v_snapshot);
  if v_fingerprint is null or v_fingerprint !~ '^[0-9a-f]{64}$' then
    raise exception 'sku_generation_invariant_violation';
  end if;

  -- Resolve target generation (idempotent / insert / concurrent recovery)
  select g.* into v_existing
  from public.skus_sku_generations g
  where g.selection_fingerprint = v_fingerprint;
  if found then
    if v_existing.generated_code is distinct from v_code then
      raise exception 'sku_generation_invariant_violation';
    end if;
    v_target := v_existing;
    v_created := false;
  else
    if exists (
      select 1 from public.skus_sku_generations g
      where g.generated_code = v_code
        and g.selection_fingerprint is null
    ) then
      raise exception 'sku_code_collision_legacy';
    end if;

    if exists (
      select 1 from public.skus_sku_generations g
      where g.generated_code = v_code
        and g.selection_fingerprint is distinct from v_fingerprint
    ) then
      raise exception 'sku_code_collision';
    end if;

    begin
      insert into public.skus_sku_generations (
        generated_code,
        designation,
        designation_pt,
        designation_es,
        designation_en,
        product_image_path,
        product_image_url,
        sequence_value,
        prefix_snapshot,
        selection_snapshot,
        snapshot_version,
        selection_fingerprint,
        category_id,
        units_per_box,
        units_per_box_status,
        multiples,
        multiples_status,
        weight,
        weight_status,
        generated_by
      ) values (
        v_code,
        coalesce(nullif(array_to_string(v_pt_parts, ' '), ''), ''),
        coalesce(nullif(array_to_string(v_pt_parts, ' '), ''), ''),
        coalesce(nullif(array_to_string(v_es_parts, ' '), ''), ''),
        coalesce(nullif(array_to_string(v_en_parts, ' '), ''), ''),
        null,
        null,
        1,
        v_code,
        v_snapshot,
        2,
        v_fingerprint,
        v_category_id,
        v_units,
        v_units_status,
        v_multiples,
        v_multiples_status,
        v_weight,
        v_weight_status,
        p_uid
      )
      returning * into v_inserted;
      v_target := v_inserted;
      v_created := true;
    exception
      when unique_violation then
        select g.* into v_existing
        from public.skus_sku_generations g
        where g.selection_fingerprint = v_fingerprint;
        if found then
          if v_existing.generated_code is distinct from v_code then
            raise exception 'sku_generation_invariant_violation';
          end if;
          v_target := v_existing;
          v_created := false;
        else
          select g.* into v_existing
          from public.skus_sku_generations g
          where g.generated_code = v_code;
          if found then
            if v_existing.selection_fingerprint is null then
              raise exception 'sku_code_collision_legacy';
            end if;
            raise exception 'sku_code_collision';
          end if;
          raise exception 'sku_generation_concurrency_failure';
        end if;
    end;
  end if;

  -- Common measurement persistence (new / idempotent / concurrent)
  perform skus_private.persist_measurement_history(
    v_target.id,
    p_uid,
    v_request_id,
    v_units,
    v_units_status,
    v_multiples,
    v_multiples_status,
    v_weight,
    v_weight_status
  );

  return jsonb_build_object(
    'created', v_created,
    'generationId', v_target.id,
    'generatedCode', v_target.generated_code,
    'designationPt', v_target.designation_pt,
    'designationEs', v_target.designation_es,
    'designationEn', v_target.designation_en,
    'snapshotVersion', v_target.snapshot_version,
    'selectionFingerprint', v_target.selection_fingerprint
  );
end;
$$;

revoke all on function skus_private.build_and_persist_generation(uuid, jsonb, boolean)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Public RPC: generate_sku_secure
-- ---------------------------------------------------------------------------
create or replace function public.generate_sku_secure(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if not public.skus_has_min_role('editor') then
    raise exception 'forbidden';
  end if;
  -- images intentionally not accepted in 2B.2
  return skus_private.build_and_persist_generation(v_uid, p_payload, true);
end;
$$;

revoke all on function public.generate_sku_secure(jsonb) from public;
revoke all on function public.generate_sku_secure(jsonb) from anon;
revoke all on function public.generate_sku_secure(jsonb) from authenticated;
grant execute on function public.generate_sku_secure(jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Public RPC: complete_sku_normalization
-- ---------------------------------------------------------------------------
create or replace function public.complete_sku_normalization(
  p_normalization_id uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_norm public.skus_code_normalizations;
  v_result jsonb;
  v_gen_id uuid;
  v_code text;
  v_pt text;
  v_es text;
  v_en text;
  v_payload_category uuid;
  v_batch_updated int;
  v_updated int;
  v_pending int;
  v_completed int;
  v_total int;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if not public.skus_has_min_role('editor') then
    raise exception 'forbidden';
  end if;
  if jsonb_typeof(p_payload) is distinct from 'object' then
    raise exception 'invalid_payload';
  end if;

  select n.* into v_norm
  from public.skus_code_normalizations n
  where n.id = p_normalization_id
  for update;

  if not found then
    raise exception 'not_found';
  end if;
  if v_norm.normalization_status = 'completed' then
    raise exception 'completed';
  end if;
  if v_norm.normalization_status = 'cancelled' then
    raise exception 'cancelled';
  end if;

  if v_norm.locked_by is null then
    raise exception 'lock_required';
  end if;
  if v_norm.locked_by is distinct from v_uid then
    raise exception 'locked_by_other_user';
  end if;
  if v_norm.lock_expires_at is null or v_norm.lock_expires_at < clock_timestamp() then
    raise exception 'lock_expired';
  end if;

  if v_norm.legacy_code is null or btrim(v_norm.legacy_code) = '' then
    raise exception 'missing_legacy_code';
  end if;

  v_payload_category := skus_private.parse_uuid(p_payload->>'categoryId');
  if v_norm.category_id is not null and v_norm.category_id is distinct from v_payload_category then
    raise exception 'normalization_category_mismatch';
  end if;

  v_result := skus_private.build_and_persist_generation(v_uid, p_payload, false);
  v_gen_id := (v_result->>'generationId')::uuid;
  v_code := v_result->>'generatedCode';
  v_pt := v_result->>'designationPt';
  v_es := v_result->>'designationEs';
  v_en := v_result->>'designationEn';

  update public.skus_code_normalizations n
  set
    normalization_status = 'completed',
    category_id = (select g.category_id from public.skus_sku_generations g where g.id = v_gen_id),
    generation_id = v_gen_id,
    final_new_code = v_code,
    final_designation_pt = v_pt,
    final_designation_es = v_es,
    final_designation_en = v_en,
    locked_by = null,
    locked_at = null,
    lock_expires_at = null,
    completed_by = v_uid,
    completed_at = now(),
    updated_at = now()
  where n.id = p_normalization_id
    and n.normalization_status = 'pending'
    and n.locked_by = v_uid
    and n.lock_expires_at >= clock_timestamp();

  get diagnostics v_updated = row_count;
  if v_updated <> 1 then
    raise exception 'lock_expired';
  end if;

  update public.skus_normalization_import_batches b
  set
    pending_rows = b.pending_rows - 1,
    completed_rows = b.completed_rows + 1
  where b.id = v_norm.import_batch_id
    and b.pending_rows > 0
    and b.completed_rows < b.total_rows;

  get diagnostics v_batch_updated = row_count;
  if v_batch_updated <> 1 then
    raise exception 'batch_counter_update_failed';
  end if;

  select b.pending_rows, b.completed_rows, b.total_rows
  into v_pending, v_completed, v_total
  from public.skus_normalization_import_batches b
  where b.id = v_norm.import_batch_id;

  if v_pending < 0 or v_completed > v_total then
    raise exception 'batch_counter_update_failed';
  end if;

  select n.* into v_norm from public.skus_code_normalizations n where n.id = p_normalization_id;

  return jsonb_build_object(
    'normalizationId', v_norm.id,
    'normalizationStatus', v_norm.normalization_status,
    'generationId', v_norm.generation_id,
    'generatedCode', v_norm.final_new_code,
    'designationPt', v_norm.final_designation_pt,
    'designationEs', v_norm.final_designation_es,
    'designationEn', v_norm.final_designation_en,
    'completedAt', v_norm.completed_at
  );
end;
$$;

revoke all on function public.complete_sku_normalization(uuid, jsonb) from public;
revoke all on function public.complete_sku_normalization(uuid, jsonb) from anon;
revoke all on function public.complete_sku_normalization(uuid, jsonb) from authenticated;
grant execute on function public.complete_sku_normalization(uuid, jsonb) to authenticated;

-- Owner safety: RPC/helpers must not be owned by API roles
do $own$
declare
  r record;
begin
  for r in
    select n.nspname, p.proname, pg_catalog.pg_get_userbyid(p.proowner) as owner
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where (
        n.nspname = 'skus_private'
        and p.proname in (
          'is_uuid', 'parse_uuid', 'norm_text', 'pick_designation',
          'sha256_hex', 'json_str', 'compute_selection_fingerprint',
          'parse_positive_measure', 'persist_measurement_history',
          'build_and_persist_generation'
        )
      )
      or (
        n.nspname = 'public'
        and p.proname in ('generate_sku_secure', 'complete_sku_normalization')
      )
  loop
    if r.owner in ('anon', 'authenticated', 'public') then
      raise exception
        '2B.2 R5 abort: untrusted owner % on %.%',
        r.owner, r.nspname, r.proname;
    end if;
  end loop;

  if exists (
    select 1
    from pg_catalog.pg_namespace n
    where n.nspname = 'skus_private'
      and pg_catalog.pg_get_userbyid(n.nspowner) in ('anon', 'authenticated', 'public')
  ) then
    raise exception '2B.2 R5 abort: untrusted owner on schema skus_private';
  end if;
end;
$own$;

-- R5.1 GOLDEN HARNESS (G8 fixed). NOT A MIGRATION. Ends ROLLBACK.

do $golden$
declare
  v_snap jsonb;
  v_hash text;
  v_expected text;
  v_fail int := 0;
begin


  v_expected := '269f5d97aacfa1f71be369169dbb50600dec758cae7149f457a8ba6574ac38e4';
  v_snap := $j_G1_two_words_and_empty$
{"version":2,"codeFormatVersion":1,"category":{"id":"11111111-1111-1111-1111-111111111111","slug":"cosmetica","name":"Cosmetica"},"levels":[{"levelId":"22222222-2222-2222-2222-222222222222","key":"k1","label":"L1","sortOrder":1,"isEnabled":true,"isRequired":false,"participatesInCode":true,"codeSegment":"ALG","selection":{"kind":"word","wordId":"33333333-3333-3333-3333-333333333333","label":"X","referenceCode":"ALG","includeInDesignation":true,"designations":{"pt":"A","es":"A","en":"A"}}},{"levelId":"44444444-4444-4444-4444-444444444444","key":"k2","label":"L2","sortOrder":2,"isEnabled":true,"isRequired":false,"participatesInCode":true,"codeSegment":"FMT","selection":{"kind":"word","wordId":"55555555-5555-5555-5555-555555555555","label":"X","referenceCode":"FMT","includeInDesignation":true,"designations":{"pt":"A","es":"A","en":"A"}}},{"levelId":"66666666-6666-6666-6666-666666666666","key":"e3","label":"E3","sortOrder":3,"isEnabled":true,"isRequired":false,"participatesInCode":true,"codeSegment":"000","selection":{"kind":"empty"}}]}
$j_G1_two_words_and_empty$::jsonb;
  v_hash := skus_private.compute_selection_fingerprint(v_snap);
  raise notice '% ts=% pg=% match=%', 'G1_two_words_and_empty', v_expected, v_hash, (v_hash = v_expected);
  if v_hash is distinct from v_expected then v_fail := v_fail + 1; end if;


  v_expected := '3b300d59db29e1654a66dde184a5f03fa0856ebdd9bf4050c38dd4337200b823';
  v_snap := $j_G2_empty_participant$
{"version":2,"codeFormatVersion":1,"category":{"id":"11111111-1111-1111-1111-111111111111","slug":"cosmetica","name":"Cosmetica"},"levels":[{"levelId":"22222222-2222-2222-2222-222222222222","key":"e1","label":"E1","sortOrder":1,"isEnabled":true,"isRequired":false,"participatesInCode":true,"codeSegment":"000","selection":{"kind":"empty"}}]}
$j_G2_empty_participant$::jsonb;
  v_hash := skus_private.compute_selection_fingerprint(v_snap);
  raise notice '% ts=% pg=% match=%', 'G2_empty_participant', v_expected, v_hash, (v_hash = v_expected);
  if v_hash is distinct from v_expected then v_fail := v_fail + 1; end if;


  v_expected := '269f5d97aacfa1f71be369169dbb50600dec758cae7149f457a8ba6574ac38e4';
  v_snap := $j_G3_shuffled_order$
{"version":2,"codeFormatVersion":1,"category":{"id":"11111111-1111-1111-1111-111111111111","slug":"cosmetica","name":"Cosmetica"},"levels":[{"levelId":"66666666-6666-6666-6666-666666666666","key":"e3","label":"E3","sortOrder":3,"isEnabled":true,"isRequired":false,"participatesInCode":true,"codeSegment":"000","selection":{"kind":"empty"}},{"levelId":"44444444-4444-4444-4444-444444444444","key":"k2","label":"L2","sortOrder":2,"isEnabled":true,"isRequired":false,"participatesInCode":true,"codeSegment":"FMT","selection":{"kind":"word","wordId":"55555555-5555-5555-5555-555555555555","label":"X","referenceCode":"FMT","includeInDesignation":true,"designations":{"pt":"A","es":"A","en":"A"}}},{"levelId":"22222222-2222-2222-2222-222222222222","key":"k1","label":"L1","sortOrder":1,"isEnabled":true,"isRequired":false,"participatesInCode":true,"codeSegment":"ALG","selection":{"kind":"word","wordId":"33333333-3333-3333-3333-333333333333","label":"X","referenceCode":"ALG","includeInDesignation":true,"designations":{"pt":"A","es":"A","en":"A"}}}]}
$j_G3_shuffled_order$::jsonb;
  v_hash := skus_private.compute_selection_fingerprint(v_snap);
  raise notice '% ts=% pg=% match=%', 'G3_shuffled_order', v_expected, v_hash, (v_hash = v_expected);
  if v_hash is distinct from v_expected then v_fail := v_fail + 1; end if;


  v_expected := '3aa63026659b0706a2dee5c28369e3f8939e02773fcde9888f6a51ea3fcb43c5';
  v_snap := $j_G4_omit_non_participating_empty$
{"version":2,"codeFormatVersion":1,"category":{"id":"11111111-1111-1111-1111-111111111111","slug":"cosmetica","name":"Cosmetica"},"levels":[{"levelId":"22222222-2222-2222-2222-222222222222","key":"k1","label":"L1","sortOrder":1,"isEnabled":true,"isRequired":false,"participatesInCode":true,"codeSegment":"ALG","selection":{"kind":"word","wordId":"33333333-3333-3333-3333-333333333333","label":"X","referenceCode":"ALG","includeInDesignation":true,"designations":{"pt":"A","es":"A","en":"A"}}},{"levelId":"44444444-4444-4444-4444-444444444444","key":"e2","label":"E2","sortOrder":2,"isEnabled":true,"isRequired":false,"participatesInCode":false,"codeSegment":null,"selection":{"kind":"empty"}}]}
$j_G4_omit_non_participating_empty$::jsonb;
  v_hash := skus_private.compute_selection_fingerprint(v_snap);
  raise notice '% ts=% pg=% match=%', 'G4_omit_non_participating_empty', v_expected, v_hash, (v_hash = v_expected);
  if v_hash is distinct from v_expected then v_fail := v_fail + 1; end if;


  v_expected := 'fcd29af4cb3d5dca1d238ee66dbd5b4dbfb139e319a0629146581811e204752a';
  v_snap := $j_G5_non_participating_word_null$
{"version":2,"codeFormatVersion":1,"category":{"id":"11111111-1111-1111-1111-111111111111","slug":"cosmetica","name":"Cosmetica"},"levels":[{"levelId":"22222222-2222-2222-2222-222222222222","key":"k1","label":"L1","sortOrder":1,"isEnabled":true,"isRequired":false,"participatesInCode":true,"codeSegment":"ALG","selection":{"kind":"word","wordId":"33333333-3333-3333-3333-333333333333","label":"X","referenceCode":"ALG","includeInDesignation":true,"designations":{"pt":"A","es":"A","en":"A"}}},{"levelId":"44444444-4444-4444-4444-444444444444","key":"k2","label":"L2","sortOrder":2,"isEnabled":true,"isRequired":false,"participatesInCode":false,"codeSegment":null,"selection":{"kind":"word","wordId":"55555555-5555-5555-5555-555555555555","label":"X","referenceCode":"X","includeInDesignation":true,"designations":{"pt":"A","es":"A","en":"A"}}}]}
$j_G5_non_participating_word_null$::jsonb;
  v_hash := skus_private.compute_selection_fingerprint(v_snap);
  raise notice '% ts=% pg=% match=%', 'G5_non_participating_word_null', v_expected, v_hash, (v_hash = v_expected);
  if v_hash is distinct from v_expected then v_fail := v_fail + 1; end if;


  v_expected := 'b521696be1177c004c3fee5d6853c2da570b22f8b1774a6871d75720557538a2';
  v_snap := $j_G6_label_change_same_hash$
{"version":2,"codeFormatVersion":1,"category":{"id":"11111111-1111-1111-1111-111111111111","slug":"cosmetica","name":"Cosmetica"},"levels":[{"levelId":"22222222-2222-2222-2222-222222222222","key":"k1","label":"CHANGED","sortOrder":1,"isEnabled":true,"isRequired":false,"participatesInCode":true,"codeSegment":"ALG","selection":{"kind":"word","wordId":"33333333-3333-3333-3333-333333333333","label":"CHANGED","referenceCode":"ALG","includeInDesignation":true,"designations":{"pt":"ZZ","es":"ZZ","en":"ZZ"}}},{"levelId":"44444444-4444-4444-4444-444444444444","key":"e2","label":"E2","sortOrder":2,"isEnabled":true,"isRequired":false,"participatesInCode":true,"codeSegment":"000","selection":{"kind":"empty"}}]}
$j_G6_label_change_same_hash$::jsonb;
  v_hash := skus_private.compute_selection_fingerprint(v_snap);
  raise notice '% ts=% pg=% match=%', 'G6_label_change_same_hash', v_expected, v_hash, (v_hash = v_expected);
  if v_hash is distinct from v_expected then v_fail := v_fail + 1; end if;


  v_expected := 'e9ebce7dd6d0b767d8465ea7c2281bfc6c970895fed7a3403b101b9d30017b67';
  v_snap := $j_G7_segment_change_diff_hash$
{"version":2,"codeFormatVersion":1,"category":{"id":"11111111-1111-1111-1111-111111111111","slug":"cosmetica","name":"Cosmetica"},"levels":[{"levelId":"22222222-2222-2222-2222-222222222222","key":"k1","label":"L1","sortOrder":1,"isEnabled":true,"isRequired":false,"participatesInCode":true,"codeSegment":"XXX","selection":{"kind":"word","wordId":"33333333-3333-3333-3333-333333333333","label":"X","referenceCode":"XXX","includeInDesignation":true,"designations":{"pt":"A","es":"A","en":"A"}}},{"levelId":"44444444-4444-4444-4444-444444444444","key":"e2","label":"E2","sortOrder":2,"isEnabled":true,"isRequired":false,"participatesInCode":true,"codeSegment":"000","selection":{"kind":"empty"}}]}
$j_G7_segment_change_diff_hash$::jsonb;
  v_hash := skus_private.compute_selection_fingerprint(v_snap);
  raise notice '% ts=% pg=% match=%', 'G7_segment_change_diff_hash', v_expected, v_hash, (v_hash = v_expected);
  if v_hash is distinct from v_expected then v_fail := v_fail + 1; end if;


  v_expected := 'fb4f57ccceefa2b6bf7048e2d03d8b0ada5b259211e22866220bb329eec10f57';
  v_snap := $j_G8_uuid_uppercase_normalized$
{"version":2,"codeFormatVersion":1,"category":{"id":"AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA","slug":"cosmetica","name":"Cosmetica"},"levels":[{"levelId":"BBBBBBBB-BBBB-4BBB-8BBB-BBBBBBBBBBBB","key":"k1","label":"L1","sortOrder":1,"isEnabled":true,"isRequired":false,"participatesInCode":true,"codeSegment":"ALG","selection":{"kind":"word","wordId":"DDDDDDDD-DDDD-4DDD-8DDD-DDDDDDDDDDDD","label":"X","referenceCode":"ALG","includeInDesignation":true,"designations":{"pt":"A","es":"A","en":"A"}}},{"levelId":"CCCCCCCC-CCCC-4CCC-8CCC-CCCCCCCCCCCC","key":"e2","label":"E2","sortOrder":2,"isEnabled":true,"isRequired":false,"participatesInCode":true,"codeSegment":"000","selection":{"kind":"empty"}}]}
$j_G8_uuid_uppercase_normalized$::jsonb;
  v_hash := skus_private.compute_selection_fingerprint(v_snap);
  raise notice '% ts=% pg=% match=%', 'G8_uuid_uppercase_normalized', v_expected, v_hash, (v_hash = v_expected);
  if v_hash is distinct from v_expected then v_fail := v_fail + 1; end if;


  if v_fail > 0 then raise exception 'golden mismatch count=%', v_fail; end if;
  raise notice 'R5.1 golden OK';
end;
$golden$;

rollback;
