import type { GeneratorCatalogForCategory } from "@/lib/category-catalog";
import type { GeneratorCatalog, GeneratorLevel } from "@/lib/types";

/** Copia palavras H2 do nivel extra para packaging (mesmo id), para poder escolher em 5 ou 6. */
export function mirrorHierarchyTwoWordsOnPackagingAndExtra(levels: GeneratorLevel[]): GeneratorLevel[] {
  const packagingLevel = levels.find((level) => level.fieldType === "packaging");
  const extraLevel = levels.find((level) => level.fieldType === "extra");
  if (!packagingLevel || !extraLevel) return levels;

  const hierarchyTwoWords = extraLevel.options.filter((word) => Number(word.selectionHierarchy) === 2);
  if (hierarchyTwoWords.length === 0) return levels;

  const packagingIds = new Set(packagingLevel.options.map((word) => word.id));
  const mirroredWords = hierarchyTwoWords.filter((word) => !packagingIds.has(word.id));

  if (mirroredWords.length === 0) return levels;

  return levels.map((level) => {
    if (level.fieldType !== "packaging") return level;
    return {
      ...level,
      options: [...level.options, ...mirroredWords],
    };
  });
}

export function mapCategoryCatalogToGeneratorCatalog(categoryCatalog: GeneratorCatalogForCategory): GeneratorCatalog {
  const levels = categoryCatalog.levels.map((level, index) => ({
    id: level.id,
    order: index + 1,
    fieldType: level.key,
    fieldTypeId: level.legacyFieldTypeId,
    label: level.label,
    isRequired: level.isRequired,
    options: level.options.map((option) => ({
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
    })),
  }));

  return {
    categoryId: categoryCatalog.category.id,
    parentEdges: categoryCatalog.parentEdges,
    levels: mirrorHierarchyTwoWordsOnPackagingAndExtra(levels),
  };
}
