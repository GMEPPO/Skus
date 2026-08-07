import { describe, expect, it } from "vitest";
import type { ParsedNormalizationImportRow } from "@/lib/normalization-import-parser";
import {
  formatImportSkipReason,
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

  it("partitionImportRowsForLoad separa invalidas e duplicadas", () => {
    const rows = [
      baseRow("LEG-A"),
      baseRow(null, { sourceRowNumber: 3, normalizationStatus: "cancelled", importIssue: "MISSING_LEGACY_CODE" }),
      baseRow("LEG-B", { sourceRowNumber: 4, normalizationStatus: "completed", sourceNewCode: "NEW-001", sourceStatus: "OK2" }),
      baseRow("LEG-C", { sourceRowNumber: 5, normalizationStatus: "completed", sourceNewCode: "NEW-001", sourceStatus: "OK2" }),
      baseRow("LEG-D", { sourceRowNumber: 6, normalizationStatus: "completed", sourceNewCode: "TAKEN-001", sourceStatus: "OK2" }),
      baseRow("LEG-A", { sourceRowNumber: 7 }),
    ];

    const { rowsToLoad, skippedRows } = partitionImportRowsForLoad(rows, new Set(["TAKEN001"]));

    expect(rowsToLoad.map((row) => row.legacyCode)).toEqual(["LEG-A", "LEG-B"]);
    expect(skippedRows).toEqual([
      { sourceRowNumber: 3, legacyCode: null, reason: "Falta referencia antiga" },
      { sourceRowNumber: 5, legacyCode: "LEG-C", reason: "Referencia nova duplicada neste Excel" },
      { sourceRowNumber: 6, legacyCode: "LEG-D", reason: "Referencia nova ja existe no historico de codigos" },
      { sourceRowNumber: 7, legacyCode: "LEG-A", reason: "Referencia antiga duplicada neste Excel" },
    ]);
  });
});
