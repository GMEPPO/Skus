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
import type { CombinationLimitViolation } from "@/lib/word-combination-limits";
import type { WordListItem } from "@/lib/types";

export type WordPairViolationAnalysis = {
  pair: WordPairInAlerts;
  violations: CombinationLimitViolation[];
  violationCount: number;
  truncated: boolean;
  pathsExplored: number;
};

function wordTokenKey(label: string, referenceCode: string) {
  return `${label.trim().toLowerCase()}|${referenceCode.trim().toUpperCase()}`;
}

function violationIncludesPair(violation: CombinationLimitViolation, pair: WordPairInAlerts) {
  const tokens = new Set(
    violation.selections
      .filter(
        (selection) => !(selection.referenceCode === "000" && selection.wordLabel.toLowerCase() === "vazio"),
      )
      .map((selection) => wordTokenKey(selection.wordLabel, selection.referenceCode)),
  );

  return (
    tokens.has(wordTokenKey(pair.left.label, pair.left.referenceCode)) &&
    tokens.has(wordTokenKey(pair.right.label, pair.right.referenceCode))
  );
}

function resolveWordForPair(pair: WordPairInAlerts, words: WordListItem[]): WordListItem | null {
  if (pair.left.wordId) {
    const byLeft = words.find((word) => word.id === pair.left.wordId);
    if (byLeft) return byLeft;
  }
  if (pair.right.wordId) {
    const byRight = words.find((word) => word.id === pair.right.wordId);
    if (byRight) return byRight;
  }

  const leftMatch = words.find(
    (word) => wordTokenKey(word.label, word.referenceCode) === wordTokenKey(pair.left.label, pair.left.referenceCode),
  );
  if (leftMatch) return leftMatch;

  return (
    words.find(
      (word) =>
        wordTokenKey(word.label, word.referenceCode) === wordTokenKey(pair.right.label, pair.right.referenceCode),
    ) ?? null
  );
}

export async function analyzeWordCombinationWarningsForWordAction(
  word: WordListItem,
): Promise<WordCombinationWarningSummary | null> {
  await requireRole("viewer");

  const result = await analyzeExistingWordCombinationLimits(word);
  if (!result || result.totalViolationsFound === 0) return null;

  return {
    wordId: word.id,
    violationCount: result.totalViolationsFound,
    violations: result.violations,
    truncated: result.truncated,
    pathsExplored: result.pathsExplored,
  };
}

export async function analyzeWordPairViolationsAction(
  pair: WordPairInAlerts,
): Promise<WordPairViolationAnalysis | null> {
  await requireRole("viewer");

  const words = await getWordsCatalog();
  const anchorWord = resolveWordForPair(pair, words);
  if (!anchorWord) return null;

  const result = await analyzeExistingWordCombinationLimits(anchorWord);
  if (!result) return null;

  const violations = result.violations.filter((violation) => violationIncludesPair(violation, pair));
  if (violations.length === 0) return null;

  return {
    pair,
    violations,
    violationCount: violations.length,
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
