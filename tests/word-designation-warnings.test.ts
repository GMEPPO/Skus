import { describe, expect, it } from "vitest";
import { collectSelectedWordDesignationWarnings } from "@/lib/sku";
import type { GeneratorCatalog } from "@/lib/types";

const catalog: GeneratorCatalog = {
  levels: [
    {
      id: "brand",
      order: 1,
      fieldType: "brand",
      label: "Marca",
      options: [
        {
          id: "long",
          label: "Marca longa",
          referenceCode: "LNG",
          designation: "X".repeat(61),
          designationPt: "X".repeat(61),
          designationEs: "OK",
          designationEn: "OK",
          includeInDesignation: true,
        },
      ],
    },
  ],
};

describe("selected word designation warnings", () => {
  it("detecta palavras seleccionadas com designacao demasiado longa", () => {
    const warnings = collectSelectedWordDesignationWarnings(catalog, { brand: "long" });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.locale).toBe("pt");
  });
});
