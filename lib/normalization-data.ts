"use server";

import { createSupabaseServiceServerClient } from "@/lib/supabase-service-server";
import { isOk2SourceStatus } from "@/lib/normalization-source-status";
import type {
  NormalizationHistoryItem,
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

const NORMALIZATION_QUEUE_PAGE_SIZE = 1000;
const NORMALIZATION_QUEUE_FETCH_ALL_CAP = 20_000;

type NormalizationFieldRow = {
  id: string;
  source_new_code: string | null;
  source_designation_pt: string | null;
  source_designation_es: string | null;
  source_designation_en: string | null;
  final_new_code: string | null;
  final_designation_pt: string | null;
  final_designation_es: string | null;
  final_designation_en: string | null;
};

function pickSourceDesignation(row: NormalizationFieldRow): string | null {
  return row.source_designation_pt ?? row.source_designation_es ?? row.source_designation_en ?? null;
}

async function reconcileImportedOk2Rows(supabase: NonNullable<ReturnType<typeof createSupabaseServiceServerClient>>) {
  const { data: pendingOk2, error } = await supabase
    .from("skus_code_normalizations")
    .select(
      "id, source_new_code, source_designation_pt, source_designation_es, source_designation_en, final_new_code, final_designation_pt, final_designation_es, final_designation_en",
    )
    .eq("normalization_status", "pending")
    .ilike("source_status", "ok2");

  if (error) throw new Error(error.message);

  const completedAt = new Date().toISOString();
  for (const row of (pendingOk2 ?? []) as NormalizationFieldRow[]) {
    const sourceDesignation = pickSourceDesignation(row);
    await supabase
      .from("skus_code_normalizations")
      .update({
        normalization_status: "completed",
        completed_at: completedAt,
        final_new_code: row.final_new_code ?? row.source_new_code,
        final_designation_pt: row.final_designation_pt ?? row.source_designation_pt ?? sourceDesignation,
        final_designation_es: row.final_designation_es ?? row.source_designation_es,
        final_designation_en: row.final_designation_en ?? row.source_designation_en,
      })
      .eq("id", row.id);
  }
}

async function backfillCompletedNormalizationFields(
  supabase: NonNullable<ReturnType<typeof createSupabaseServiceServerClient>>,
) {
  let offset = 0;

  while (offset < NORMALIZATION_QUEUE_FETCH_ALL_CAP) {
    const { data, error } = await supabase
      .from("skus_code_normalizations")
      .select(
        "id, source_new_code, source_designation_pt, source_designation_es, source_designation_en, final_new_code, final_designation_pt, final_designation_es, final_designation_en",
      )
      .eq("normalization_status", "completed")
      .or("final_designation_pt.is.null,final_new_code.is.null")
      .range(offset, offset + NORMALIZATION_QUEUE_PAGE_SIZE - 1);

    if (error) throw new Error(error.message);

    const page = (data ?? []) as NormalizationFieldRow[];
    if (page.length === 0) break;

    for (const row of page) {
      const sourceDesignation = pickSourceDesignation(row);
      const updates: Record<string, string> = {};

      if (!row.final_new_code && row.source_new_code) {
        updates.final_new_code = row.source_new_code;
      }
      if (!row.final_designation_pt && (row.source_designation_pt ?? sourceDesignation)) {
        updates.final_designation_pt = row.source_designation_pt ?? sourceDesignation ?? "";
      }
      if (!row.final_designation_es && row.source_designation_es) {
        updates.final_designation_es = row.source_designation_es;
      }
      if (!row.final_designation_en && row.source_designation_en) {
        updates.final_designation_en = row.source_designation_en;
      }

      if (Object.keys(updates).length > 0) {
        await supabase.from("skus_code_normalizations").update(updates).eq("id", row.id);
      }
    }

    if (page.length < NORMALIZATION_QUEUE_PAGE_SIZE) break;
    offset += NORMALIZATION_QUEUE_PAGE_SIZE;
  }
}

const PENDING_QUEUE_SELECT = `
      id, import_batch_id, source_row_number,
      legacy_code, legacy_designation, source_new_code, source_designation_pt,
      source_status,
      normalization_status, category_id, import_issue,
      locked_by, locked_at, lock_expires_at,
      final_new_code, completed_at,
      skus_normalization_import_batches ( file_name )
    `;

export async function getPendingNormalizationQueueCount(): Promise<number> {
  const supabase = createSupabaseServiceServerClient();
  if (!supabase) return 0;

  await reconcileImportedOk2Rows(supabase);

  const { count, error } = await supabase
    .from("skus_code_normalizations")
    .select("id", { count: "exact", head: true })
    .eq("normalization_status", "pending");

  if (error) throw new Error(error.message);
  return count ?? 0;
}

/** @param limit When omitted, loads all pending rows (paginated) up to NORMALIZATION_QUEUE_FETCH_ALL_CAP. */
export async function getPendingNormalizationQueue(limit?: number): Promise<NormalizationQueueItem[]> {
  const supabase = createSupabaseServiceServerClient();
  if (!supabase) return [];

  await reconcileImportedOk2Rows(supabase);

  const maxRows = limit ?? NORMALIZATION_QUEUE_FETCH_ALL_CAP;
  const rows: Record<string, unknown>[] = [];
  let offset = 0;

  while (rows.length < maxRows) {
    const batchSize = Math.min(NORMALIZATION_QUEUE_PAGE_SIZE, maxRows - rows.length);
    const { data, error } = await supabase
      .from("skus_code_normalizations")
      .select(PENDING_QUEUE_SELECT)
      .eq("normalization_status", "pending")
      .order("created_at", { ascending: true })
      .range(offset, offset + batchSize - 1);

    if (error) throw new Error(error.message);

    const page = (data ?? []) as Record<string, unknown>[];
    if (page.length === 0) break;

    rows.push(...page);
    if (page.length < batchSize) break;
    offset += batchSize;
  }

  return rows
    .filter((row) => !isOk2SourceStatus(row.source_status ? String(row.source_status) : null))
    .map(mapQueueItem);
}

const COMPLETED_HISTORY_SELECT = `
      id,
      legacy_code, legacy_designation,
      source_new_code, source_designation_pt, source_designation_es, source_designation_en,
      final_new_code, final_designation_pt, final_designation_es, final_designation_en,
      source_status, category_id, completed_at,
      skus_categories ( name, slug )
    `;

function mapHistoryItem(row: Record<string, unknown>): NormalizationHistoryItem {
  const category = row.skus_categories as Record<string, unknown> | null;
  const finalNewCode = row.final_new_code ? String(row.final_new_code) : null;
  const sourceNewCode = row.source_new_code ? String(row.source_new_code) : null;
  const finalDesignationPt = row.final_designation_pt ? String(row.final_designation_pt) : null;
  const sourceDesignationPt = row.source_designation_pt ? String(row.source_designation_pt) : null;
  const sourceDesignationEs = row.source_designation_es ? String(row.source_designation_es) : null;
  const sourceDesignationEn = row.source_designation_en ? String(row.source_designation_en) : null;
  const finalDesignationEs = row.final_designation_es ? String(row.final_designation_es) : null;
  const finalDesignationEn = row.final_designation_en ? String(row.final_designation_en) : null;

  return {
    id: String(row.id),
    legacyCode: row.legacy_code ? String(row.legacy_code) : null,
    legacyDesignation: row.legacy_designation ? String(row.legacy_designation) : null,
    newCode: finalNewCode ?? sourceNewCode,
    newDesignationPt:
      finalDesignationPt ??
      sourceDesignationPt ??
      finalDesignationEs ??
      sourceDesignationEs ??
      finalDesignationEn ??
      sourceDesignationEn ??
      null,
    categoryId: row.category_id ? String(row.category_id) : null,
    categoryName: category?.name ? String(category.name) : null,
    categorySlug: category?.slug ? String(category.slug) : null,
    completedAt: row.completed_at ? String(row.completed_at) : null,
    sourceStatus: row.source_status ? String(row.source_status) : null,
  };
}

/** Loads completed normalizations (wizard + OK2 import) for history view. */
export async function getCompletedNormalizationHistory(limit?: number): Promise<NormalizationHistoryItem[]> {
  const supabase = createSupabaseServiceServerClient();
  if (!supabase) return [];

  await reconcileImportedOk2Rows(supabase);
  await backfillCompletedNormalizationFields(supabase);

  const maxRows = limit ?? NORMALIZATION_QUEUE_FETCH_ALL_CAP;
  const rows: Record<string, unknown>[] = [];
  let offset = 0;

  while (rows.length < maxRows) {
    const batchSize = Math.min(NORMALIZATION_QUEUE_PAGE_SIZE, maxRows - rows.length);
    const { data, error } = await supabase
      .from("skus_code_normalizations")
      .select(COMPLETED_HISTORY_SELECT)
      .eq("normalization_status", "completed")
      .order("completed_at", { ascending: false })
      .order("created_at", { ascending: false })
      .range(offset, offset + batchSize - 1);

    if (error) throw new Error(error.message);

    const page = (data ?? []) as Record<string, unknown>[];
    if (page.length === 0) break;

    rows.push(...page);
    if (page.length < batchSize) break;
    offset += batchSize;
  }

  return rows.map(mapHistoryItem);
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
