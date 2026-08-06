"use server";

import { createSupabaseServiceServerClient } from "@/lib/supabase-service-server";
import type {
  NormalizationImportBatchSummary,
  NormalizationQueueItem,
  NormalizationRecord,
} from "@/lib/types";

function mapBatch(row: Record<string, unknown>): NormalizationImportBatchSummary {
  return {
    id: String(row.id),
    fileName: String(row.file_name ?? ""),
    status: String(row.status ?? ""),
    totalRows: Number(row.total_rows ?? 0),
    pendingRows: Number(row.pending_rows ?? 0),
    completedRows: Number(row.completed_rows ?? 0),
    invalidRows: Number(row.invalid_rows ?? 0),
    createdAt: String(row.created_at ?? ""),
  };
}

function mapQueueItem(row: Record<string, unknown>): NormalizationQueueItem {
  const batch = row.skus_normalization_import_batches as Record<string, unknown> | null;
  return {
    id: String(row.id),
    importBatchId: String(row.import_batch_id),
    batchFileName: String(batch?.file_name ?? ""),
    sourceRowNumber: Number(row.source_row_number ?? 0),
    legacyCode: row.legacy_code ? String(row.legacy_code) : null,
    legacyDesignation: row.legacy_designation ? String(row.legacy_designation) : null,
    sourceNewCode: row.source_new_code ? String(row.source_new_code) : null,
    sourceDesignationPt: row.source_designation_pt ? String(row.source_designation_pt) : null,
    normalizationStatus: String(row.normalization_status ?? "pending") as NormalizationQueueItem["normalizationStatus"],
    categoryId: row.category_id ? String(row.category_id) : null,
    importIssue: row.import_issue ? String(row.import_issue) : null,
    lockedBy: row.locked_by ? String(row.locked_by) : null,
    lockedAt: row.locked_at ? String(row.locked_at) : null,
    lockExpiresAt: row.lock_expires_at ? String(row.lock_expires_at) : null,
    finalNewCode: row.final_new_code ? String(row.final_new_code) : null,
    completedAt: row.completed_at ? String(row.completed_at) : null,
  };
}

function mapRecord(row: Record<string, unknown>): NormalizationRecord {
  const base = mapQueueItem(row);
  return {
    ...base,
    sourceDesignationEs: row.source_designation_es ? String(row.source_designation_es) : null,
    sourceDesignationEn: row.source_designation_en ? String(row.source_designation_en) : null,
    sourceStatus: row.source_status ? String(row.source_status) : null,
    sourceObservations: row.source_observations ? String(row.source_observations) : null,
    generationId: row.generation_id ? String(row.generation_id) : null,
    finalDesignationPt: row.final_designation_pt ? String(row.final_designation_pt) : null,
    finalDesignationEs: row.final_designation_es ? String(row.final_designation_es) : null,
    finalDesignationEn: row.final_designation_en ? String(row.final_designation_en) : null,
  };
}

export async function getNormalizationImportBatches(): Promise<NormalizationImportBatchSummary[]> {
  const supabase = createSupabaseServiceServerClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("skus_normalization_import_batches")
    .select("id, file_name, status, total_rows, pending_rows, completed_rows, invalid_rows, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map(mapBatch);
}

export async function getPendingNormalizationQueue(limit = 100): Promise<NormalizationQueueItem[]> {
  const supabase = createSupabaseServiceServerClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("skus_code_normalizations")
    .select(
      `
      id, import_batch_id, source_row_number,
      legacy_code, legacy_designation, source_new_code, source_designation_pt,
      normalization_status, category_id, import_issue,
      locked_by, locked_at, lock_expires_at,
      final_new_code, completed_at,
      skus_normalization_import_batches ( file_name )
    `,
    )
    .eq("normalization_status", "pending")
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map(mapQueueItem);
}

export async function getNormalizationById(id: string): Promise<NormalizationRecord | null> {
  const supabase = createSupabaseServiceServerClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("skus_code_normalizations")
    .select(
      `
      id, import_batch_id, source_row_number,
      legacy_code, legacy_designation,
      source_new_code, source_designation_pt, source_designation_es, source_designation_en,
      source_status, source_observations,
      normalization_status, category_id, generation_id, import_issue,
      locked_by, locked_at, lock_expires_at,
      final_new_code, final_designation_pt, final_designation_es, final_designation_en,
      completed_at,
      skus_normalization_import_batches ( file_name )
    `,
    )
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapRecord(data as Record<string, unknown>);
}
