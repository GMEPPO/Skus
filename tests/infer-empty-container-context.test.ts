import { describe, expect, it } from "vitest";
import { inferEmptyContainerContext } from "@/lib/sku-assistant/infer-empty-container-context";

describe("inferEmptyContainerContext", () => {
  it("detects empty bottle from garrafa + condicionador designation", () => {
    const context = inferEmptyContainerContext(
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

    expect(context).not.toBeNull();
    expect(context).toContain("ENVASE VAZIO");
    expect(context).toContain("ALU = Aluminio CLS");
    expect(context).toContain("NAO classifiques como preparacao cosmetica");
  });

  it("returns null for non-bottle products", () => {
    expect(
      inferEmptyContainerContext({ designationPt: "Sabonete Solido Algotherm 20g" }, []),
    ).toBeNull();
  });
});
