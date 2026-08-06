import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import { parseNormalizationWorkbook, sha256Buffer, summarizeImportRows } from "@/lib/normalization-import-parser";

function buildWorkbookBuffer(rows: Record<string, string>[]) {
  const sheet = XLSX.utils.json_to_sheet(rows);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Sheet1");
  return Buffer.from(XLSX.write(book, { type: "buffer", bookType: "xlsx" }));
}

describe("normalization import parser", () => {
  it("mapeia colunas PT e marca pending quando hay legacy", () => {
    const buffer = buildWorkbookBuffer([
      {
        Referencia_antiga: "LEG-001",
        Designacao_antiga: "Sabonete antigo",
        Referencia_nova: "NEW-001",
        Designacao_PT: "Sabonete PT",
        Estado: "ativo",
      },
    ]);

    const parsed = parseNormalizationWorkbook(buffer);
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0].legacyCode).toBe("LEG-001");
    expect(parsed.rows[0].normalizationStatus).toBe("pending");
    expect(parsed.rows[0].importIssue).toBeNull();
    expect(parsed.rows[0].sourceDesignationPt).toBe("Sabonete PT");
  });

  it("cancela filas sin Referencia_antiga", () => {
    const buffer = buildWorkbookBuffer([
      {
        Referencia_antiga: "",
        Designacao_antiga: "Sem codigo",
      },
    ]);

    const parsed = parseNormalizationWorkbook(buffer);
    expect(parsed.rows[0].normalizationStatus).toBe("cancelled");
    expect(parsed.rows[0].importIssue).toBe("MISSING_LEGACY_CODE");
  });

  it("resume totales pending e invalidas", () => {
    const rows = summarizeImportRows([
      {
        sourceRowNumber: 2,
        legacyCode: "A",
        legacyDesignation: null,
        sourceNewCode: null,
        sourceDesignationPt: null,
        sourceDesignationEs: null,
        sourceDesignationEn: null,
        sourceStatus: null,
        sourceObservations: null,
        normalizationStatus: "pending",
        importIssue: null,
      },
      {
        sourceRowNumber: 3,
        legacyCode: null,
        legacyDesignation: null,
        sourceNewCode: null,
        sourceDesignationPt: null,
        sourceDesignationEs: null,
        sourceDesignationEn: null,
        sourceStatus: null,
        sourceObservations: null,
        normalizationStatus: "cancelled",
        importIssue: "MISSING_LEGACY_CODE",
      },
    ]);

    expect(rows.totalRows).toBe(2);
    expect(rows.pendingRows).toBe(1);
    expect(rows.invalidRows).toBe(1);
  });

  it("sha256 es estable", () => {
    const buffer = Buffer.from("excel-test");
    expect(sha256Buffer(buffer)).toHaveLength(64);
    expect(sha256Buffer(buffer)).toBe(sha256Buffer(buffer));
  });
});
