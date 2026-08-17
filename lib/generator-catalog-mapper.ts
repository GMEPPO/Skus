import type { GeneratorCatalogForCategory } from "@/lib/category-catalog";
import type { GeneratorCatalog, GeneratorLevel, GeneratorWord } from "@/lib/types";

function isHierarchyTwoWord(word: Pick<GeneratorWord, "selectionHierarchy">) {
  return Number(word.selectionHierarchy) === 2;
}

function mapWordOption(option: GeneratorCatalogForCategory["levels"][number]["options"][number]): GeneratorWord {
  return {
    id: option.id,
    label: option.label,
    referenceCode: option.referenceCode,
    designation: option.designationPt,
    designationPt: option.designationPt,
    designationEs: option.designationEs,
    designationEn: option.designationEn,
    includeInDesignation: option.includeInDesignation,
    parentWordIds: option.parentWordIds,
    parentMatchMode: option.parentMatchMode,
    selectionHierarchy: option.selectionHierarchy,
  };
}

/** Hierarchy-2 words are selectable at packaging (nivel 5) and fallback to extra (nivel 6). */
export function mirrorHierarchyTwoWordsOnPackagingAndExtra(levels: GeneratorLevel[]): GeneratorLevel[] {
  const packagingLevel = levels.find((level) => level.fieldType === "packaging");
  const extraLevel = levels.find((level) => level.fieldType === "extra");
  if (!packagingLevel || !extraLevel) return levels;

  const hierarchyTwoWords: GeneratorWord[] = [];
  const seenIds = new Set<string>();

  for (const word of [...packagingLevel.options, ...extraLevel.options]) {
    if (!isHierarchyTwoWord(word) || seenIds.has(word.id)) continue;
    seenIds.add(word.id);
    hierarchyTwoWords.push(word);
  }

  if (hierarchyTwoWords.length === 0) return levels;

  const packagingIds = new Set(packagingLevel.options.map((word) => word.id));
  const extraIds = new Set(extraLevel.options.map((word) => word.id));

  const nextPackagingOptions = [
    ...packagingLevel.options,
    ...hierarchyTwoWords.filter((word) => !packagingIds.has(word.id)),
  ];
  const nextExtraOptions = [
    ...extraLevel.options,
    ...hierarchyTwoWords.filter((word) => !extraIds.has(word.id)),
  ];

  return levels.map((level) => {
    if (level.id === packagingLevel.id) {
      return { ...level, options: nextPackagingOptions };
    }
    if (level.id === extraLevel.id) {
      return { ...level, options: nextExtraOptions };
    }
    return level;
  });
}

export function mapCategoryCatalogToGeneratorCatalog(categoryCatalog: GeneratorCatalogForCategory): GeneratorCatalog {
  const levels = categoryCatalog.levels.map((level, index) => ({
    id: level.id,
    order: index + 1,
    fieldType: level.key,
    fieldTypeId: level.legacyFieldTypeId,
    label: level.label,
    options: level.options.map(mapWordOption),
  }));

  return {
    categoryId: categoryCatalog.category.id,
    parentEdges: categoryCatalog.parentEdges,
    levels: mirrorHierarchyTwoWordsOnPackagingAndExtra(levels),
  };
}
