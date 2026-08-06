"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import {
  NORMALIZATION_IMPORT_MAX_BYTES,
  parseNormalizationWorkbook,
  sha256Buffer,
  summarizeImportRows,
} from "@/lib/normalization-import-parser";
import {
  buildMissingDesignationPatch,
  mapExistingDesignationRow,
  splitImportRowsByExistingLegacyCodes,
} from "@/lib/normalization-import-sync";
import { runNormalizationImportMaintenance } from "@/lib/normalization-data";
import { createSupabaseServiceServerClient } from "@/lib/supabase-service-server";

export type ImportNormalizationBatchResult =
  | {
      ok: true;
      message: string;
      batchId: string;
      fileName: string;
      totalRows: number;
      pendingRows: number;
      invalidRows: number;
    }
  | { ok: false; message: string; code?: string };

const ALLOWED_EXTENSIONS = [".xlsx", ".xls"];
const EXISTING_LOOKUP_CHUNK = 200;

function isAllowedExcelName(fileName: string) {
  const lower = fileName.toLowerCase();
  return ALLOWED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

async function fetchExistingByLegacyCodes(
  supabase: NonNullable<ReturnType<typeof createSupabaseServiceServerClient>>,
  legacyCodes: string[],
) {
  const existingByLegacyCode = new Map<string, ReturnType<typeof mapExistingDesignationRow>>();

  for (let offset = 0; offset < legacyCodes.length; offset += EXISTING_LOOKUP_CHUNK) {
    const chunk = legacyCodes.slice(offset, offset + EXISTING_LOOKUP_CHUNK);
    const { data, error } = await supabase
      .from("skus_code_normalizations")
      .select(
        "legacy_code, normalization_status, source_designation_pt, source_designation_es, source_designation_en, final_designation_pt, final_designation_es, final_designation_en",
      )
      .in("legacy_code", chunk);

    if (error) throw new Error(error.message);

    for (const row of data ?? []) {
      const mapped = mapExistingDesignationRow(row as Record<string, unknown>);
      if (!mapped.legacyCode) continue;
      existingByLegacyCode.set(mapped.legacyCode, mapped);
    }
  }

  return existingByLegacyCode;
}

async function syncMissingDesignationsFromImport(
  supabase: NonNullable<ReturnType<typeof createSupabaseServiceServerClient>>,
  parsed: ReturnType<typeof parseNormalizationWorkbook>,
) {
  const legacyCodes = [...new Set(parsed.rows.map((row) => row.legacyCode).filter(Boolean) as string[])];
  if (legacyCodes.length === 0) {
    return { updatedRows: 0, skippedRows: 0 };
  }

  const existingByLegacyCode = await fetchExistingByLegacyCodes(supabase, legacyCodes);
  let updatedRows = 0;
  let skippedRows = 0;

  for (const row of parsed.rows) {
    if (!row.legacyCode) continue;
    const existing = existingByLegacyCode.get(row.legacyCode);
    if (!existing) continue;

    const patch = buildMissingDesignationPatch(existing, row);
    if (Object.keys(patch).length === 0) {
      skippedRows += 1;
      continue;
    }

    const { error, count } = await supabase
      .from("skus_code_normalizations")
      .update(patch, { count: "exact" })
      .eq("legacy_code", row.legacyCode);

    if (error) throw new Error(error.message);
    updatedRows += count ?? 0;
  }

  return { updatedRows, skippedRows };
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

  const existingBatch = await supabase
    .from("skus_normalization_import_batches")
    .select("id, file_name")
    .eq("file_sha256", fileSha256)
    .maybeSingle();

  if (existingBatch.error) {
    return { ok: false, code: "db_error", message: "Nao foi possivel validar duplicados do import." };
  }

  if (existingBatch.data) {
    const updateDesignations = formData.get("updateDesignations") === "true";
    if (!updateDesignations) {
      return {
        ok: false,
        code: "duplicate_file",
        message: `Este ficheiro ja foi importado (${existingBatch.data.file_name}). Marca "Atualizar designacoes" para preencher PT/ES/EN em falta sem duplicar referencias.`,
      };
    }

    try {
      const { updatedRows, skippedRows } = await syncMissingDesignationsFromImport(supabase, parsed);
      await runNormalizationImportMaintenance();
      revalidatePath("/generator");

      return {
        ok: true,
        message: `Designacoes sincronizadas: ${updatedRows} registo(s) actualizado(s), ${skippedRows} ja completos. Nenhuma referencia duplicada.`,
        batchId: existingBatch.data.id,
        fileName: existingBatch.data.file_name,
        totalRows: parsed.rows.length,
        pendingRows: 0,
        invalidRows: 0,
      };
    } catch {
      return {
        ok: false,
        code: "update_failed",
        message: "Nao foi possivel atualizar as designacoes do ficheiro importado.",
      };
    }
  }

  const categoryIdRaw = formData.get("categoryId");
  const categoryId = typeof categoryIdRaw === "string" && categoryIdRaw.length > 0 ? categoryIdRaw : null;

  const legacyCodes = [...new Set(parsed.rows.map((row) => row.legacyCode).filter(Boolean) as string[])];
  const existingByLegacyCode = await fetchExistingByLegacyCodes(supabase, legacyCodes);
  const { rowsToInsert, rowsToSync } = splitImportRowsByExistingLegacyCodes(
    parsed.rows,
    new Set(existingByLegacyCode.keys()),
  );

  let syncedExistingRows = 0;
  let skippedExistingRows = 0;

  if (rowsToSync.length > 0) {
    try {
      const syncResult = await syncMissingDesignationsFromImport(supabase, { ...parsed, rows: rowsToSync });
      syncedExistingRows = syncResult.updatedRows;
      skippedExistingRows = syncResult.skippedRows;
    } catch {
      return {
        ok: false,
        code: "sync_failed",
        message: "Nao foi possivel sincronizar designacoes de referencias ja existentes.",
      };
    }
  }

  if (rowsToInsert.length === 0) {
    await runNormalizationImportMaintenance();
    revalidatePath("/generator");

    return {
      ok: true,
      message: `Nenhuma referencia nova. ${syncedExistingRows} registo(s) actualizado(s), ${skippedExistingRows} ja completos. Nenhuma duplicacao criada.`,
      batchId: existingBatch.data?.id ?? "",
      fileName: file.name,
      totalRows: parsed.rows.length,
      pendingRows: 0,
      invalidRows: parsed.rows.filter((row) => row.normalizationStatus === "cancelled").length,
    };
  }

  const summary = summarizeImportRows(rowsToInsert);

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
    return { ok: false, code: "batch_insert_failed", message: "Nao foi possivel criar o batch de importacao." };
  }

  const normalizationRows = rowsToInsert.map((row) => buildInsertRow(batch.id, row, categoryId));

  const chunkSize = 100;
  for (let offset = 0; offset < normalizationRows.length; offset += chunkSize) {
    const chunk = normalizationRows.slice(offset, offset + chunkSize);
    const { error: rowsError } = await supabase.from("skus_code_normalizations").insert(chunk);
    if (rowsError) {
      await supabase.from("skus_code_normalizations").delete().eq("import_batch_id", batch.id);
      await supabase.from("skus_normalization_import_batches").delete().eq("id", batch.id);
      return { ok: false, code: "rows_insert_failed", message: "Falha ao gravar linhas do Excel." };
    }
  }

  await runNormalizationImportMaintenance();

  revalidatePath("/generator");

  const syncSuffix =
    rowsToSync.length > 0
      ? ` ${syncedExistingRows} existente(s) actualizado(s), ${skippedExistingRows} ignorado(s) (sem duplicar).`
      : "";

  return {
    ok: true,
    message: `Import concluido: ${summary.pendingRows} novos pendentes, ${summary.completedRows} novos OK2, ${summary.invalidRows} invalidas.${syncSuffix}`,
    batchId: batch.id,
    fileName: file.name,
    totalRows: parsed.rows.length,
    pendingRows: summary.pendingRows,
    invalidRows: summary.invalidRows,
  };
}
