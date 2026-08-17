-- Designacao: excluir 000/Vazio do texto; nivel product entra sempre (se nao for 000).

begin;

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
  select case
    when lower(skus_private.norm_text(coalesce(p_label, ''))) = 'vazio' then ''
    else coalesce(
      skus_private.norm_text(p_locale),
      skus_private.norm_text(p_designation),
      skus_private.norm_text(p_label),
      ''
    )
  end;
$$;

-- ---------------------------------------------------------------------------
-- Fingerprint: SHA-256 hex of explicit canonical text (NOT jsonb::text)
-- Contract keys order:
--   root: categoryId, codeFormatVersion, levels
--   level: codeSegment, levelId, selection
--   selection word: kind, wordId
--   selection empty: kind
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

      if v_ref <> '000'
         and (
           lower(btrim(coalesce(v_level.key, ''))) = 'product'
           or coalesce(v_word.include_in_designation, true)
         ) then
        if v_des_pt <> '' and lower(v_des_pt) <> 'vazio' then v_pt_parts := array_append(v_pt_parts, v_des_pt); end if;
        if v_des_es <> '' and lower(v_des_es) <> 'vazio' then v_es_parts := array_append(v_es_parts, v_des_es); end if;
        if v_des_en <> '' and lower(v_des_en) <> 'vazio' then v_en_parts := array_append(v_en_parts, v_des_en); end if;
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



commit;
