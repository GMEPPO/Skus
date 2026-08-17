import type { GeneratorCatalog, GeneratorLevel, GeneratorWord } from "@/lib/types";
import { getVisibleOptionsForLevel } from "@/lib/word-dependencies";

export const MAX_DESIGNATION_LENGTH = 60;
export const EMPTY_SELECTION_PREFIX = "__empty__:";
type DesignationLocale = "pt" | "es" | "en";

export function buildEmptySelectionId(levelId: string) {
  return `${EMPTY_SELECTION_PREFIX}${levelId}`;
}

export function isEmptySelection(value?: string) {
  return Boolean(value && value.startsWith(EMPTY_SELECTION_PREFIX));
}

export function isEmptyReferenceWord(word?: Pick<GeneratorWord, "referenceCode" | "label"> | null) {
  if (!word) return false;
  if (word.referenceCode === "000") return true;
  return String(word.label ?? "")
    .trim()
    .toLowerCase() === "vazio";
}

function shouldIncludeWordInDesignation(
  level: Pick<GeneratorLevel, "fieldType">,
  option: GeneratorWord,
): boolean {
  if (isEmptyReferenceWord(option)) return false;
  if (level.fieldType === "product") return true;
  return option.includeInDesignation;
}

function pickDesignationText(option: GeneratorWord, locale: DesignationLocale): string | null {
  const value =
    locale === "en"
      ? option.designationEn || option.designation || option.label
      : locale === "es"
        ? option.designationEs || option.designation || option.label
        : option.designationPt || option.designation || option.label;
  const trimmed = String(value ?? "").trim();
  if (!trimmed || trimmed.toLowerCase() === "vazio") return null;
  return trimmed;
}

export function sortGeneratorWords(options: GeneratorWord[]): GeneratorWord[] {
  return [...options].sort((left, right) => {
    if (left.referenceCode === "000") return -1;
    if (right.referenceCode === "000") return 1;
    return left.label.localeCompare(right.label, "pt");
  });
}

export function getAvailableOptions(
  catalog: GeneratorCatalog,
  levelId: string,
  selections: Record<string, string> = {},
): GeneratorWord[] {
  return getVisibleOptionsForLevel(catalog, levelId, selections);
}

