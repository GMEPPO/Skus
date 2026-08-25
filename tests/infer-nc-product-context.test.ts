import { describe, expect, it } from "vitest";
import { detectFormatKind, inferNcProductContext } from "@/lib/sku-assistant/infer-nc-product-context";

describe("inferNcProductContext", () => {
  it("detects empty garrafa ecofill", () => {
    const context = inferNcProductContext(
      {
        designationPt: "BEN GORDISSIMO Garrafa Ecofill Condicionador 300ml ALU CLS",
      },
      [
        {
          levelLabel: "Formato",
          fieldType: "format",
          referenceCode: "ECO",
          label: "Garrafa Ecofill",
          designationPt: "Garrafa Ecofill",
        },
        {
          levelLabel: "Embalagem",
          fieldType: "packaging",
          referenceCode: "ALU",
          label: "Aluminio CLS",
          designationPt: "Aluminio CLS",
        },
      ],
    );

    expect(context).toContain("GARRAFA VAZIA");
    expect(context).toContain("NAO uses capitulo 33");
  });

  it("detects filled recarga with liquid", () => {
    const context = inferNcProductContext(
      {
        designationPt: "ALG Recarga Ecofill Condicionador 300ml ALU CLS",
      },
      [
        {
          levelLabel: "Formato",
          fieldType: "format",
          referenceCode: "ECO",
          label: "Recarga Ecofill",
          designationPt: "Recarga Ecofill",
        },
      ],
    );

    expect(context).toContain("RECARGA COM LIQUIDO");
    expect(context).toContain("capitulo 33");
  });

  it("detects filled frasco with liquid", () => {
    const context = inferNcProductContext(
      { designationPt: "ALG Frasco Gel de Limpeza 250ml" },
      [
        {
          levelLabel: "Formato",
          fieldType: "format",
          referenceCode: "FRA",
          label: "Frasco",
          designationPt: "Frasco",
        },
      ],
    );

    expect(context).toContain("FRASCO COM LIQUIDO");
    expect(context).toContain("capitulo 33");
  });

  it("prioritises recarga over garrafa when format is recarga", () => {
    expect(
      detectFormatKind("Garrafa Ecofill", [
        {
          levelLabel: "Formato",
          fieldType: "format",
          referenceCode: "ECO",
          label: "Recarga Ecofill",
          designationPt: "Recarga Ecofill",
        },
      ]),
    ).toBe("filled-recarga");
  });
});
