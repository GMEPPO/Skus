import { describe, expect, it } from "vitest";
import { validateAssistantProposal } from "@/lib/sku-assistant/validate-proposal";
import type { GeneratorCatalog } from "@/lib/types";

const miniCatalog: GeneratorCatalog = {
  levels: [
    {
      id: "brand",
      order: 1,
      fieldType: "brand",
      label: "Marca",
      options: [
        {
          id: "alg",
          label: "ALG",
          referenceCode: "ALG",
          designation: "ALG",
          designationPt: "ALG",
          designationEs: "ALG",
          designationEn: "ALG",
          includeInDesignation: true,
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
      id: "extra",
      order: 6,
      fieldType: "extra",
      label: "Extra",
      options: [],
    },
  ],
};

describe("validateAssistantProposal", () => {
  it("aceita seleccao valida e devolve preview", () => {
    const result = validateAssistantProposal(miniCatalog, {}, { brand: "alg", product: "sab" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.proposal.codeHyphen).toContain("ALG");
    expect(result.proposal.codeHyphen).toContain("SAB");
    expect(result.proposal.designationPt).toContain("Sabonete");
  });

  it("ignora wordId invalido em vez de falhar", () => {
    const result = validateAssistantProposal(miniCatalog, {}, { brand: "missing-id" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.proposal.selections.brand).toBeUndefined();
  });
});
