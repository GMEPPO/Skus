import { createHash } from "node:crypto";
import type { ParsedNormalizationImportRow } from "@/lib/normalization-import-parser";
import { isOk2SourceStatus } from "@/lib/normalization-source-status";
import type { createSupabaseServiceServerClient } from "@/lib/supabase-service-server";
import { normalizeSkuReference } from "@/lib/sku-reference-uniqueness";

type ServiceSupabase = NonNullable<ReturnType<typeof createSupabaseServiceServerClient>>;

export type SkippedImportRow = {
  sourceRowNumber: number;
  legacyCode: string | null;
  reason: string;
};

export type Ok2DuplicateReviewRow = {
  sourceRowNumber: number;
  legacyCode: string | null;
  sourceNewCode: string | null;
  reason: string;
};

const OK2_DUPLICATE_REVIEW_REASON =
  "Referencia nova OK2 duplicada no Excel - rever manualmente antes de usar";

type NormalizationInsertPayload = Record<string, unknown>;

export type NormalizationInsertAttempt = {
  sourceRowNumber: number;
  legacyCode: string | null;
  isOk2: boolean;
  payload: NormalizationInsertPayload;
};

const IMPORT_ISSUE_MESSAGES: Record<string, string> = {
  MISSING_LEGACY_CODE: "Falta referencia antiga",
};

export function formatImportSkipReason(importIssue: string | null, customReason?: string): string {
  if (customReason) return customReason;
  if (importIssue && IMPORT_ISSUE_MESSAGES[importIssue]) return IMPORT_ISSUE_MESSAGES[importIssue];
  if (importIssue) return importIssue;
  return "Linha invalida";
}

export function mapNormalizationInsertError(
  message: string,
  details?: string | null,
  code?: string | null,
  options?: { isOk2?: boolean },
): string {
  const combined = `${message} ${details ?? ""} ${code ?? ""}`.toLowerCase();
  const isDuplicateReference =
    combined.includes("sku_reference_duplicate") ||
    combined.includes("skus_code_normalizations_completed_ref_uidx") ||
    code === "23505" ||
    code === "P0001";

  if (isDuplicateReference) {
    return options?.isOk2
      ? "Referencia OK2 ja existe no historico (import anterior ou normalizacao concluida)"
      : "Referencia nova ja existe no historico de codigos";
  }

  if (combined.includes("skus_normalization_import_batches_sha_unique")) {
    return "Ficheiro ja importado anteriormente";
  }

  if (combined.includes("foreign key") && combined.includes("category")) {
    return "Categoria selecionada invalida";
  }

  if (combined.includes("duplicate key") && combined.includes("source_row_number")) {
    return "Numero de linha duplicado no Excel";
  }

  return "Erro ao gravar linha na base de dados";
}

function collectDuplicateOk2ReferenceKeys(rows: ParsedNormalizationImportRow[]): Set<string> {
  const counts = new Map<string, number>();

  for (const row of rows) {
    if (row.normalizationStatus !== "completed" || !row.sourceNewCode) continue;
    const normalizedRef = normalizeSkuReference(row.sourceNewCode);
    if (!normalizedRef) continue;
    counts.set(normalizedRef, (counts.get(normalizedRef) ?? 0) + 1);
  }

  return new Set([...counts.entries()].filter(([, count]) => count > 1).map(([ref]) => ref));
}

export function partitionImportRowsForLoad(
  rows: ParsedNormalizationImportRow[],
  takenReferences: Set<string>,
): {
  rowsToLoad: ParsedNormalizationImportRow[];
  skippedRows: SkippedImportRow[];
  ok2DuplicateReviewRows: Ok2DuplicateReviewRow[];
} {
  const duplicateOk2References = collectDuplicateOk2ReferenceKeys(rows);
  const loadedOk2References = new Set<string>();
  const rowsToLoad: ParsedNormalizationImportRow[] = [];
  const skippedRows: SkippedImportRow[] = [];
  const ok2DuplicateReviewRows: Ok2DuplicateReviewRow[] = [];

  for (const row of rows) {
    if (row.normalizationStatus === "cancelled") {
      skippedRows.push({
        sourceRowNumber: row.sourceRowNumber,
        legacyCode: row.legacyCode,
        reason: formatImportSkipReason(row.importIssue),
      });
      continue;
    }

    const legacyCode = row.legacyCode;
    if (!legacyCode) {
      skippedRows.push({
        sourceRowNumber: row.sourceRowNumber,
        legacyCode: null,
        reason: formatImportSkipReason("MISSING_LEGACY_CODE"),
      });
      continue;
    }

    if (row.normalizationStatus === "completed" && row.sourceNewCode) {
      const normalizedRef = normalizeSkuReference(row.sourceNewCode);
      if (normalizedRef) {
        if (duplicateOk2References.has(normalizedRef)) {
          ok2DuplicateReviewRows.push({
            sourceRowNumber: row.sourceRowNumber,
            legacyCode,
            sourceNewCode: row.sourceNewCode,
            reason: OK2_DUPLICATE_REVIEW_REASON,
          });

          if (loadedOk2References.has(normalizedRef)) {
            continue;
          }
        } else         if (takenReferences.has(normalizedRef)) {
          skippedRows.push({
            sourceRowNumber: row.sourceRowNumber,
            legacyCode,
            reason: isOk2SourceStatus(row.sourceStatus)
              ? "Referencia OK2 ja existe no historico de normalizados"
              : "Referencia nova ja existe no historico de codigos",
          });
          continue;
        }

        if (loadedOk2References.has(normalizedRef)) {
          continue;
        }
        loadedOk2References.add(normalizedRef);
      }
    }

    rowsToLoad.push(row);
  }

  return { rowsToLoad, skippedRows, ok2DuplicateReviewRows };
}

