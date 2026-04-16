import type { GeneratorFamily, GeneratorWord } from "@/lib/types";

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

  const allowedIds = new Set(
    family.edges
      .filter(
        (edge) =>
          edge.fromLevelId === previousLevel.id &&
          edge.fromWordId === previousSelection &&
          edge.toLevelId === level.id,
      )
      .map((edge) => edge.toWordId),
  );

  return level.options.filter((option) => allowedIds.has(option.id));
}

export function buildDesignation(
  family: GeneratorFamily,
  selections: Record<string, string>,
) {
  return family.levels
    .map((level) => level.options.find((option) => option.id === selections[level.id])?.label ?? null)
    .filter(Boolean)
    .join(" ");
}

export function buildSkuPreview(
  family: GeneratorFamily,
  selections: Record<string, string>,
  sequenceValue: number,
) {
  const segments = [
    family.name.slice(0, 3).toUpperCase(),
    ...family.levels.map(
      (level) => level.options.find((option) => option.id === selections[level.id])?.referenceCode ?? "---",
    ),
  ];

  return `${segments.join("-")}-${String(sequenceValue).padStart(6, "0")}`;
}
