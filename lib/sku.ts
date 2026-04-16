import type { GeneratorFamily, GeneratorWord } from "@/lib/types";

export const MAX_DESIGNATION_LENGTH = 60;
export const EMPTY_SELECTION_PREFIX = "__empty__:";

export function buildEmptySelectionId(levelId: string) {
  return `${EMPTY_SELECTION_PREFIX}${levelId}`;
}

export function isEmptySelection(value?: string) {
  return Boolean(value && value.startsWith(EMPTY_SELECTION_PREFIX));
}

export function getAvailableOptions(
  family: GeneratorFamily,
  levelId: string,
  selections: Record<string, string>,
): GeneratorWord[] {
  const level = family.levels.find((item) => item.id === levelId);
  if (!level) return [];

  if (level.order === 1) {
    return level.options;
  }

  const previousLevel = family.levels.find((item) => item.order === level.order - 1);
  if (!previousLevel) return level.options;

  const previousSelection = selections[previousLevel.id];
  if (!previousSelection) return [];
  if (isEmptySelection(previousSelection)) return [];

  const optionsWithDependencies = level.options.filter((option) => option.parentWordIds.length > 0);
  if (optionsWithDependencies.length > 0) {
    return level.options.filter((option) => option.parentWordIds.includes(previousSelection));
  }

  const levelEdges = family.edges.filter(
    (edge) => edge.fromLevelId === previousLevel.id && edge.toLevelId === level.id,
  );

  if (levelEdges.length === 0) {
    return level.options;
  }

  const allowedIds = new Set(
    levelEdges.filter((edge) => edge.fromWordId === previousSelection).map((edge) => edge.toWordId),
  );

  return level.options.filter((option) => allowedIds.has(option.id));
}

export function buildDesignation(
  family: GeneratorFamily,
  selections: Record<string, string>,
) {
  const segments = family.levels
    .map((level) => {
      const selectedValue = selections[level.id];
      if (isEmptySelection(selectedValue)) return null;
      const option = level.options.find((item) => item.id === selections[level.id]);
      if (!option || !option.includeInDesignation) return null;
      return option.designation || option.label;
    })
    .filter((value): value is string => Boolean(value));

  const designation = [family.name, ...segments].join(" ").trim();
  return designation.replace(/\s+/g, " ");
}

export function buildSkuPreview(
  family: GeneratorFamily,
  selections: Record<string, string>,
) {
  const segments = [
    family.name.slice(0, 3).toUpperCase(),
    ...family.levels.map(
      (level) => {
        const selectedValue = selections[level.id];
        if (isEmptySelection(selectedValue)) return "000";
        return level.options.find((option) => option.id === selectedValue)?.referenceCode ?? "000";
      },
    ),
  ];

  return segments.join("-");
}
