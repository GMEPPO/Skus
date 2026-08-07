"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import {
  clearPendingImportQueue,
  insertNormalizationRowsResilient,
  partitionImportRowsForLoad,
  releaseBatchFileSha256,
  type Ok2DuplicateReviewRow,
  type SkippedImportRow,
} from "@/lib/normalization-import-load";
import {
  NORMALIZATION_IMPORT_MAX_BYTES,
  parseNormalizationWorkbook,
  sha256Buffer,
  summarizeImportRows,
} from "@/lib/normalization-import-parser";
import { runNormalizationImportMaintenance } from "@/lib/normalization-data";
import { findTakenSkuReferences } from "@/lib/sku-reference-uniqueness-data";
import { createSupabaseServiceServerClient } from "@/lib/supabase-service-server";

export type ImportNormalizationBatchResult =
  | {
      ok: true;
      message: string;
      batchId: string;
      fileName: string;
      totalRows: number;
      loadedRows: number;
      pendingRows: number;
      invalidRows: number;
      skippedRows: SkippedImportRow[];
      ok2DuplicateReviewRows: Ok2DuplicateReviewRow[];
    }
  | { ok: false; message: string; code?: string };

const ALLOWED_EXTENSIONS = [".xlsx", ".xls"];

function isAllowedExcelName(fileName: string) {
  const lower = fileName.toLowerCase();
  return ALLOWED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

function buildInsertRow(
  batchId: string,
  row: ReturnType<typeof parseNormalizationWorkbook>["rows"][number],
  categoryId: string | null,
) {
  return {
    import_batch_id: batchId,
    source_row_number: row.sourceRowNumber,
    legacy_code: row.legacyCode,
    legacy_designation: row.legacyDesignation,
    source_new_code: row.sourceNewCode,
    source_designation_pt: row.sourceDesignationPt,
    source_designation_es: row.sourceDesignationEs,
    source_designation_en: row.sourceDesignationEn,
    source_status: row.sourceStatus,
    source_observations: row.sourceObservations,
    normalization_status: row.normalizationStatus,
    import_issue: row.importIssue,
    category_id: categoryId,
    final_new_code: row.normalizationStatus === "completed" ? row.sourceNewCode : null,
    final_designation_pt: row.normalizationStatus === "completed" ? row.sourceDesignationPt : null,
    final_designation_es: row.normalizationStatus === "completed" ? row.sourceDesignationEs : null,
    final_designation_en: row.normalizationStatus === "completed" ? row.sourceDesignationEn : null,
    completed_at: row.normalizationStatus === "completed" ? new Date().toISOString() : null,
  };
}

function collectCompletedReferenceCodes(rows: ReturnType<typeof parseNormalizationWorkbook>["rows"]) {
  return rows
    .map((row) => (row.normalizationStatus === "completed" ? row.sourceNewCode : null))
    .filter((code): code is string => Boolean(code));
}

function buildSuccessMessage(
  loadedRows: number,
  skippedRows: SkippedImportRow[],
  ok2DuplicateReviewRows: Ok2DuplicateReviewRow[],
  summary: ReturnType<typeof summarizeImportRows>,
  replacedPrevious: boolean,
) {
  const skippedSuffix = skippedRows.length > 0 ? `, ${skippedRows.length} nao carregada(s)` : "";
  const reviewSuffix =
    ok2DuplicateReviewRows.length > 0 ? `, ${ok2DuplicateReviewRows.length} OK2 duplicado(s) para rever` : "";
  const replaceSuffix = replacedPrevious ? " A lista anterior foi substituida." : " A lista anterior foi mantida.";
  return `Import concluido: ${loadedRows} linha(s) carregada(s) (${summary.pendingRows} pendentes, ${summary.completedRows} OK2)${skippedSuffix}${reviewSuffix}.${replaceSuffix}`;
}

export async function importNormalizationBatchAction(formData: FormData): Promise<ImportNormalizationBatchResult> {
  const user = await requireRole("editor");

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { ok: false, code: "missing_file", message: "Seleciona um ficheiro Excel (.xlsx)." };
  }

  if (!isAllowedExcelName(file.name)) {
    return { ok: false, code: "invalid_file_type", message: "Formato invalido. Usa .xlsx ou .xls." };
  }

  if (file.size <= 0 || file.size > NORMALIZATION_IMPORT_MAX_BYTES) {
    return {
      ok: false,
      code: "file_too_large",
      message: `O ficheiro excede o limite de ${Math.floor(NORMALIZATION_IMPORT_MAX_BYTES / (1024 * 1024))} MB.`,
    };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const fileSha256 = sha256Buffer(buffer);
  const parsed = parseNormalizationWorkbook(buffer);

  if (parsed.rows.length === 0) {
    return {
      ok: false,
      code: "empty_workbook",
      message: "O Excel nao contem linhas validas na primeira folha.",
    };
  }

  const supabase = createSupabaseServiceServerClient();
  if (!supabase) {
    return { ok: false, code: "config_error", message: "Supabase service role nao configurado." };
  }

  const categoryIdRaw = formData.get("categoryId");
  const categoryId = typeof categoryIdRaw === "string" && categoryIdRaw.length > 0 ? categoryIdRaw : null;

  const referenceCodes = collectCompletedReferenceCodes(parsed.rows);
  let takenReferences: Set<string>;
  try {
    const takenList = await findTakenSkuReferences(supabase, referenceCodes);
    takenReferences = new Set(takenList);
  } catch {
    return {
      ok: false,
      code: "reference_check_failed",
      message: "Nao foi possivel validar referencias novas no historico.",
    };
  }

  const {
    rowsToLoad,
    skippedRows: preSkippedRows,
    ok2DuplicateReviewRows,
  } = partitionImportRowsForLoad(parsed.rows, takenReferences);

  if (rowsToLoad.length === 0) {
    return {
      ok: true,
      message: `Import concluido: nenhuma linha carregada, ${preSkippedRows.length} nao carregada(s). A lista anterior foi mantida.`,
      batchId: "",
      fileName: file.name,
      totalRows: parsed.rows.length,
      loadedRows: 0,
      pendingRows: 0,
      invalidRows: preSkippedRows.length,
      skippedRows: preSkippedRows,
      ok2DuplicateReviewRows,
    };
  }

  try {
    await releaseBatchFileSha256(supabase, fileSha256);
  } catch {
    return {
      ok: false,
      code: "batch_sha_release_failed",
      message: "Nao foi possivel preparar o batch de importacao.",
    };
  }

  const summary = summarizeImportRows(rowsToLoad);

  const { data: batch, error: batchError } = await supabase
    .from("skus_normalization_import_batches")
    .insert({
      file_name: file.name,
      file_sha256: fileSha256,
      status: "completed",
      total_rows: summary.totalRows,
      pending_rows: summary.pendingRows,
      completed_rows: summary.completedRows,
      invalid_rows: summary.invalidRows,
      imported_by: user.id,
      completed_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (batchError || !batch) {
    return {
      ok: false,
      code: "batch_insert_failed",
      message: batchError?.message
        ? `Nao foi possivel criar o batch de importacao: ${batchError.message}`
        : "Nao foi possivel criar o batch de importacao.",
    };
  }

  const insertAttempts = rowsToLoad.map((row) => ({
    sourceRowNumber: row.sourceRowNumber,
    legacyCode: row.legacyCode,
    payload: buildInsertRow(batch.id, row, categoryId),
  }));

  let insertedCount = 0;
  let insertSkippedRows: SkippedImportRow[] = [];

  try {
    const insertResult = await insertNormalizationRowsResilient(supabase, insertAttempts);
    insertedCount = insertResult.insertedCount;
    insertSkippedRows = insertResult.skippedRows;
  } catch {
    await supabase.from("skus_code_normalizations").delete().eq("import_batch_id", batch.id);
    await supabase.from("skus_normalization_import_batches").delete().eq("id", batch.id);
    return {
      ok: false,
      code: "rows_insert_failed",
      message: "Falha ao gravar linhas do Excel.",
    };
  }

  const allSkippedRows = [...preSkippedRows, ...insertSkippedRows];

  if (insertedCount === 0) {
    await supabase.from("skus_code_normalizations").delete().eq("import_batch_id", batch.id);
    await supabase.from("skus_normalization_import_batches").delete().eq("id", batch.id);

    return {
      ok: true,
      message: `Import concluido: nenhuma linha carregada, ${allSkippedRows.length} nao carregada(s). A lista anterior foi mantida.`,
      batchId: "",
      fileName: file.name,
      totalRows: parsed.rows.length,
      loadedRows: 0,
      pendingRows: 0,
      invalidRows: allSkippedRows.length,
      skippedRows: allSkippedRows,
      ok2DuplicateReviewRows,
    };
  }

  try {
    await clearPendingImportQueue(supabase, { excludeBatchId: batch.id });
  } catch {
    await supabase.from("skus_code_normalizations").delete().eq("import_batch_id", batch.id);
    await supabase.from("skus_normalization_import_batches").delete().eq("id", batch.id);
    return {
      ok: false,
      code: "clear_failed",
      message: "Linhas gravadas mas nao foi possivel substituir a lista anterior. Tenta novamente.",
    };
  }

  const loadedSummary = summarizeImportRows(
    rowsToLoad.filter(
      (row) =>
        !insertSkippedRows.some(
          (skipped) =>
            skipped.sourceRowNumber === row.sourceRowNumber && skipped.legacyCode === row.legacyCode,
        ),
    ),
  );

  await supabase
    .from("skus_normalization_import_batches")
    .update({
      total_rows: loadedSummary.totalRows,
      pending_rows: loadedSummary.pendingRows,
      completed_rows: loadedSummary.completedRows,
      invalid_rows: loadedSummary.invalidRows,
    })
    .eq("id", batch.id);

  await runNormalizationImportMaintenance();
  revalidatePath("/generator");

  return {
    ok: true,
    message: buildSuccessMessage(insertedCount, allSkippedRows, ok2DuplicateReviewRows, loadedSummary, true),
    batchId: batch.id,
    fileName: file.name,
    totalRows: parsed.rows.length,
    loadedRows: insertedCount,
    pendingRows: loadedSummary.pendingRows,
    invalidRows: allSkippedRows.length,
    skippedRows: allSkippedRows,
    ok2DuplicateReviewRows,
  };
}
