import { describe, expect, it } from "vitest";
import {
  getVisibleOptionsForLevel,
  isWordVisibleByDependencies,
  pruneInvalidDownstreamSelections,
} from "@/lib/word-dependencies";
import type { GeneratorCatalog } from "@/lib/types";

const catalog: GeneratorCatalog = {
  levels: [
    {
      id: "format",
      order: 1,
      fieldType: "format",
      fieldTypeId: null,
      label: "Formato",
      options: [
        {
          id: "eco-a",
          label: "Garrafa Ecofill",
          referenceCode: "ECO",
          designation: "Garrafa Ecofill",
          designationPt: "Garrafa Ecofill",
          designationEs: "Garrafa Ecofill",
          designationEn: "Garrafa Ecofill",
          includeInDesignation: true,
        },
        {
          id: "eco-b",
          label: "Recarga Ecofill",
          referenceCode: "ECO",
          designation: "Recarga Ecofill",
          designationPt: "Recarga Ecofill",
          designationEs: "Recarga Ecofill",
          designationEn: "Recarga Ecofill",
          includeInDesignation: true,
        },
      ],
    },
    {
      id: "product",
      order: 2,
      fieldType: "product",
      fieldTypeId: null,
      label: "Produto",
      options: [
        {
          id: "sab",
          label: "Sabonete",
          referenceCode: "SAB",
          designation: "Sabonete",
          designationPt: "Sabonete",
          designationEs: "Jabon",
          designationEn: "Soap",
          includeInDesignation: true,
        },
      ],
    },
    {
      id: "packaging",
      order: 3,
      fieldType: "packaging",
      fieldTypeId: null,
      label: "Embalagem",
      options: [
        {
          id: "caixa",
          label: "Caixa",
          referenceCode: "CXA",
          designation: "Caixa",
          designationPt: "Caixa",
          designationEs: "Caja",
          designationEn: "Box",
          includeInDesignation: true,
          parentWordIds: ["sab"],
          parentMatchMode: "any",
          selectionHierarchy: 1,
        },
        {
          id: "alu",
          label: "Aluminio",
          referenceCode: "ALU",
          designation: "Aluminio",
          designationPt: "Aluminio",
          designationEs: "Aluminio",
          designationEn: "Aluminio",
          includeInDesignation: true,
          parentWordIds: ["eco-a", "eco-b"],
          parentMatchMode: "any",
          selectionHierarchy: 1,
        },
        {
          id: "alg-pack",
          label: "ALGODAO",
          referenceCode: "ALG",
          designation: "ALGODAO",
          designationPt: "ALGODAO",
          designationEs: "ALGODON",
          designationEn: "COTTON",
          includeInDesignation: true,
          selectionHierarchy: 2,
        },
      ],
    },
    {
      id: "extra",
      order: 4,
      fieldType: "extra",
      fieldTypeId: null,
      label: "Outros",
      options: [
        {
          id: "alg",
          label: "ALGODAO",
          referenceCode: "ALG",
          designation: "ALGODAO",
          designationPt: "ALGODAO",
          designationEs: "ALGODON",
          designationEn: "COTTON",
          includeInDesignation: true,
          selectionHierarchy: 2,
        },
        {
          id: "lim",
          label: "LIMAO",
          referenceCode: "LIM",
          designation: "LIMAO",
          designationPt: "LIMAO",
          designationEs: "LIMON",
          designationEn: "LEMON",
          includeInDesignation: true,
          selectionHierarchy: 2,
        },
      ],
    },
  ],
};

describe("word dependencies", () => {
  it("hides child words until a parent is selected (OR)", () => {
    expect(isWordVisibleByDependencies(catalog.levels[2].options[0], {}, catalog)).toBe(false);
    expect(
      isWordVisibleByDependencies(catalog.levels[2].options[0], { product: "sab" }, catalog),
    ).toBe(true);
  });

  it("shows Ecofill packaging when any Ecofill format is selected", () => {
    const visibleWithGarrafa = getVisibleOptionsForLevel(catalog, "packaging", { format: "eco-a" });
    expect(visibleWithGarrafa.some((word) => word.id === "alu")).toBe(true);

    const visibleWithRecarga = getVisibleOptionsForLevel(catalog, "packaging", { format: "eco-b" });
    expect(visibleWithRecarga.some((word) => word.id === "alu")).toBe(true);
  });

  it("shows hierarchy-2 words at packaging", () => {
    const visible = getVisibleOptionsForLevel(catalog, "packaging", { product: "sab" });
    expect(visible.some((word) => word.id === "alg-pack")).toBe(true);
  });

  it("shows all hierarchy-2 extra words when hierarchy-1 packaging is selected", () => {
    const visible = getVisibleOptionsForLevel(catalog, "extra", { product: "sab" });
    expect(visible.some((word) => word.id === "alg")).toBe(true);
    expect(visible.some((word) => word.id === "lim")).toBe(true);

    const withHierarchyOnePackaging = getVisibleOptionsForLevel(catalog, "extra", {
      product: "sab",
      packaging: "caixa",
    });
    expect(withHierarchyOnePackaging.some((word) => word.id === "alg")).toBe(true);
    expect(withHierarchyOnePackaging.some((word) => word.id === "lim")).toBe(true);
  });

  it("hides all hierarchy-2 extra words when hierarchy-2 packaging is selected", () => {
    const withAlgAtPackaging = getVisibleOptionsForLevel(catalog, "extra", {
      product: "sab",
      packaging: "alg-pack",
    });
    expect(withAlgAtPackaging.some((word) => word.id === "alg")).toBe(false);
    expect(withAlgAtPackaging.some((word) => word.id === "lim")).toBe(false);
  });

  it("clears invalid downstream selections when upstream changes", () => {
    const stillValid = pruneInvalidDownstreamSelections(
      catalog,
      { format: "eco-a", packaging: "alu", product: "sab" },
      "product",
    );
    expect(stillValid.packaging).toBe("alu");

    const cleared = pruneInvalidDownstreamSelections(catalog, { packaging: "caixa" }, "product");
    expect(cleared.packaging).toBeUndefined();
  });
});
