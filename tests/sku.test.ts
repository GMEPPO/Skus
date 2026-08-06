import { describe, expect, it } from "vitest";
import { buildDesignationByLocale, buildSkuPreview, filterGeneratorWords } from "@/lib/sku";
import type { GeneratorCatalog } from "@/lib/types";

const sabsolCatalog: GeneratorCatalog = {
  levels: [
    {
      id: "brand",
      order: 1,
      fieldType: "brand",
      label: "Familia/Marca",
      options: [
        {
          id: "alg",
          label: "ALG OCEAN SPA",
          referenceCode: "ALG",
          designation: "ALG OCEAN SPA",
          designationPt: "ALG OCEAN SPA",
          designationEs: "ALG Ocean Spa",
          designationEn: "ALG Ocean Spa",
          includeInDesignation: true,
        },
      ],
    },
    {
      id: "format",
      order: 2,
      fieldType: "format",
      label: "Formato",
      options: [
        {
          id: "sol",
          label: "Solido",
          referenceCode: "SOL",
          designation: "Solido",
          designationPt: "Solido",
          designationEs: "Solido",
          designationEn: "Solid",
          includeInDesignation: false,
        },
      ],
    },
    {
      id: "product",
      order: 3,
      fieldType: "product",
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
      id: "size",
      order: 4,
      fieldType: "size",
      label: "Tamanho",
      options: [
        {
          id: "020",
          label: "20g",
          referenceCode: "020",
          designation: "20g",
          designationPt: "20g",
          designationEs: "20g",
          designationEn: "20g",
          includeInDesignation: true,
        },
      ],
    },
    {
      id: "packaging",
      order: 5,
      fieldType: "packaging",
      label: "Embalagem",
      options: [
        {
          id: "cxa",
          label: "Caixa Cartao",
          referenceCode: "CXA",
          designation: "Caixa Cartao",
          designationPt: "Caixa Cartao",
          designationEs: "Caja Carton",
          designationEn: "Card Box",
          includeInDesignation: true,
        },
      ],
    },
    { id: "extra", order: 6, fieldType: "extra", label: "Extra", options: [] },
  ],
};

describe("sku builder", () => {
  it("builds the sku from the six global levels and fills empty extra with 000", () => {
    expect(
      buildSkuPreview(sabsolCatalog, {
        brand: "alg",
        format: "sol",
        product: "sab",
        size: "020",
        packaging: "cxa",
      }),
    ).toBe("ALG-SOL-SAB-020-CXA-000");
  });

  it("keeps hidden technical format out of generated designations", () => {
    expect(
      buildDesignationByLocale(
        sabsolCatalog,
        {
          brand: "alg",
          format: "sol",
          product: "sab",
          size: "020",
          packaging: "cxa",
        },
        "pt",
      ),
    ).toBe("ALG OCEAN SPA Sabonete 20g Caixa Cartao");
  });

  it("filters words by label, code and localized designation", () => {
    const options = sabsolCatalog.levels.find((level) => level.id === "packaging")?.options ?? [];

    expect(filterGeneratorWords(options, "CXA")).toHaveLength(1);
    expect(filterGeneratorWords(options, "Caja")).toHaveLength(1);
    expect(filterGeneratorWords(options, "missing")).toHaveLength(0);
  });
});
