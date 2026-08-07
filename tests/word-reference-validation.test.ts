import { describe, expect, it } from "vitest";
import {
  collectDesignationLengthWarnings,
  formatWordReferenceConflictMessage,
  isEmptyWordReferenceCode,
  isSizeReferenceScope,
  normalizeWordLabel,
  normalizeWordReferenceCode,
  resolveWordFieldTypeCodeFromRow,
} from "@/lib/word-reference-validation";

describe("word reference validation", () => {
  it("normaliza referencias em maiusculas", () => {
    expect(normalizeWordReferenceCode(" fra ")).toBe("FRA");
  });

  it("000 e reservado para vazio", () => {
    expect(isEmptyWordReferenceCode("000")).toBe(true);
    expect(isEmptyWordReferenceCode("FRA")).toBe(false);
  });

  it("normaliza labels de palavra", () => {
    expect(normalizeWordLabel(" Sabonete ")).toBe("sabonete");
  });

  it("identifica nivel tamanho/gr/ml/kg/l", () => {
    expect(isSizeReferenceScope("size")).toBe(true);
    expect(isSizeReferenceScope("brand")).toBe(false);
  });

  it("resolve codigo de field type a partir da palavra", () => {
    expect(
      resolveWordFieldTypeCodeFromRow({
        skus_field_types: { code: "size" },
      }),
    ).toBe("size");
  });

  it("formata mensagem de conflito global", () => {
    expect(
      formatWordReferenceConflictMessage({
        wordId: "1",
        label: "Frasco",
        referenceCode: "FRA",
        levelLabel: "Formato",
      }),
    ).toContain("Frasco");
  });

  it("avisa designacoes acima de 60 caracteres", () => {
    const warnings = collectDesignationLengthWarnings({
      pt: "A".repeat(61),
      es: "OK",
      en: "OK",
    });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.locale).toBe("pt");
  });
});
