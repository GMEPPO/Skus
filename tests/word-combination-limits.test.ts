import { describe, expect, it } from "vitest";
import {
  analyzeWordCombinationLimits,
  buildSkuCompactReference,
  injectWordIntoCatalog,
  MAX_SKU_REFERENCE_COMPACT_LENGTH,
} from "@/lib/word-combination-limits";
import { buildDesignationByLocale, MAX_DESIGNATION_LENGTH } from "@/lib/sku";
import type { GeneratorCatalog } from "@/lib/types";

function buildWord(
  id: string,
  label: string,
  referenceCode: string,
  designation: string,
  includeInDesignation = true,
) {
  return {
    id,
    label,
    referenceCode,
    designation,
    designationPt: designation,
    designationEs: designation,
    designationEn: designation,
    includeInDesignation,
  };
}

function buildTestCatalog(): GeneratorCatalog {
  return {
    levels: [
      {
        id: "level-brand",
        order: 1,
        fieldType: "brand",
        fieldTypeId: null,
        label: "Marca",
        options: [buildWord("brand-a", "Marca A", "AAA", "Marca A")],
      },
      {
        id: "level-product",
        order: 2,
        fieldType: "product",
        fieldTypeId: null,
        label: "Produto",
        options: [
          buildWord(
            "product-long",
            "Produto Longo",
            "PRD",
            "Sabonete liquido premium extra suave com aroma intenso de lavanda natural",
          ),
        ],
      },
      {
        id: "level-extra",
        order: 3,
        fieldType: "extra",
        fieldTypeId: null,
        label: "Extra",
        options: [buildWord("extra-a", "Extra A", "EXT", "Extra A")],
      },
    ],
  };
}

describe("word combination limits", () => {
  it("buildSkuCompactReference junta segmentos sem hifen", () => {
    const catalog = buildTestCatalog();
    const selections = {
      "level-brand": "brand-a",
      "level-product": "product-long",
      "level-extra": "__empty__:level-extra",
    };

    expect(buildSkuCompactReference(catalog, selections)).toBe("AAAPRD000");
  });

  it("detecta designacao combinada acima de 60 caracteres", () => {
    const catalog = buildTestCatalog();
    const result = analyzeWordCombinationLimits(catalog, "level-product", "product-long");

    expect(result.violations.length).toBeGreaterThan(0);
    expect(result.violations[0].exceededDesignationLocales).toContain("pt");
    expect(result.violations[0].designationPtLength).toBeGreaterThan(MAX_DESIGNATION_LENGTH);
  });

  it("detecta referencia compacta acima de 18 caracteres", () => {
    const longRefCatalog: GeneratorCatalog = {
      levels: Array.from({ length: 7 }, (_, index) => ({
        id: `level-${index}`,
        order: index + 1,
        fieldType: `level-${index}`,
        fieldTypeId: null,
        label: `Nivel ${index + 1}`,
        options: [buildWord(`word-${index}`, `Palavra ${index}`, "ABC", "Palavra")],
      })),
    };

    const result = analyzeWordCombinationLimits(longRefCatalog, "level-0", "word-0");
    expect(result.violations.length).toBeGreaterThan(0);
    expect(result.violations[0].referenceExceeded).toBe(true);
    expect(result.violations[0].referenceCompactLength).toBeGreaterThan(MAX_SKU_REFERENCE_COMPACT_LENGTH);
  });

  it("injectWordIntoCatalog permite analisar rascunho antes de criar", () => {
    const catalog = buildTestCatalog();
    const draft = {
      id: "__draft_word__",
      label: "Novo Produto",
      referenceCode: "NEW",
      designationPt: "Designacao muito longa que sozinha ja excede o limite PHC de sessenta caracteres",
      designationEs: "Designacion muy larga que sola ya excede el limite PHC de sesenta caracteres",
      designationEn: "Very long designation that alone already exceeds the PHC limit of sixty characters",
      includeInDesignation: true,
      parentWordIds: [],
      parentMatchMode: "any" as const,
      selectionHierarchy: null,
    };

    const withDraft = injectWordIntoCatalog(catalog, "level-product", draft);
    const result = analyzeWordCombinationLimits(withDraft, "level-product", draft.id);

    expect(result.violations.length).toBeGreaterThan(0);
    expect(buildDesignationByLocale(withDraft, { "level-brand": "brand-a", "level-product": draft.id }, "pt").length).toBeGreaterThan(
      MAX_DESIGNATION_LENGTH,
    );
  });
});
