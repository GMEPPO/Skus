"use server";

import { getWordsCatalog } from "@/lib/admin-catalog";
import { requireRole } from "@/lib/auth";
import {
  analyzeExistingWordCombinationLimits,
  buildWordCombinationWarningSummaries,
  type WordCombinationWarningSummary,
} from "@/lib/word-combination-analysis-data";
import { buildWordFrequencyRanking, type WordFrequencyInAlerts } from "@/lib/word-combination-frequency";
import type { WordListItem } from "@/lib/types";

export async function analyzeWordCombinationWarningsForWordAction(
  word: WordListItem,
): Promise<WordCombinationWarningSummary | null> {
  await requireRole("viewer");

  const result = await analyzeExistingWordCombinationLimits(word);
  if (!result || result.violations.length === 0) return null;

  return {
    wordId: word.id,
    violationCount: result.violations.length,
    violations: result.violations,
    truncated: result.truncated,
    pathsExplored: result.pathsExplored,
  };
}

export async function fetchWordCombinationInsightsAction(): Promise<{
  frequencyRanking: WordFrequencyInAlerts[];
  wordsWithWarnings: number;
}> {
  await requireRole("viewer");

  const words = await getWordsCatalog();
  const summaries = await buildWordCombinationWarningSummaries(words);

  return {
    frequencyRanking: buildWordFrequencyRanking(summaries, words).slice(0, 30),
    wordsWithWarnings: summaries.size,
  };
}
