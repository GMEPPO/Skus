import { describe, expect, it } from "vitest";
import {
  buildMissingDesignationPatch,
  splitImportRowsByExistingLegacyCodes,
} from "@/lib/normalization-import-sync";
import type { ParsedNormalizationImportRow } from "@/lib/normalization-import-parser";

const baseRow = (legacyCode: string, overrides: Partial<ParsedNormalizationImportRow> = {}): ParsedNormalizationImportRow => ({
  sourceRowNumber: 2,
  legacyCode,
  legacyDesignation: null,
  sourceNewCode: null,
  sourceDesignationPt: null,
  sourceDesignationEs: null,
  sourceDesignationEn: null,
  sourceStatus: "OK2",
  sourceObservations: null,
  normalizationStatus: "completed",
  importIssue: null,
  ...overrides,
});

describe("normalization import sync", () => {
  it("splitImportRowsByExistingLegacyCodes separa novos e existentes", () => {
    const rows = [baseRow("A"), baseRow("B"), baseRow("C")];
    const result = splitImportRowsByExistingLegacyCodes(rows, new Set(["A", "C"]));

    expect(result.rowsToInsert.map((row) => row.legacyCode)).toEqual(["B"]);
    expect(result.rowsToSync.map((row) => row.legacyCode)).toEqual(["A", "C"]);
  });

  it("buildMissingDesignationPatch so preenche idiomas em falta", () => {
    const patch = buildMissingDesignationPatch(
      {
        legacyCode: "LEG-1",
        normalizationStatus: "completed",
        sourceDesignationPt: null,
        sourceDesignationEs: "Ya ES",
        sourceDesignationEn: null,
        finalDesignationPt: null,
        finalDesignationEs: null,
        finalDesignationEn: null,
      },
      baseRow("LEG-1", {
        sourceDesignationPt: "Novo PT",
        sourceDesignationEs: "Novo ES",
        sourceDesignationEn: "Novo EN",
      }),
    );

    expect(patch).toEqual({
      source_designation_pt: "Novo PT",
      source_designation_en: "Novo EN",
      final_designation_pt: "Novo PT",
      final_designation_es: "Novo ES",
      final_designation_en: "Novo EN",
    });
  });

  it("buildMissingDesignationPatch nao sobrescreve designacoes existentes", () => {
    const patch = buildMissingDesignationPatch(
      {
        legacyCode: "LEG-1",
        normalizationStatus: "completed",
        sourceDesignationPt: "PT antigo",
        sourceDesignationEs: "ES antigo",
        sourceDesignationEn: "EN antigo",
        finalDesignationPt: "PT final",
        finalDesignationEs: "ES final",
        finalDesignationEn: "EN final",
      },
      baseRow("LEG-1", {
        sourceDesignationPt: "PT Excel",
        sourceDesignationEs: "ES Excel",
        sourceDesignationEn: "EN Excel",
      }),
    );

    expect(patch).toEqual({});
  });
});
