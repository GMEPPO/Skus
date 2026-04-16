import type { GeneratorFamily, GeneratorWord } from "@/lib/types";

export const MAX_DESIGNATION_LENGTH = 60;

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

  const levelEdges = family.edges.filter(
    (edge) => edge.fromLevelId === previousLevel.id && edge.toLevelId === level.id,
  );

  // Fallback: se não há dependências configuradas entre os dois níveis,
  // libera todas as opções do nível atual.
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
