-- Import server-side (service_role) completes OK2 rows by setting final_new_code.
-- That fires skus_private triggers and a partial unique index expression.
-- service_role must execute those helpers; authenticated/anon must not gain access.

begin;

grant usage on schema skus_private to service_role;

grant execute on function skus_private.normalize_sku_reference(text) to service_role;

grant execute on function skus_private.enforce_sku_reference_uniqueness() to service_role;

commit;
