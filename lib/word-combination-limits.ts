import type { GeneratorCatalog, GeneratorLevel, GeneratorWord } from "@/lib/types";
import {
  buildDesignationByLocale,
  buildEmptySelectionId,
  isEmptySelection,
  MAX_DESIGNATION_LENGTH,
} from "@/lib/sku";
import { getVisibleOptionsForLevel, isWordVisibleInGenerator } from "@/lib/word-dependencies";

export const MAX_SKU_REFERENCE_COMPACT_LENGTH = 18;
export const DRAFT_WORD_ID = "__draft_word__";

export type CombinationSelectionSummary = {
  levelLabel: string;
  wordLabel: string;
  referenceCode: string;
};

export type CombinationLimitViolation = {
  selections: CombinationSelectionSummary[];
  designationPt: string;
  designationEs: string;
  designationEn: string;
  designationPtLength: number;
  designationEsLength: number;
  designationEnLength: number;
  referenceCompact: string;
  referenceCompactLength: number;
  exceededDesignationLocales: Array<"pt" | "es" | "en">;
  referenceExceeded: boolean;
};

export type WordCombinationAnalysisResult = {
  violations: CombinationLimitViolation[];
  pathsExplored: number;
  truncated: boolean;
  totalViolationsFound: number;
};

export type WordCandidateForAnalysis = Pick<
  GeneratorWord,
  | "id"
  | "label"
  | "referenceCode"
  | "designationPt"
  | "designationEs"
  | "designationEn"
  | "includeInDesignation"
  | "parentWordIds"
  | "parentMatchMode"
  | "selectionHierarchy"
>;

const DEFAULT_MAX_PATHS_EXPLORED = 8_000;
const DEFAULT_MAX_VIOLATIONS_RETURNED = 30;
const DETAILED_MAX_PATHS_EXPLORED = 250_000;

export type CombinationAnalysisOptions = {
  maxPathsExplored?: number;
  maxViolationsReturned?: number | null;
};

export const BACKGROUND_COMBINATION_ANALYSIS_OPTIONS: CombinationAnalysisOptions = {
  maxPathsExplored: DEFAULT_MAX_PATHS_EXPLORED,
  maxViolationsReturned: DEFAULT_MAX_VIOLATIONS_RETURNED,
};

export const DETAILED_COMBINATION_ANALYSIS_OPTIONS: CombinationAnalysisOptions = {
  maxPathsExplored: DETAILED_MAX_PATHS_EXPLORED,
  maxViolationsReturned: null,
};

function isOptionalLevel(level: GeneratorLevel) {
  return level.fieldType === "extra";
}

export function buildSkuCompactReference(
  catalog: GeneratorCatalog,
  selections: Record<string, string>,
): string {
  return catalog.levels
    .map((level) => {
      const selectedValue = selections[level.id];
      if (!selectedValue || isEmptySelection(selectedValue)) return "000";
      const option = level.options.find((item) => item.id === selectedValue);
      return option?.referenceCode ?? "000";
    })
    .join("");
}

function buildSelectionSummaries(
  catalog: GeneratorCatalog,
  selections: Record<string, string>,
): CombinationSelectionSummary[] {
  return catalog.levels.map((level) => {
    const selectedValue = selections[level.id];
    if (!selectedValue || isEmptySelection(selectedValue)) {
      return { levelLabel: level.label, wordLabel: "Vazio", referenceCode: "000" };
    }
    const word = level.options.find((option) => option.id === selectedValue);
    return {
      levelLabel: level.label,
      wordLabel: word?.label ?? "?",
      referenceCode: word?.referenceCode ?? "000",
    };
  });
}

function evaluateSelections(
  catalog: GeneratorCatalog,
  selections: Record<string, string>,
): CombinationLimitViolation | null {
  const designationPt = buildDesignationByLocale(catalog, selections, "pt");
  const designationEs = buildDesignationByLocale(catalog, selections, "es");
  const designationEn = buildDesignationByLocale(catalog, selections, "en");
  const referenceCompact = buildSkuCompactReference(catalog, selections);

  const exceededDesignationLocales: Array<"pt" | "es" | "en"> = [];
  if (designationPt.length > MAX_DESIGNATION_LENGTH) exceededDesignationLocales.push("pt");
  if (designationEs.length > MAX_DESIGNATION_LENGTH) exceededDesignationLocales.push("es");
  if (designationEn.length > MAX_DESIGNATION_LENGTH) exceededDesignationLocales.push("en");

  const referenceExceeded = referenceCompact.length > MAX_SKU_REFERENCE_COMPACT_LENGTH;
  if (exceededDesignationLocales.length === 0 && !referenceExceeded) return null;

  return {
    selections: buildSelectionSummaries(catalog, selections),
    designationPt,
    designationEs,
    designationEn,
    designationPtLength: designationPt.length,
    designationEsLength: designationEs.length,
    designationEnLength: designationEn.length,
    referenceCompact,
    referenceCompactLength: referenceCompact.length,
    exceededDesignationLocales,
    referenceExceeded,
  };
}

function selectionSignature(selections: Record<string, string>, levelIds: string[]) {
  return levelIds.map((levelId) => selections[levelId] ?? "").join("|");
}