export async function releaseBatchFileSha256(supabase: ServiceSupabase, fileSha256: string): Promise<void> {
  const { data, error } = await supabase
    .from("skus_normalization_import_batches")
    .select("id")
    .eq("file_sha256", fileSha256);

  if (error) throw new Error(error.message);

  for (const batch of data ?? []) {
    const batchId = String(batch.id);
    const replacementSha = createHash("sha256").update(`${fileSha256}:${batchId}`).digest("hex");
    const { error: updateError } = await supabase
      .from("skus_normalization_import_batches")
      .update({ file_sha256: replacementSha })
      .eq("id", batchId);

    if (updateError) throw new Error(updateError.message);
  }
}

export async function clearPendingImportQueue(
  supabase: ServiceSupabase,
  options?: { excludeBatchId?: string },
): Promise<void> {
  let deleteQuery = supabase.from("skus_code_normalizations").delete().is("generation_id", null);
  if (options?.excludeBatchId) {
    deleteQuery = deleteQuery.neq("import_batch_id", options.excludeBatchId);
  }

  const { error: deleteError } = await deleteQuery;
  if (deleteError) throw new Error(deleteError.message);

  const { data: usedBatchRows, error: usedError } = await supabase
    .from("skus_code_normalizations")
    .select("import_batch_id");
  if (usedError) throw new Error(usedError.message);

  const usedBatchIds = new Set((usedBatchRows ?? []).map((row) => String(row.import_batch_id)));

  const { data: allBatches, error: batchesError } = await supabase
    .from("skus_normalization_import_batches")
    .select("id");
  if (batchesError) throw new Error(batchesError.message);

  const orphanBatchIds = (allBatches ?? [])
    .map((batch) => String(batch.id))
    .filter((batchId) => !usedBatchIds.has(batchId));

  if (orphanBatchIds.length === 0) return;

  const chunkSize = 100;
  for (let offset = 0; offset < orphanBatchIds.length; offset += chunkSize) {
    const chunk = orphanBatchIds.slice(offset, offset + chunkSize);
    const { error: orphanDeleteError } = await supabase
      .from("skus_normalization_import_batches")
      .delete()
      .in("id", chunk);
    if (orphanDeleteError) throw new Error(orphanDeleteError.message);
  }
}

export async function insertNormalizationRowsResilient(
  supabase: ServiceSupabase,
  rows: NormalizationInsertAttempt[],
): Promise<{ insertedCount: number; skippedRows: SkippedImportRow[] }> {
  const skippedRows: SkippedImportRow[] = [];
  let insertedCount = 0;
  const chunkSize = 100;

  for (let offset = 0; offset < rows.length; offset += chunkSize) {
    const chunk = rows.slice(offset, offset + chunkSize);
    const payloads = chunk.map((row) => row.payload);
    const { error } = await supabase.from("skus_code_normalizations").insert(payloads);

    if (!error) {
      insertedCount += chunk.length;
      continue;
    }

    for (const row of chunk) {
      const { error: rowError } = await supabase.from("skus_code_normalizations").insert(row.payload);
      if (rowError) {
        skippedRows.push({
          sourceRowNumber: row.sourceRowNumber,
          legacyCode: row.legacyCode,
          reason: mapNormalizationInsertError(rowError.message, rowError.details, rowError.code, {
            isOk2: row.isOk2,
          }),
        });
        continue;
      }
      insertedCount += 1;
    }
  }

  return { insertedCount, skippedRows };
}
