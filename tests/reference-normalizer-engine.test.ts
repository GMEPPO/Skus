import { describe, expect, it } from "vitest";
import { detectColumns } from "@/lib/reference-normalizer/column-detection";
import { buildDefaultNormalizerConfig } from "@/lib/reference-normalizer/defaults";
import { processRow } from "@/lib/reference-normalizer/row-processor";
import { finalizeDesignation } from "@/lib/reference-normalizer/postprocess";

const config = buildDefaultNormalizerConfig();

function runCase(oldReference: string, oldDesignation: string) {
  return processRow(
    {
      rowNumber: 1,
      originalRow: {},
      oldReference,
      oldDesignation,
      keepExtraColumns: false,
    },
    config,
  );
}

describe("reference normalizer engine", () => {
  it("preserves VAZ in the new reference", () => {
    const result = runCase("ALGECOAMA030VAZ", "ALGOTHERM Garrafa Ecofill Amaciador 30ml Vazia");
    expect(result.newReference).toContain("VAZ");
  });

  it("keeps the full 6-field reference order even when packaging and extra are empty", () => {
    const result = runCase("ALEFRAAMA030000000", "BENAMOR - ALECRIM Frasco Amaciador 30ml");
    expect(result.newReference).toBe("ALEFRAAMA030000000");
  });

  it("hides Vazia only for garrafa formats", () => {
    const bottle = runCase("ALGECOAMA030VAZ", "ALGOTHERM Garrafa Ecofill Amaciador 30ml Vazia");
    const nonBottle = runCase("ALGFRAAMA030VAZ", "ALGOTHERM Frasco Amaciador 30ml Vazia");

    expect(bottle.designationPt).not.toContain("Vazia");
    expect(nonBottle.designationPt).toContain("Vazia");
  });

  it("maps ALGOTHERM to Ocean Spa in designation", () => {
    const result = runCase("ALGECOAMA030VAZ", "ALGOTHERM Garrafa Ecofill Amaciador 30ml Vazia");
    expect(result.designationPt).toContain("Ocean Spa");
  });

  it("maps ACH/ARCH BRITO to ACB LAVANDA", () => {
    const result = runCase("ACBFRASAB030000", "ARCH BRITO Frasco Sabonete Liquido 30ml");
    expect(result.designationPt).toContain("ACB LAVANDA");
    expect(result.designationEn).toContain("ACB Lavender");
  });

  it("collapses Benamor and Gordissimo to Benamor", () => {
    const result = runCase("GORFRAAMA030000", "GORDISSIMO Frasco Amaciador 30ml");
    expect(result.designationPt).toContain("Benamor");
    expect(result.designationPt).not.toContain("GORDISSIMO");
  });

  it("translates Amaciador by language", () => {
    const result = runCase("ALGECOAMA030VAZ", "ALGOTHERM Garrafa Ecofill Amaciador 30ml Vazia");
    expect(result.designationPt).toContain("Condicionador");
    expect(result.designationEs).toContain("Acondicionador");
    expect(result.designationEn).toContain("Conditioner");
  });

  it("translates Locao de Maos e Corpo by language", () => {
    const result = runCase("CASECOBOD030VAZ", "CASTELBEL Garrafa Ecofill Locao de Maos e Corpo 30ml");
    expect(result.trace.triggeredRules).toContain("CASTELBEL -> Pink Lily ou variante");
  });

  it("translates Sabonete Liquido by language", () => {
    const result = runCase("ACBFRASAB030000", "ACH BRITO Frasco Sabonete Liquido 30ml");
    expect(result.designationPt).toContain("Sab Liquido");
    expect(result.designationEs).toContain("Jabon liquido");
    expect(result.designationEn).toContain("Liquid Soap");
  });

  it("removes dots safely and tightens hyphen spacing", () => {
    expect(finalizeDesignation("Plast. Rec. 4.5ml LARANJA - VERBENA")).toBe("Plast Rec 4.5ml LARANJA-VERBENA");
  });

  it("maps CASTELBEL alone to Pink Lily", () => {
    const result = runCase("CASECOBOD030VAZ", "CASTELBEL");
    expect(result.designationPt).toBe("Pink Lily");
  });

  it("keeps only the CASTELBEL variant when present", () => {
    const result = runCase("CASECOBOD030VAZ", "CASTELBEL LARANJA - VERBENA");
    expect(result.designationPt).toBe("LARANJA-VERBENA");
  });

  it("keeps detected segments when CASTELBEL appears inside a full description", () => {
    const result = runCase("CASECPAMA300NICAE", "Ecopump 300ml Condicionador CASTELBEL Nova Imagem (24)");
    expect(result.designationPt).toContain("Pink Lily");
    expect(result.designationPt).toContain("Ecopump");
    expect(result.designationPt).toContain("300ml");
    expect(result.designationPt).not.toContain("mpô");
    expect(result.designationPt).not.toContain("Nova Imagem");
  });

  it("uses LVE when CASTELBEL explicitly carries the LARANJA-VERBENA variant", () => {
    const result = runCase("LVEECPAMA300MLOV4", "Ecop. Condicionador 300ml CASTELBEL LARANJA-VERBENA");
    expect(result.designationPt).toContain("LVE");
    expect(result.designationPt).not.toContain("Pink Lily");
  });

  it("calculates character counters from the final exportable strings", () => {
    const result = runCase("CASECOBOD030VAZ", "CASTELBEL LARANJA - VERBENA");
    expect(result.charactersPt).toBe(result.designationPt.length);
    expect(result.charactersEs).toBe(result.designationEs.length);
    expect(result.charactersEn).toBe(result.designationEn.length);
  });

  it("keeps reference building separate from designation labels", () => {
    const result = runCase("ALGECOAMA030VAZ", "ALGOTHERM Garrafa Ecofill Amaciador 30ml Vazia");
    expect(result.newReference.startsWith("ALG")).toBe(true);
    expect(result.designationPt.startsWith("Ocean Spa")).toBe(true);
  });

  it("detects reference and designation columns tolerantly", () => {
    const detection = detectColumns([" Referência antiga ", "DESIGNAÇÃO ANTIGA", "outra"]);
    expect(detection.referenceColumn).toBe(" Referência antiga ");
    expect(detection.designationColumn).toBe("DESIGNAÇÃO ANTIGA");
  });

  it("resolves ESC ambiguity by structured reference parsing", () => {
    const result = runCase("ALGFRAAMAESC000ESC", "ALGOTHERM Frasco Amaciador Escova Escovado");
    expect(result.segments.size?.canonicalValue).toBe("Escova");
    expect(result.segments.extra?.canonicalValue).toBe("Escovado");
  });

  it("detects 5L size as code 005 for recarga references", () => {
    const result = runCase("CASECPRECAMA5LNEU", "Recarga 5L Amaciador CASTELBEL");
    expect(result.segments.size?.canonicalValue).toBe("5LT");
    expect(result.newReference).toContain("005");
  });
});
