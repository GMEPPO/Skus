"use server";

import { getGeneratorCatalogForCategory } from "@/lib/category-catalog";
import { mapCategoryCatalogToGeneratorCatalog } from "@/lib/generator-catalog-mapper";
import { createSupabaseServiceServerClient } from "@/lib/supabase-service-server";
import type { GeneratorCatalog } from "@/lib/types";
import type { WordListItem } from "@/lib/types";
import {
  analyzeWordCombinationLimits,
  injectWordIntoCatalog,
  type WordCandidateForAnalysis,
  type WordCombinationAnalysisResult,
} from "@/lib/word-combination-limits";

async function resolveCategoryIdForLevel(categoryLevelId: string | null): Promise<string | null> {
  if (!categoryLevelId) return null;

  const supabase = createSupabaseServiceServerClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("skus_category_levels")
    .select("category_id")
    .eq("id", categoryLevelId)
    .maybeSingle();

  if (error || !data) return null;
  return String(data.category_id);
}

export async function getGeneratorCatalogForCategoryLevel(
  categoryLevelId: string | null,
): Promise<GeneratorCatalog | null> {
  const categoryId = await resolveCategoryIdForLevel(categoryLevelId);
  if (!categoryId) return null;

  const categoryCatalog = await getGeneratorCatalogForCategory(categoryId);
  if (!categoryCatalog) return null;

  return mapCategoryCatalogToGeneratorCatalog(categoryCatalog);
}

export async function analyzeExistingWordCombinationLimits(
  word: WordListItem,
): Promise<WordCombinationAnalysisResult | null> {
  if (!word.categoryLevelId || word.referenceCode === "000") {
    return null;
  }

  const catalog = await getGeneratorCatalogForCategoryLevel(word.categoryLevelId);
  if (!catalog) return null;

  return analyzeWordCombinationLimits(catalog, word.categoryLevelId, word.id);
}

export async function analyzeDraftWordCombinationLimits(input: {
  categoryLevelId: string;
  word: WordCandidateForAnalysis;
}): Promise<WordCombinationAnalysisResult | null> {
  const catalog = await getGeneratorCatalogForCategoryLevel(input.categoryLevelId);
  if (!catalog) return null;

  const catalogWithDraft = injectWordIntoCatalog(catalog, input.categoryLevelId, input.word);
  return analyzeWordCombinationLimits(catalogWithDraft, input.categoryLevelId, input.word.id);
}

export type WordCombinationWarningSummary = {
  wordId: string;
  violationCount: number;
  violations: WordCombinationAnalysisResult["violations"];
  truncated: boolean;
  pathsExplored: number;
};

export async function buildWordCombinationWarningSummaries(
  words: WordListItem[],
): Promise<Map<string, WordCombinationWarningSummary>> {
  const summaries = new Map<string, WordCombinationWarningSummary>();
  const catalogByCategoryId = new Map<string, GeneratorCatalog>();
  const categoryIdByLevel = new Map<string, string>();

  for (const word of words) {
    if (!word.categoryLevelId || word.referenceCode === "000") continue;

    let categoryId = categoryIdByLevel.get(word.categoryLevelId);
    if (!categoryId) {
      const resolved = await resolveCategoryIdForLevel(word.categoryLevelId);
      if (!resolved) continue;
      categoryId = resolved;
      categoryIdByLevel.set(word.categoryLevelId, categoryId);
    }

    let catalog = catalogByCategoryId.get(categoryId);
    if (!catalog) {
      const categoryCatalog = await getGeneratorCatalogForCategory(categoryId);
      if (!categoryCatalog) continue;
      catalog = mapCategoryCatalogToGeneratorCatalog(categoryCatalog);
      catalogByCategoryId.set(categoryId, catalog);
    }

    const result = analyzeWordCombinationLimits(catalog, word.categoryLevelId, word.id);
    if (result.violations.length === 0) continue;

    summaries.set(word.id, {
      wordId: word.id,
      violationCount: result.violations.length,
      violations: result.violations,
      truncated: result.truncated,
      pathsExplored: result.pathsExplored,
    });
  }

  return summaries;
}
