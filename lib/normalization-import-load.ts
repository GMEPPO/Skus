import type { ParsedNormalizationImportRow } from "@/lib/normalization-import-parser";
import type { createSupabaseServiceServerClient } from "@/lib/supabase-service-server";
import { normalizeSkuReference } from "@/lib/sku-reference-uniqueness";

type ServiceSupabase = NonNullable<ReturnType<typeof createSupabaseServiceServerClient>>;

export type SkippedImportRow = {
  sourceRowNumber: number;
  legacyCode: string | null;
  reason: string;
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

export function partitionImportRowsForLoad(
  rows: ParsedNormalizationImportRow[],
  takenReferences: Set<string>,
): { rowsToLoad: ParsedNormalizationImportRow[]; skippedRows: SkippedImportRow[] } {
  const seenLegacyCodes = new Set<string>();
  const seenNewReferences = new Set<string>();
  const rowsToLoad: ParsedNormalizationImportRow[] = [];
  const skippedRows: SkippedImportRow[] = [];

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

    if (seenLegacyCodes.has(legacyCode)) {
      skippedRows.push({
        sourceRowNumber: row.sourceRowNumber,
        legacyCode,
        reason: "Referencia antiga duplicada neste Excel",
      });
      continue;
    }
    seenLegacyCodes.add(legacyCode);

    if (row.normalizationStatus === "completed" && row.sourceNewCode) {
      const normalizedRef = normalizeSkuReference(row.sourceNewCode);
      if (normalizedRef) {
        if (seenNewReferences.has(normalizedRef)) {
          skippedRows.push({
            sourceRowNumber: row.sourceRowNumber,
            legacyCode,
            reason: "Referencia nova duplicada neste Excel",
          });
          continue;
        }
        if (takenReferences.has(normalizedRef)) {
          skippedRows.push({
            sourceRowNumber: row.sourceRowNumber,
            legacyCode,
            reason: "Referencia nova ja existe no historico de codigos",
          });
          continue;
        }
        seenNewReferences.add(normalizedRef);
      }
    }

    rowsToLoad.push(row);
  }

  return { rowsToLoad, skippedRows };
}

export async function clearPendingImportQueue(supabase: ServiceSupabase): Promise<void> {
  const { error: deleteError } = await supabase.from("skus_code_normalizations").delete().is("generation_id", null);
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