export function injectWordIntoCatalog(
  catalog: GeneratorCatalog,
  levelId: string,
  word: WordCandidateForAnalysis,
): GeneratorCatalog {
  return {
    ...catalog,
    levels: catalog.levels.map((level) => {
      if (level.id !== levelId) return level;
      const withoutWord = level.options.filter((option) => option.id !== word.id);
      const nextWord: GeneratorWord = {
        id: word.id,
        label: word.label,
        referenceCode: word.referenceCode,
        designation: word.designationPt,
        designationPt: word.designationPt,
        designationEs: word.designationEs,
        designationEn: word.designationEn,
        includeInDesignation: word.includeInDesignation,
        parentWordIds: word.parentWordIds ?? [],
        parentMatchMode: word.parentMatchMode ?? "any",
        selectionHierarchy: word.selectionHierarchy ?? null,
      };
      return {
        ...level,
        options: [...withoutWord, nextWord],
      };
    }),
  };
}

export function analyzeWordCombinationLimits(
  catalog: GeneratorCatalog,
  targetLevelId: string,
  targetWordId: string,
  options: CombinationAnalysisOptions = BACKGROUND_COMBINATION_ANALYSIS_OPTIONS,
): WordCombinationAnalysisResult {
  const maxPathsExplored = options.maxPathsExplored ?? DEFAULT_MAX_PATHS_EXPLORED;
  const maxViolationsReturned = options.maxViolationsReturned ?? DEFAULT_MAX_VIOLATIONS_RETURNED;

  const targetLevel = catalog.levels.find((level) => level.id === targetLevelId);
  if (!targetLevel) {
    return { violations: [], pathsExplored: 0, truncated: false, totalViolationsFound: 0 };
  }

  const targetWord = targetLevel.options.find((option) => option.id === targetWordId);
  if (!targetWord) {
    return { violations: [], pathsExplored: 0, truncated: false, totalViolationsFound: 0 };
  }

  const resolvedTargetWord: GeneratorWord = targetWord;

  const levelIds = catalog.levels.map((level) => level.id);
  const violations: CombinationLimitViolation[] = [];
  const seenViolations = new Set<string>();
  let pathsExplored = 0;
  let truncated = false;
  let totalViolationsFound = 0;

  function recordViolation(selections: Record<string, string>) {
    const violation = evaluateSelections(catalog, selections);
    if (!violation) return;

    const signature = selectionSignature(selections, levelIds);
    if (seenViolations.has(signature)) return;
    seenViolations.add(signature);
    totalViolationsFound += 1;

    if (maxViolationsReturned === null || violations.length < maxViolationsReturned) {
      violations.push(violation);
    }
  }

  function dfs(levelIndex: number, selections: Record<string, string>) {
    if (pathsExplored >= maxPathsExplored) {
      truncated = true;
      return;
    }

    if (levelIndex >= catalog.levels.length) {
      recordViolation(selections);
      return;
    }

    const level = catalog.levels[levelIndex];

    if (level.id === targetLevelId) {
      if (!isWordVisibleInGenerator(resolvedTargetWord, level, catalog, selections)) {
        return;
      }

      pathsExplored += 1;
      const nextSelections = { ...selections, [level.id]: targetWordId };
      dfs(levelIndex + 1, nextSelections);
      return;
    }

    if (isOptionalLevel(level)) {
      pathsExplored += 1;
      dfs(levelIndex + 1, { ...selections, [level.id]: buildEmptySelectionId(level.id) });
      if (truncated) return;
    }

    const options = getVisibleOptionsForLevel(catalog, level.id, selections);
    if (options.length === 0) {
      if (isOptionalLevel(level)) return;
      return;
    }

    for (const option of options) {
      if (pathsExplored >= maxPathsExplored) {
        truncated = true;
        return;
      }
      pathsExplored += 1;
      dfs(levelIndex + 1, { ...selections, [level.id]: option.id });
      if (truncated) return;
    }
  }

  dfs(0, {});

  return { violations, pathsExplored, truncated, totalViolationsFound };
}

export function formatCombinationSelectionLine(selections: CombinationSelectionSummary[]) {
  return selections.map((entry) => `${entry.wordLabel} (${entry.referenceCode})`).join(" · ");
}

export function formatCombinationViolationSummary(violation: CombinationLimitViolation) {
  const parts: string[] = [];
  if (violation.exceededDesignationLocales.includes("pt")) {
    parts.push(`PT ${violation.designationPtLength}/${MAX_DESIGNATION_LENGTH}`);
  }
  if (violation.exceededDesignationLocales.includes("es")) {
    parts.push(`ES ${violation.designationEsLength}/${MAX_DESIGNATION_LENGTH}`);
  }
  if (violation.exceededDesignationLocales.includes("en")) {
    parts.push(`EN ${violation.designationEnLength}/${MAX_DESIGNATION_LENGTH}`);
  }
  if (violation.referenceExceeded) {
    parts.push(`Ref ${violation.referenceCompactLength}/${MAX_SKU_REFERENCE_COMPACT_LENGTH}`);
  }
  return parts.join(", ");
}
