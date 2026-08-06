"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import {
  NORMALIZATION_IMPORT_MAX_BYTES,
  parseNormalizationWorkbook,
  sha256Buffer,
  summarizeImportRows,
} from "@/lib/normalization-import-parser";
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

function isAllowedExcelName(fileName: string) {
  const lower = fileName.toLowerCase();
  return ALLOWED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

function buildDesignationFields(row: {
  sourceDesignationPt: string | null;
  sourceDesignationEs: string | null;
  sourceDesignationEn: string | null;
  normalizationStatus: "pending" | "completed" | "cancelled";
  sourceNewCode: string | null;
}) {
  const isCompleted = row.normalizationStatus === "completed";
  return {
    source_designation_pt: row.sourceDesignationPt,
    source_designation_es: row.sourceDesignationEs,
    source_designation_en: row.sourceDesignationEn,
    ...(isCompleted
      ? {
          final_designation_pt: row.sourceDesignationPt,
          final_designation_es: row.sourceDesignationEs,
          final_designation_en: row.sourceDesignationEn,
          final_new_code: row.sourceNewCode,
        }
      : {}),
  };
}

async function updateDesignationsFromDuplicateImport(
  supabase: NonNullable<ReturnType<typeof createSupabaseServiceServerClient>>,
  batchId: string,
  parsed: ReturnType<typeof parseNormalizationWorkbook>,
) {
  let updatedRows = 0;

  for (const row of parsed.rows) {
    if (!row.legacyCode) continue;
    const hasDesignation = Boolean(row.sourceDesignationPt || row.sourceDesignationEs || row.sourceDesignationEn);
    if (!hasDesignation) continue;

    const { error, count } = await supabase
      .from("skus_code_normalizations")
      .update(buildDesignationFields(row), { count: "exact" })
      .eq("import_batch_id", batchId)
      .eq("legacy_code", row.legacyCode);

    if (error) throw new Error(error.message);
    updatedRows += count ?? 0;
  }

  return updatedRows;
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

  const existing = await supabase
    .from("skus_normalization_import_batches")
    .select("id, file_name")
    .eq("file_sha256", fileSha256)
    .maybeSingle();

  if (existing.error) {
    return { ok: false, code: "db_error", message: "Nao foi possivel validar duplicados do import." };
  }

  if (existing.data) {
    const updateDesignations = formData.get("updateDesignations") === "true";
    if (!updateDesignations) {
      return {
        ok: false,
        code: "duplicate_file",
        message: `Este ficheiro ja foi importado (${existing.data.file_name}). Marca "Atualizar designacoes" para sincronizar PT/ES/EN.`,
      };
    }

    try {
      const updatedRows = await updateDesignationsFromDuplicateImport(supabase, existing.data.id, parsed);
      await runNormalizationImportMaintenance();
      revalidatePath("/generator");

      return {
        ok: true,
        message: `Designacoes atualizadas em ${updatedRows} registo(s) do ficheiro ${existing.data.file_name}.`,
        batchId: existing.data.id,
        fileName: existing.data.file_name,
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

  const summary = summarizeImportRows(parsed.rows);

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

  const normalizationRows = parsed.rows.map((row) => ({
    import_batch_id: batch.id,
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
  }));

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

  return {
    ok: true,
    message: `Import concluido: ${summary.pendingRows} pendentes, ${summary.completedRows} ja normalizados (OK2), ${summary.invalidRows} invalidas.`,
    batchId: batch.id,
    fileName: file.name,
    totalRows: summary.totalRows,
    pendingRows: summary.pendingRows,
    invalidRows: summary.invalidRows,
  };
}
