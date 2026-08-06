import type { ParsedNormalizationImportRow } from "@/lib/normalization-import-parser";

export type ExistingNormalizationDesignations = {
  legacyCode: string;
  normalizationStatus: string;
  sourceDesignationPt: string | null;
  sourceDesignationEs: string | null;
  sourceDesignationEn: string | null;
  finalDesignationPt: string | null;
  finalDesignationEs: string | null;
  finalDesignationEn: string | null;
};

function isBlank(value: string | null | undefined) {
  return value == null || String(value).trim() === "";
}

export function buildMissingDesignationPatch(
  existing: ExistingNormalizationDesignations,
  row: ParsedNormalizationImportRow,
): Record<string, string> {
  const patch: Record<string, string> = {};
  const isCompleted = existing.normalizationStatus === "completed" || row.normalizationStatus === "completed";

  if (row.sourceDesignationPt && isBlank(existing.sourceDesignationPt)) {
    patch.source_designation_pt = row.sourceDesignationPt;
  }
  if (row.sourceDesignationEs && isBlank(existing.sourceDesignationEs)) {
    patch.source_designation_es = row.sourceDesignationEs;
  }
  if (row.sourceDesignationEn && isBlank(existing.sourceDesignationEn)) {
    patch.source_designation_en = row.sourceDesignationEn;
  }

  if (isCompleted) {
    if (row.sourceDesignationPt && isBlank(existing.finalDesignationPt)) {
      patch.final_designation_pt = row.sourceDesignationPt;
    }
    if (row.sourceDesignationEs && isBlank(existing.finalDesignationEs)) {
      patch.final_designation_es = row.sourceDesignationEs;
    }
    if (row.sourceDesignationEn && isBlank(existing.finalDesignationEn)) {
      patch.final_designation_en = row.sourceDesignationEn;
    }
  }

  return patch;
}

export function splitImportRowsByExistingLegacyCodes(
  rows: ParsedNormalizationImportRow[],
  existingLegacyCodes: Set<string>,
) {
  const rowsToInsert: ParsedNormalizationImportRow[] = [];
  const rowsToSync: ParsedNormalizationImportRow[] = [];

  for (const row of rows) {
    if (!row.legacyCode) continue;
    if (existingLegacyCodes.has(row.legacyCode)) {
      rowsToSync.push(row);
    } else {
      rowsToInsert.push(row);
    }
  }

  return { rowsToInsert, rowsToSync };
}

export function mapExistingDesignationRow(row: Record<string, unknown>): ExistingNormalizationDesignations {
  return {
    legacyCode: String(row.legacy_code ?? ""),
    normalizationStatus: String(row.normalization_status ?? "pending"),
    sourceDesignationPt: row.source_designation_pt ? String(row.source_designation_pt) : null,
    sourceDesignationEs: row.source_designation_es ? String(row.source_designation_es) : null,
    sourceDesignationEn: row.source_designation_en ? String(row.source_designation_en) : null,
    finalDesignationPt: row.final_designation_pt ? String(row.final_designation_pt) : null,
    finalDesignationEs: row.final_designation_es ? String(row.final_designation_es) : null,
    finalDesignationEn: row.final_designation_en ? String(row.final_designation_en) : null,
  };
}
