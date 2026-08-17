import { describe, expect, it } from "vitest";
import {
  mapCategoryCatalogToGeneratorCatalog,
  mirrorHierarchyTwoWordsOnPackagingAndExtra,
} from "@/lib/generator-catalog-mapper";
import { getVisibleOptionsForLevel } from "@/lib/word-dependencies";
import type { GeneratorLevel } from "@/lib/types";

function buildWord(
  id: string,
  label: string,
  referenceCode: string,
  selectionHierarchy: number | null = null,
) {
  return {
    id,
    label,
    referenceCode,
    designation: label,
    designationPt: label,
    designationEs: label,
    designationEn: label,
    includeInDesignation: true,
    parentWordIds: [],
    parentMatchMode: "any" as const,
    selectionHierarchy,
  };
}

describe("generator catalog mapper hierarchy mirroring", () => {
  it("mirrors hierarchy-2 words onto packaging and extra", () => {
    const levels: GeneratorLevel[] = [
      {
        id: "packaging",
        order: 5,
        fieldType: "packaging",
        fieldTypeId: null,
        label: "Embalagem",
        options: [buildWord("caixa", "Caixa", "CXA", 1)],
      },
      {
        id: "extra",
        order: 6,
        fieldType: "extra",
        fieldTypeId: null,
        label: "Outros",
        options: [
          buildWord("v01", "V01", "V01", null),
          buildWord("alg", "ALGODAO", "ALG", 2),
        ],
      },
    ];

    const next = mirrorHierarchyTwoWordsOnPackagingAndExtra(levels);
    const packaging = next.find((level) => level.fieldType === "packaging");
    const extra = next.find((level) => level.fieldType === "extra");

    expect(packaging?.options.map((word) => word.id)).toEqual(["caixa", "alg"]);
    expect(extra?.options.map((word) => word.id)).toEqual(["v01", "alg"]);
  });

  it("shows hierarchy-2 at packaging and extra fallback when not selected at packaging", () => {
    const catalog = mapCategoryCatalogToGeneratorCatalog({
      category: {
        id: "cat-1",
        slug: "cosmetica",
        name: "Cosmetica",
        sortOrder: 1,
        isActive: true,
      },
      parentEdges: [],
      levels: [
        {
          id: "packaging",
          categoryId: "cat-1",
          key: "packaging",
          label: "Embalagem",
          sortOrder: 5,
          isEnabled: true,
          isRequired: true,
          participatesInCode: true,
          legacyFieldTypeId: null,
          options: [
            {
              ...buildWord("caixa", "Caixa", "CXA", 1),
              categoryLevelId: "packaging",
              defaultFieldTypeId: null,
              isActive: true,
            },
          ],
        },
        {
          id: "extra",
          categoryId: "cat-1",
          key: "extra",
          label: "Outros",
          sortOrder: 6,
          isEnabled: true,
          isRequired: false,
          participatesInCode: true,
          legacyFieldTypeId: null,
          options: [
            {
              ...buildWord("alg", "ALGODAO", "ALG", 2),
              categoryLevelId: "extra",
              defaultFieldTypeId: null,
              isActive: true,
            },
          ],
        },
      ],
    });

    expect(getVisibleOptionsForLevel(catalog, "packaging", {}).some((word) => word.id === "alg")).toBe(true);
    expect(getVisibleOptionsForLevel(catalog, "extra", {}).some((word) => word.id === "alg")).toBe(true);
    expect(
      getVisibleOptionsForLevel(catalog, "extra", { packaging: "caixa" }).some((word) => word.id === "alg"),
    ).toBe(true);
    const withAlgAtPackaging = getVisibleOptionsForLevel(catalog, "extra", { packaging: "alg" });
    expect(withAlgAtPackaging.some((word) => word.id === "alg")).toBe(false);
  });
});