export function filterGeneratorWords(options: GeneratorWord[], query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return options;

  return options.filter((option) => {
    const haystack = [
      option.label,
      option.referenceCode,
      option.designation,
      option.designationPt,
      option.designationEs,
      option.designationEn,
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(normalizedQuery);
  });
}

export function buildDesignation(
  catalog: GeneratorCatalog,
  selections: Record<string, string>,
) {
  const designation = buildDesignationByLocale(catalog, selections, "pt");
  return designation.replace(/\s+/g, " ");
}

export function buildDesignationByLocale(
  catalog: GeneratorCatalog,
  selections: Record<string, string>,
  locale: DesignationLocale,
) {
  const segments = catalog.levels
    .map((level) => {
      const selectedValue = selections[level.id];
      if (isEmptySelection(selectedValue)) return null;
      const option = level.options.find((item) => item.id === selectedValue);
      if (!option || !shouldIncludeWordInDesignation(level, option)) return null;
      return pickDesignationText(option, locale);
    })
    .filter((value): value is string => Boolean(value));

  return segments.join(" ").trim().replace(/\s+/g, " ");
}

export function buildSkuPreview(
  catalog: GeneratorCatalog,
  selections: Record<string, string>,
) {
  const segments = catalog.levels.map((level) => {
    const selectedValue = selections[level.id];
    if (isEmptySelection(selectedValue)) return "000";
    const option = level.options.find((item) => item.id === selectedValue);
    return option?.referenceCode ?? "000";
  });

  return segments.join("-");
}

function escapeIlikeSegment(segment: string) {
  return segment.replace(/[\\%_]/g, "\\$&");
}

export function buildSkuCodeExamplePattern(
  catalog: GeneratorCatalog,
  selections: Record<string, string>,
): string | null {
  let selectedSegmentCount = 0;
  const segments = catalog.levels.map((level) => {
    const selectedValue = selections[level.id];
    if (!selectedValue) return null;
    selectedSegmentCount += 1;
    if (isEmptySelection(selectedValue)) return "000";
    const option = level.options.find((item) => item.id === selectedValue);
    return option?.referenceCode ?? null;
  });

  if (selectedSegmentCount === 0) return null;

  return segments.map((segment) => (segment ? escapeIlikeSegment(segment) : "%")).join("-");
}

export function buildSkuCodeExampleCompactPrefix(
  catalog: GeneratorCatalog,
  selections: Record<string, string>,
): string | null {
  const parts: string[] = [];

  for (const level of catalog.levels) {
    const selectedValue = selections[level.id];
    if (!selectedValue) break;

    if (isEmptySelection(selectedValue)) {
      parts.push("000");
      continue;
    }

    const option = level.options.find((item) => item.id === selectedValue);
    parts.push(option?.referenceCode ?? "000");
  }

  if (parts.length === 0) return null;
  return `${escapeIlikeSegment(parts.join(""))}%`;
}

function buildSkuCodeExampleLooseCompactPattern(
  catalog: GeneratorCatalog,
  levelId: string,
  selectedValue: string,
): string | null {
  const levelIndex = catalog.levels.findIndex((level) => level.id === levelId);
  if (levelIndex <= 0) return null;

  if (isEmptySelection(selectedValue)) return "%000%";

  const level = catalog.levels[levelIndex];
  const option = level.options.find((item) => item.id === selectedValue);
  const segment = option?.referenceCode;
  if (!segment) return null;

  return `%${escapeIlikeSegment(segment)}%`;
}

export function buildSkuCodeExamplePatterns(
  catalog: GeneratorCatalog,
  selections: Record<string, string>,
  selectionOrder: string[],
): string[] {
  const patterns: string[] = [];

  const fullHyphenPattern = buildSkuCodeExamplePattern(catalog, selections);
  if (fullHyphenPattern) patterns.push(fullHyphenPattern);

  const compactPrefix = buildSkuCodeExampleCompactPrefix(catalog, selections);
  if (compactPrefix && !patterns.includes(compactPrefix)) patterns.push(compactPrefix);

  for (const levelId of [...selectionOrder].reverse()) {
    const selectedValue = selections[levelId];
    if (!selectedValue) continue;

    const singleSelection = { [levelId]: selectedValue };
    const singleHyphenPattern = buildSkuCodeExamplePattern(catalog, singleSelection);
    if (singleHyphenPattern && !patterns.includes(singleHyphenPattern)) {
      patterns.push(singleHyphenPattern);
    }

    const singleCompactPrefix = buildSkuCodeExampleCompactPrefix(catalog, singleSelection);
    if (singleCompactPrefix && !patterns.includes(singleCompactPrefix)) {
      patterns.push(singleCompactPrefix);
    }

    const looseCompactPattern = buildSkuCodeExampleLooseCompactPattern(catalog, levelId, selectedValue);
    if (looseCompactPattern && !patterns.includes(looseCompactPattern)) {
      patterns.push(looseCompactPattern);
    }
  }

  return patterns;
}

export type SelectedWordDesignationWarning = {
  levelLabel: string;
  wordLabel: string;
  locale: "pt" | "es" | "en";
  length: number;
};

export function collectSelectedWordDesignationWarnings(
  catalog: GeneratorCatalog,
  selections: Record<string, string>,
): SelectedWordDesignationWarning[] {
  const warnings: SelectedWordDesignationWarning[] = [];

  for (const level of catalog.levels) {
    const selectedId = selections[level.id];
    if (!selectedId || isEmptySelection(selectedId)) continue;
    const word = level.options.find((option) => option.id === selectedId);
    if (!word || isEmptyReferenceWord(word)) continue;

    const entries: Array<{ locale: "pt" | "es" | "en"; value: string }> = [
      { locale: "pt", value: word.designationPt || word.designation || word.label },
      { locale: "es", value: word.designationEs || word.designation || word.label },
      { locale: "en", value: word.designationEn || word.designation || word.label },
    ];

    for (const entry of entries) {
      if (entry.value.trim().length > MAX_DESIGNATION_LENGTH) {
        warnings.push({
          levelLabel: level.label,
          wordLabel: word.label,
          locale: entry.locale,
          length: entry.value.trim().length,
        });
      }
    }
  }

  return warnings;
}

