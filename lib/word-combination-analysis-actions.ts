"use server";

import { requireRole } from "@/lib/auth";
import {
  analyzeDraftWordCombinationLimits,
  analyzeExistingWordCombinationLimits,
  buildWordCombinationWarningSummaries,
  type WordCombinationWarningSummary,
} from "@/lib/word-combination-analysis-data";
import { getWordsCatalog } from "@/lib/admin-catalog";
import type { WordCombinationAnalysisResult } from "@/lib/word-combination-limits";
import type { ParentMatchMode } from "@/lib/word-dependencies";

export async function analyzeDraftWordCombinationsAction(input: {
  categoryLevelId: string;
  label: string;
  referenceCode: string;
  designationPt: string;
  designationEs: string;
  designationEn: string;
  includeInDesignation: boolean;
  parentWordIds: string[];
  parentMatchMode: ParentMatchMode;
  selectionHierarchy: number | null;
  wordId?: string;
}): Promise<WordCombinationAnalysisResult | null> {
  await requireRole("editor");

  const referenceCode = input.referenceCode.trim().toUpperCase();
  if (!referenceCode || referenceCode.length > 3) return null;

  return analyzeDraftWordCombinationLimits({
    categoryLevelId: input.categoryLevelId,
    word: {
      id: input.wordId ?? "__draft_word__",
      label: input.label.trim() || "Nova palavra",
      referenceCode,
      designationPt: input.designationPt.trim(),
      designationEs: input.designationEs.trim(),
      designationEn: input.designationEn.trim(),
      includeInDesignation: input.includeInDesignation,
      parentWordIds: input.parentWordIds,
      parentMatchMode: input.parentMatchMode,
      selectionHierarchy: input.selectionHierarchy,
    },
  });
}

export async function analyzeWordCombinationsByIdAction(
  wordId: string,
): Promise<WordCombinationAnalysisResult | null> {
  await requireRole("editor");

  const words = await getWordsCatalog();
  const word = words.find((item) => item.id === wordId);
  if (!word) return null;

  return analyzeExistingWordCombinationLimits(word);
}

export async function getWordCombinationWarningSummariesAction(): Promise<
  Record<string, WordCombinationWarningSummary>
> {
  await requireRole("viewer");

  const words = await getWordsCatalog();
  const summaries = await buildWordCombinationWarningSummaries(words);
  return Object.fromEntries(summaries.entries());
}
