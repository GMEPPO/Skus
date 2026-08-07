-- Permite gerar SKU sem dados logisticos quando requireLogisticsData = off/false.

create or replace function public.generate_sku_secure(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_require_measures boolean := true;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if not public.skus_has_min_role('editor') then
    raise exception 'forbidden';
  end if;

  if p_payload ? 'requireLogisticsData' then
    v_require_measures := lower(coalesce(p_payload->>'requireLogisticsData', '')) not in ('false', 'off', '0');
  end if;

  return skus_private.build_and_persist_generation(v_uid, p_payload, v_require_measures);
end;
$$;

revoke all on function public.generate_sku_secure(jsonb) from public;
revoke all on function public.generate_sku_secure(jsonb) from anon;
revoke all on function public.generate_sku_secure(jsonb) from authenticated;
grant execute on function public.generate_sku_secure(jsonb) to authenticated;
