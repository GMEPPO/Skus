"use server";

import { getWordsCatalog } from "@/lib/admin-catalog";
import { requireRole } from "@/lib/auth";
import {
  analyzeExistingWordCombinationLimits,
  buildWordCombinationWarningSummaries,
  type WordCombinationWarningSummary,
} from "@/lib/word-combination-analysis-data";
import {
  buildWordPairFrequencyRanking,
  collectDeduplicatedViolations,
  type WordPairInAlerts,
} from "@/lib/word-combination-frequency";
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
  pairRanking: WordPairInAlerts[];
  uniqueViolationCount: number;
  wordsWithWarnings: number;
}> {
  await requireRole("viewer");

  const words = await getWordsCatalog();
  const summaries = await buildWordCombinationWarningSummaries(words);

  return {
    pairRanking: buildWordPairFrequencyRanking(summaries, words).slice(0, 25),
    uniqueViolationCount: collectDeduplicatedViolations(summaries).length,
    wordsWithWarnings: summaries.size,
  };
}
