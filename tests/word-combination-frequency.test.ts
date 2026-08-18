import { describe, expect, it } from "vitest";
import type { WordCombinationWarningSummary } from "@/lib/word-combination-analysis-data";
import type { CombinationLimitViolation } from "@/lib/word-combination-limits";
import {
  buildWordPairFrequencyRanking,
  collectDeduplicatedViolations,
} from "@/lib/word-combination-frequency";
import type { WordListItem } from "@/lib/types";

function violation(
  labels: Array<{ level: string; label: string; code: string }>,
  lengths: { pt: number; es?: number; en?: number },
): CombinationLimitViolation {
  const exceededDesignationLocales: Array<"pt" | "es" | "en"> = [];
  if (lengths.pt > 60) exceededDesignationLocales.push("pt");
  if ((lengths.es ?? lengths.pt) > 60) exceededDesignationLocales.push("es");
  if ((lengths.en ?? lengths.pt) > 60) exceededDesignationLocales.push("en");

  return {
    selections: labels.map((entry) => ({
      levelLabel: entry.level,
      wordLabel: entry.label,
      referenceCode: entry.code,
    })),
    designationPt: "x".repeat(lengths.pt),
    designationEs: "x".repeat(lengths.es ?? lengths.pt),
    designationEn: "x".repeat(lengths.en ?? lengths.pt),
    designationPtLength: lengths.pt,
    designationEsLength: lengths.es ?? lengths.pt,
    designationEnLength: lengths.en ?? lengths.pt,
    referenceCompact: "000000",
    referenceCompactLength: 6,
    exceededDesignationLocales,
    referenceExceeded: false,
  };
}

const words: WordListItem[] = [
  {
    id: "w1",
    label: "Algodao",
    referenceCode: "ALG",
    fieldTypeId: "ft1",
    fieldTypeLabel: "Material",
    designation: "Algodao",
    designationPt: "Algodao",
    designationEs: "Algodao",
    designationEn: "Algodao",
    includeInDesignation: true,
    familyIds: [],
    familyLabels: [],
    parentWordIds: [],
    parentWordLabels: [],
    parentMatchMode: "any",
    selectionHierarchy: null,
    categoryLevelId: null,
  },
  {
    id: "w2",
    label: "Policarbonato",
    referenceCode: "POL",
    fieldTypeId: "ft2",
    fieldTypeLabel: "Formato",
    designation: "Policarbonato",
    designationPt: "Policarbonato",
    designationEs: "Policarbonato",
    designationEn: "Policarbonato",
    includeInDesignation: true,
    familyIds: [],
    familyLabels: [],
    parentWordIds: [],
    parentWordLabels: [],
    parentMatchMode: "any",
    selectionHierarchy: null,
    categoryLevelId: null,
  },
  {
    id: "w3",
    label: "CodigoOnly",
    referenceCode: "COD",
    fieldTypeId: "ft3",
    fieldTypeLabel: "Extra",
    designation: "CodigoOnly",
    designationPt: "CodigoOnly",
    designationEs: "CodigoOnly",
    designationEn: "CodigoOnly",
    includeInDesignation: false,
    familyIds: [],
    familyLabels: [],
    parentWordIds: [],
    parentWordLabels: [],
    parentMatchMode: "any",
    selectionHierarchy: null,
    categoryLevelId: null,
  },
];

describe("word-combination-frequency", () => {
  it("deduplicates identical violations across word summaries", () => {
    const shared = violation(
      [
        { level: "Material", label: "Algodao", code: "ALG" },
        { level: "Formato", label: "Policarbonato", code: "POL" },
      ],
      { pt: 68 },
    );

    const summaries = new Map<string, WordCombinationWarningSummary>([
      ["w1", { wordId: "w1", violationCount: 1, violations: [shared], truncated: false, pathsExplored: 1 }],
      ["w2", { wordId: "w2", violationCount: 1, violations: [shared], truncated: false, pathsExplored: 1 }],
    ]);

    expect(collectDeduplicatedViolations(summaries)).toHaveLength(1);
  });

  it("ranks word pairs that co-occur most in deduplicated violations", () => {
    const pairViolation = violation(
      [
        { level: "Material", label: "Algodao", code: "ALG" },
        { level: "Formato", label: "Policarbonato", code: "POL" },
      ],
      { pt: 70 },
    );
    const otherViolation = violation(
      [
        { level: "Material", label: "Algodao", code: "ALG" },
        { level: "Produto", label: "Espuma", code: "ESP" },
      ],
      { pt: 65 },
    );

    const summaries = new Map<string, WordCombinationWarningSummary>([
      [
        "w1",
        {
          wordId: "w1",
          violationCount: 2,
          violations: [pairViolation, otherViolation],
          truncated: false,
          pathsExplored: 2,
        },
      ],
    ]);

    const ranking = buildWordPairFrequencyRanking(summaries, words);

    expect(ranking[0]?.left.label).toBe("Algodao");
    expect(ranking[0]?.right.label).toBe("Policarbonato");
    expect(ranking[0]?.count).toBe(1);
    expect(ranking[0]?.avgOverrun).toBe(10);
  });

  it("ignores words that do not enter designation when building pairs", () => {
    const mixedViolation = violation(
      [
        { level: "Material", label: "Algodao", code: "ALG" },
        { level: "Extra", label: "CodigoOnly", code: "COD" },
      ],
      { pt: 66 },
    );

    const summaries = new Map<string, WordCombinationWarningSummary>([
      ["w1", { wordId: "w1", violationCount: 1, violations: [mixedViolation], truncated: false, pathsExplored: 1 }],
    ]);

    expect(buildWordPairFrequencyRanking(summaries, words)).toHaveLength(0);
  });
});
