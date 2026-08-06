"use server";

import { getGeneratorCatalogForCategory } from "@/lib/category-catalog";
import { mapCategoryCatalogToGeneratorCatalog } from "@/lib/generator-catalog-mapper";
import type { GeneratorCatalog } from "@/lib/types";

export async function fetchGeneratorCatalogAction(
  categoryId: string,
): Promise<{ ok: true; catalog: GeneratorCatalog } | { ok: false; message: string }> {
  const categoryCatalog = await getGeneratorCatalogForCategory(categoryId);
  if (!categoryCatalog) {
    return { ok: false, message: "Categoria nao encontrada ou sem niveis ativos." };
  }
  return { ok: true, catalog: mapCategoryCatalogToGeneratorCatalog(categoryCatalog) };
}
