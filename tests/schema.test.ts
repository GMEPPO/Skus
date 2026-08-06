import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const schemaSql = readFileSync("supabase/schema.sql", "utf8");
const resetSql = readFileSync("supabase/reset_global_sku_library.sql", "utf8");
const migrationSql = readFileSync(
  "supabase/migrations/20260805100000_phase1a_categories_levels_normalizations.sql",
  "utf8",
);

describe("global sku schema", () => {
  it("keeps only the current project tables in the base schema", () => {
    const createdTables = Array.from(schemaSql.matchAll(/create table if not exists public\.(skus_[a-z_]+)/g)).map(
      (match) => match[1],
    );

    expect(createdTables).toEqual([
      "skus_roles",
      "skus_permissions",
      "skus_role_permissions",
      "skus_profiles",
      "skus_field_types",
      "skus_categories",
      "skus_category_levels",
      "skus_words",
      "skus_sku_sequences",
      "skus_sku_generations",
      "skus_normalization_import_batches",
      "skus_code_normalizations",
      "skus_sku_generation_measurement_history",
      "skus_admin_audit_logs",
    ]);
  });

  it("defines phase 1A category and normalization structures", () => {
    expect(schemaSql).toContain("create table if not exists public.skus_categories");
    expect(schemaSql).toContain("create table if not exists public.skus_category_levels");
    expect(schemaSql).toContain("create table if not exists public.skus_normalization_import_batches");
    expect(schemaSql).toContain("create table if not exists public.skus_code_normalizations");
    expect(schemaSql).toContain("category_level_id");
    expect(schemaSql).toContain("snapshot_version");
    expect(schemaSql).toContain("('cosmetica', 'Cosmética'");
    expect(schemaSql).toContain("('dry-amenities', 'Dry Amenities'");
  });

  it("keeps the additive phase 1A migration with lock RPCs", () => {
    expect(migrationSql).toContain("claim_sku_normalization");
    expect(migrationSql).toContain("renew_sku_normalization_claim");
    expect(migrationSql).toContain("release_sku_normalization_claim");
    expect(migrationSql).toContain("interval '10 minutes'");
    expect(migrationSql).toContain("set search_path = ''");
    expect(migrationSql).toContain("lock_expires_at >= now()");
    expect(migrationSql).toContain("skus_code_normalizations_lock_consistency");
    expect(migrationSql).toContain("phase1a_abort");
    expect(migrationSql).not.toContain("complete_sku_normalization");
    expect(migrationSql).not.toMatch(/\('brand',\s*'Marca \/ Linha',\s*1,\s*true\)/);
    expect(migrationSql).not.toMatch(
      /locked_by is null\s+or n\.lock_expires_at is null\s+or n\.lock_expires_at < now\(\)/,
    );
    expect(migrationSql).toMatch(
      /release_sku_normalization_claim[\s\S]*normalization_status = 'pending'[\s\S]*locked_by = v_uid/,
    );
    expect(migrationSql).toMatch(/legacy_code text null/);
    expect(schemaSql).toContain("skus_code_normalizations_lock_consistency");
    expect(schemaSql).toMatch(/legacy_code text null/);
  });

  it("includes phase 2B.1 fingerprint and nullable default_field_type_id", () => {
    const phase2b1 = readFileSync(
      "supabase/migrations/20260805140000_phase2b1_fingerprint_and_nullable_field_type.sql",
      "utf8",
    );
    expect(phase2b1).toContain("selection_fingerprint");
    expect(phase2b1).toContain("alter column default_field_type_id drop not null");
    expect(schemaSql).toContain("selection_fingerprint");
    expect(schemaSql).toMatch(/default_field_type_id uuid null/);
  });

  it("drops obsolete family/tree/normalizer tables in the reset script", () => {
    for (const tableName of [
      "skus_families",
      "skus_word_families",
      "skus_word_dependencies",
      "skus_family_tree_versions",
      "skus_family_tree_levels",
      "skus_family_tree_level_words",
      "skus_family_tree_edges",
      "skus_refnorm_catalog_entries",
      "skus_refnorm_rules",
      "skus_refnorm_settings",
    ]) {
      expect(resetSql).toContain(`drop table if exists public.${tableName}`);
      expect(schemaSql).not.toContain(`public.${tableName}`);
    }
  });
});
