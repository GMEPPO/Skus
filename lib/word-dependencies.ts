import type { GeneratorCatalog, GeneratorLevel, GeneratorWord } from "@/lib/types";

export type ParentMatchMode = "any" | "all";

export type WordParentEdge = {
  childWordId: string;
  parentWordId: string;
};

export type WordDependencyFormValues = {
  visibilityMode: "always" | "conditional";
  parentWordIds: string[];
  parentMatchMode: ParentMatchMode;
  selectionHierarchy: number | null;
};

export function parseWordDependencyFormData(formData: FormData): WordDependencyFormValues {
  const visibilityMode = formData.get("visibilityMode") === "conditional" ? "conditional" : "always";
  const parentMatchMode = formData.get("parentMatchMode") === "all" ? "all" : "any";
  const hierarchyRaw = String(formData.get("selectionHierarchy") ?? "").trim();
  const selectionHierarchy =
    hierarchyRaw === "1" || hierarchyRaw === "2" ? Number(hierarchyRaw) : null;

  const parentWordIds = formData
    .getAll("parentWordIds")
    .map((value) => String(value).trim())
    .filter(Boolean);

  return {
    visibilityMode,
    parentWordIds: visibilityMode === "conditional" ? [...new Set(parentWordIds)] : [],
    parentMatchMode,
    selectionHierarchy,
  };
}

export function wordHasDependencyRules(word: Pick<GeneratorWord, "parentWordIds">) {
  return (word.parentWordIds?.length ?? 0) > 0;
}

function isEmptySelection(value?: string) {
  return Boolean(value && value.startsWith("__empty__:"));
}

function isParentSelected(parentWordId: string, selections: Record<string, string>, catalog: GeneratorCatalog) {
  for (const level of catalog.levels) {
    const selectedId = selections[level.id];
    if (!selectedId || isEmptySelection(selectedId)) continue;
    if (selectedId === parentWordId) return true;
  }
  return false;
}

export function isWordVisibleByDependencies(
  word: GeneratorWord,
  selections: Record<string, string>,
  catalog: GeneratorCatalog,
): boolean {
  if (!wordHasDependencyRules(word)) return true;

  const parentIds = word.parentWordIds ?? [];
  if (parentIds.length === 0) return true;

  const matches = parentIds.filter((parentId) => isParentSelected(parentId, selections, catalog));
  if (word.parentMatchMode === "all") {
    return matches.length === parentIds.length;
  }
  return matches.length > 0;
}

function packagingHierarchyOneSelected(catalog: GeneratorCatalog, selections: Record<string, string>) {
  const packagingLevel = catalog.levels.find((level) => level.fieldType === "packaging");
  if (!packagingLevel) return false;

  const selectedId = selections[packagingLevel.id];
  if (!selectedId || isEmptySelection(selectedId)) return false;

  const selected = packagingLevel.options.find((option) => option.id === selectedId);
  return Boolean(selected && selected.selectionHierarchy === 1);
}

export function isWordVisibleInGenerator(
  word: GeneratorWord,
  level: GeneratorLevel,
  catalog: GeneratorCatalog,
  selections: Record<string, string>,
): boolean {
  if (!isWordVisibleByDependencies(word, selections, catalog)) {
    return false;
  }

  if (level.fieldType === "packaging" && word.selectionHierarchy === 2) {
    return false;
  }

  if (level.fieldType === "extra" && word.selectionHierarchy === 2) {
    return !packagingHierarchyOneSelected(catalog, selections);
  }

  if (level.fieldType === "packaging" && word.selectionHierarchy === 1) {
    return true;
  }

  return true;
}

export function getVisibleOptionsForLevel(
  catalog: GeneratorCatalog,
  levelId: string,
  selections: Record<string, string>,
): GeneratorWord[] {
  const level = catalog.levels.find((entry) => entry.id === levelId);
  if (!level) return [];

  return level.options.filter((word) => isWordVisibleInGenerator(word, level, catalog, selections));
}

export function pruneInvalidDownstreamSelections(
  catalog: GeneratorCatalog,
  selections: Record<string, string>,
  changedLevelId: string,
): Record<string, string> {
  const changedIndex = catalog.levels.findIndex((level) => level.id === changedLevelId);
  if (changedIndex < 0) return selections;

  const next = { ...selections };
  for (const level of catalog.levels.slice(changedIndex + 1)) {
    const selectedId = next[level.id];
    if (!selectedId || isEmptySelection(selectedId)) continue;

    const selectedWord = level.options.find((option) => option.id === selectedId);
    if (!selectedWord) {
      delete next[level.id];
      continue;
    }

    if (!isWordVisibleInGenerator(selectedWord, level, catalog, next)) {
      delete next[level.id];
    }
  }

  return next;
}

export function buildParentWordLabels(parentWordIds: string[], catalog: GeneratorCatalog) {
  const labels: string[] = [];
  for (const parentId of parentWordIds) {
    for (const level of catalog.levels) {
      const parent = level.options.find((option) => option.id === parentId);
      if (parent) {
        labels.push(`${parent.label} (${parent.referenceCode})`);
        break;
      }
    }
  }
  return labels;
}
