import { describe, expect, it } from "vitest";
import type { ParsedNormalizationImportRow } from "@/lib/normalization-import-parser";
import {
  formatImportSkipReason,
  mapNormalizationInsertError,
  partitionImportRowsForLoad,
} from "@/lib/normalization-import-load";

const baseRow = (
  legacyCode: string | null,
  overrides: Partial<ParsedNormalizationImportRow> = {},
): ParsedNormalizationImportRow => ({
  sourceRowNumber: 2,
  legacyCode,
  legacyDesignation: null,
  sourceNewCode: null,
  sourceDesignationPt: null,
  sourceDesignationEs: null,
  sourceDesignationEn: null,
  sourceStatus: null,
  sourceObservations: null,
  normalizationStatus: legacyCode ? "pending" : "cancelled",
  importIssue: legacyCode ? null : "MISSING_LEGACY_CODE",
  ...overrides,
});

describe("normalization import load", () => {
  it("formatImportSkipReason traduz codigos conhecidos", () => {
    expect(formatImportSkipReason("MISSING_LEGACY_CODE")).toBe("Falta referencia antiga");
    expect(formatImportSkipReason(null, "Motivo custom")).toBe("Motivo custom");
  });

  it("mapNormalizationInsertError traduz duplicados de referencia", () => {
    expect(mapNormalizationInsertError("sku_reference_duplicate")).toBe(
      "Referencia nova ja existe no historico de codigos",
    );
    expect(mapNormalizationInsertError("", null, "23505", { isOk2: true })).toBe(
      "Referencia OK2 ja existe no historico (import anterior ou normalizacao concluida)",
    );
    expect(mapNormalizationInsertError("duplicate key value violates unique constraint")).toBe(
      "duplicate key value violates unique constraint",
    );
  });

  it("partitionImportRowsForLoad permite duplicados pendentes e avisa OK2 duplicados", () => {
    const rows = [
      baseRow("LEG-A"),
      baseRow(null, { sourceRowNumber: 3, normalizationStatus: "cancelled", importIssue: "MISSING_LEGACY_CODE" }),
      baseRow("LEG-B", {
        sourceRowNumber: 4,
        normalizationStatus: "completed",
        sourceNewCode: "NEW-001",
        sourceStatus: "OK2",
      }),
      baseRow("LEG-C", {
        sourceRowNumber: 5,
        normalizationStatus: "completed",
        sourceNewCode: "NEW-001",
        sourceStatus: "OK2",
      }),
      baseRow("LEG-D", {
        sourceRowNumber: 6,
        normalizationStatus: "completed",
        sourceNewCode: "TAKEN-001",
        sourceStatus: "OK2",
      }),
      baseRow("LEG-A", { sourceRowNumber: 7 }),
    ];

    const { rowsToLoad, skippedRows, ok2DuplicateReviewRows } = partitionImportRowsForLoad(
      rows,
      new Set(["TAKEN001"]),
    );

    expect(rowsToLoad.map((row) => row.sourceRowNumber)).toEqual([2, 4, 7]);
    expect(skippedRows).toEqual([
      { sourceRowNumber: 3, legacyCode: null, reason: "Falta referencia antiga" },
      { sourceRowNumber: 6, legacyCode: "LEG-D", reason: "Referencia OK2 ja existe no historico de normalizados" },
    ]);
    expect(ok2DuplicateReviewRows).toEqual([
      {
        sourceRowNumber: 4,
        legacyCode: "LEG-B",
        sourceNewCode: "NEW-001",
        reason: "Referencia nova OK2 duplicada no Excel - rever manualmente antes de usar",
      },
      {
        sourceRowNumber: 5,
        legacyCode: "LEG-C",
        sourceNewCode: "NEW-001",
        reason: "Referencia nova OK2 duplicada no Excel - rever manualmente antes de usar",
      },
    ]);
  });
});
