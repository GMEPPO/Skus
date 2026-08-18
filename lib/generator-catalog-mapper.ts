import type { GeneratorCatalogForCategory } from "@/lib/category-catalog";
import type { GeneratorCatalog } from "@/lib/types";

export function mapCategoryCatalogToGeneratorCatalog(categoryCatalog: GeneratorCatalogForCategory): GeneratorCatalog {
  return {
    categoryId: categoryCatalog.category.id,
    parentEdges: categoryCatalog.parentEdges,
    levels: categoryCatalog.levels.map((level, index) => ({
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
    })),
  };
}
