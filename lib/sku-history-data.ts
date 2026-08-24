"use server";

import { createSupabaseServiceServerClient } from "@/lib/supabase-service-server";

const SKU_HISTORY_EXPORT_PAGE_SIZE = 500;
const SKU_HISTORY_EXPORT_MAX_ROWS = 20_000;

type SupabaseProfileRelation = { name?: string | null } | Array<{ name?: string | null }> | null;

type SupabaseSkuHistoryExportRow = {
  id: string;
  generated_code: string | null;
  designation: string | null;
  designation_pt: string | null;
  designation_es: string | null;
  designation_en: string | null;
  prefix_snapshot: string | null;
  product_image_url: string | null;
  selection_snapshot: unknown;
  snapshot_version: number | null;
  selection_fingerprint: string | null;
  units_per_box: number | string | null;
  units_per_box_status: string | null;
  multiples: number | string | null;
  multiples_status: string | null;
  weight: number | string | null;
  weight_status: string | null;
  created_at: string | null;
  skus_profiles?: SupabaseProfileRelation;
  skus_categories?: { name?: string | null } | Array<{ name?: string | null }> | null;
};

export interface SkuHistoryExportItem {
  id: string;
  generatedCode: string;
  designation: string;
  designationPt: string;
  designationEs: string;
  designationEn: string;
  prefixSnapshot: string;
  productImageUrl: string | null;
  selectionSnapshot: unknown;
  snapshotVersion: number;
  selectionFingerprint: string | null;
  categoryName: string | null;
  unitsPerBox: number | null;
  unitsPerBoxStatus: string | null;
  multiples: number | null;
  multiplesStatus: string | null;
  weight: number | null;
  weightStatus: string | null;
  createdByName: string | null;
  createdAt: string;
}

function mapSkuHistoryExportRow(row: SupabaseSkuHistoryExportRow): SkuHistoryExportItem {
  const profileRelation = Array.isArray(row.skus_profiles) ? row.skus_profiles[0] : row.skus_profiles;
  const categoryRelation = Array.isArray(row.skus_categories) ? row.skus_categories[0] : row.skus_categories;

  return {
    id: String(row.id),
    generatedCode: String(row.generated_code ?? ""),
    designation: String(row.designation ?? ""),
    designationPt: String(row.designation_pt ?? row.designation ?? ""),
    designationEs: String(row.designation_es ?? row.designation ?? ""),
    designationEn: String(row.designation_en ?? row.designation ?? ""),
    prefixSnapshot: String(row.prefix_snapshot ?? ""),
    productImageUrl: row.product_image_url ? String(row.product_image_url) : null,
    selectionSnapshot: row.selection_snapshot ?? {},
    snapshotVersion: Number(row.snapshot_version ?? 1),
    selectionFingerprint: row.selection_fingerprint ? String(row.selection_fingerprint) : null,
    categoryName: categoryRelation?.name ? String(categoryRelation.name) : null,
    unitsPerBox: row.units_per_box == null ? null : Number(row.units_per_box),
    unitsPerBoxStatus: row.units_per_box_status ? String(row.units_per_box_status) : null,
    multiples: row.multiples == null ? null : Number(row.multiples),
    multiplesStatus: row.multiples_status ? String(row.multiples_status) : null,
    weight: row.weight == null ? null : Number(row.weight),
    weightStatus: row.weight_status ? String(row.weight_status) : null,
    createdByName: profileRelation?.name ? String(profileRelation.name) : null,
    createdAt: row.created_at ? String(row.created_at) : "",
  };
}

export async function fetchAllSkuGenerationsForExport(): Promise<SkuHistoryExportItem[]> {
  const supabase = createSupabaseServiceServerClient();
  if (!supabase) return [];

  const items: SkuHistoryExportItem[] = [];
  let offset = 0;

  while (items.length < SKU_HISTORY_EXPORT_MAX_ROWS) {
    const result = await supabase
      .from("skus_sku_generations")
      .select(
        "id, generated_code, designation, designation_pt, designation_es, designation_en, prefix_snapshot, product_image_url, selection_snapshot, snapshot_version, selection_fingerprint, units_per_box, units_per_box_status, multiples, multiples_status, weight, weight_status, created_at, skus_profiles(name), skus_categories(name)",
      )
      .order("created_at", { ascending: false })
      .range(offset, offset + SKU_HISTORY_EXPORT_PAGE_SIZE - 1);

    if (result.error) {
      throw new Error(result.error.message);
    }

    const batch = ((result.data ?? []) as SupabaseSkuHistoryExportRow[]).map(mapSkuHistoryExportRow);
    items.push(...batch);

    if (batch.length < SKU_HISTORY_EXPORT_PAGE_SIZE) break;
    offset += SKU_HISTORY_EXPORT_PAGE_SIZE;
  }

  return items.slice(0, SKU_HISTORY_EXPORT_MAX_ROWS);
}
