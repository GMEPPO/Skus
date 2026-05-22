import type { GeneratorCatalog, GeneratorWord } from "@/lib/types";

export const MAX_DESIGNATION_LENGTH = 60;
export const EMPTY_SELECTION_PREFIX = "__empty__:";
type DesignationLocale = "pt" | "es" | "en";

export function buildEmptySelectionId(levelId: string) {
  return `${EMPTY_SELECTION_PREFIX}${levelId}`;
}

export function isEmptySelection(value?: string) {
  return Boolean(value && value.startsWith(EMPTY_SELECTION_PREFIX));
}

export function getAvailableOptions(
  catalog: GeneratorCatalog,
  levelId: string,
): GeneratorWord[] {
  return catalog.levels.find((item) => item.id === levelId)?.options ?? [];
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
      if (!option || !option.includeInDesignation) return null;
      if (locale === "en") return option.designationEn || option.designation || option.label;
      if (locale === "es") return option.designationEs || option.designation || option.label;
      return option.designationPt || option.designation || option.label;
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
    return level.options.find((option) => option.id === selectedValue)?.referenceCode ?? "000";
  });

  return segments.join("-");
}

