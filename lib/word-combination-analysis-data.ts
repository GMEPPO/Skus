import { getGeneratorCatalogForCategory } from "@/lib/category-catalog";
import { mapCategoryCatalogToGeneratorCatalog } from "@/lib/generator-catalog-mapper";
import { createSupabaseServiceServerClient } from "@/lib/supabase-service-server";
import type { GeneratorCatalog } from "@/lib/types";
import type { WordListItem } from "@/lib/types";
import {
  analyzeWordCombinationLimits,
  BACKGROUND_COMBINATION_ANALYSIS_OPTIONS,
  DETAILED_COMBINATION_ANALYSIS_OPTIONS,
  injectWordIntoCatalog,
  type CombinationAnalysisOptions,
  type WordCandidateForAnalysis,
  type WordCombinationAnalysisResult,
} from "@/lib/word-combination-limits";
import type { WordCombinationWarningSummary } from "@/lib/word-combination-types";

export type { WordCombinationWarningSummary };

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
  options: CombinationAnalysisOptions = DETAILED_COMBINATION_ANALYSIS_OPTIONS,
): Promise<WordCombinationAnalysisResult | null> {
  if (!word.categoryLevelId || word.referenceCode === "000") {
    return null;
  }

  const catalog = await getGeneratorCatalogForCategoryLevel(word.categoryLevelId);
  if (!catalog) return null;

  return analyzeWordCombinationLimits(catalog, word.categoryLevelId, word.id, options);
}

export async function analyzeDraftWordCombinationLimits(input: {
  categoryLevelId: string;
  word: WordCandidateForAnalysis;
}): Promise<WordCombinationAnalysisResult | null> {
  const catalog = await getGeneratorCatalogForCategoryLevel(input.categoryLevelId);
  if (!catalog) return null;

  const catalogWithDraft = injectWordIntoCatalog(catalog, input.categoryLevelId, input.word);
  return analyzeWordCombinationLimits(
    catalogWithDraft,
    input.categoryLevelId,
    input.word.id,
    DETAILED_COMBINATION_ANALYSIS_OPTIONS,
  );
}

export async function buildWordCombinationWarningSummaries(
  words: WordListItem[],
  options?: { deadlineMs?: number; maxWords?: number },
): Promise<Map<string, WordCombinationWarningSummary>> {
  const summaries = new Map<string, WordCombinationWarningSummary>();
  const catalogByCategoryId = new Map<string, GeneratorCatalog>();
  const categoryIdByLevel = new Map<string, string>();
  const deadline = Date.now() + (options?.deadlineMs ?? Number.POSITIVE_INFINITY);
  const maxWords = options?.maxWords ?? words.length;
  let processedWords = 0;

  for (const word of words) {
    if (processedWords >= maxWords || Date.now() >= deadline) break;
    if (!word.categoryLevelId || word.referenceCode === "000") continue;
    processedWords += 1;

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

    const result = analyzeWordCombinationLimits(
      catalog,
      word.categoryLevelId,
      word.id,
      BACKGROUND_COMBINATION_ANALYSIS_OPTIONS,
    );
    if (result.violations.length === 0) continue;

    summaries.set(word.id, {
      wordId: word.id,
      violationCount: result.totalViolationsFound,
      violations: result.violations,
      truncated: result.truncated,
      pathsExplored: result.pathsExplored,
    });
  }

  return summaries;
}
