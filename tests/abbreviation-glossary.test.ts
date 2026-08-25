import { describe, expect, it } from "vitest";
import {
  buildAbbreviationGlossary,
  summarizeAbbreviationGlossaryForPrompt,
} from "@/lib/sku-assistant/build-abbreviation-glossary";
import type { GeneratorCatalog } from "@/lib/types";

const catalog: GeneratorCatalog = {
  levels: [
    {
      id: "lvl-packaging",
      order: 5,
      fieldType: "packaging",
      fieldTypeId: null,
      label: "Embalagem",
      options: [
        {
          id: "w-alu",
          label: "Aluminio CLS",
          referenceCode: "ALU",
          designation: "Aluminio CLS",
          designationPt: "Aluminio CLS",
          designationEs: "Aluminio CLS",
          designationEn: "Aluminum CLS",
          includeInDesignation: true,
        },
      ],
    },
    {
      id: "lvl-extra",
      order: 6,
      fieldType: "extra",
      fieldTypeId: null,
      label: "Extra",
      options: [
        {
          id: "w-cls",
          label: "Classico",
          referenceCode: "CLS",
          designation: "Classico",
          designationPt: "Classico",
          designationEs: "Clasico",
          designationEn: "Classic",
          includeInDesignation: true,
        },
      ],
    },
  ],
};

describe("buildAbbreviationGlossary", () => {
  it("maps selected catalog words to abbreviation entries", () => {
    const entries = buildAbbreviationGlossary(catalog, {
      "lvl-packaging": "w-alu",
      "lvl-extra": "w-cls",
    });

    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({ referenceCode: "ALU", designationPt: "Aluminio CLS" });
    expect(entries[1]).toMatchObject({ referenceCode: "CLS", designationPt: "Classico" });
  });

  it("includes glossary hints in prompt summary", () => {
    const summary = summarizeAbbreviationGlossaryForPrompt(
      buildAbbreviationGlossary(catalog, {
        "lvl-packaging": "w-alu",
      }),
    );

    expect(summary).toContain("ALU");
    expect(summary).toContain("Aluminio CLS");
    expect(summary).toContain("Glossario de abreviaturas");
  });
});
