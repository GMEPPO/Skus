"use server";

import { getWordsCatalog } from "@/lib/admin-catalog";
import { requireRole } from "@/lib/auth";
import {
  analyzeExistingWordCombinationLimits,
  buildWordCombinationWarningSummaries,
} from "@/lib/word-combination-analysis-data";
import {
  buildWordPairFrequencyRanking,
  collectDeduplicatedViolations,
  type WordPairInAlerts,
} from "@/lib/word-combination-frequency";
import type { CombinationLimitViolation } from "@/lib/word-combination-limits";
import type {
  WordCombinationInsightsResult,
  WordCombinationWarningSummary,
  WordPairViolationAnalysis,
} from "@/lib/word-combination-types";
import type { WordListItem } from "@/lib/types";

const INSIGHTS_DEADLINE_MS = 20_000;
const INSIGHTS_MAX_WORDS = 40;

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

function pickInsightCandidateWords(words: WordListItem[]) {
  return words
    .filter((word) => word.categoryLevelId && word.referenceCode !== "000" && word.includeInDesignation)
    .sort((left, right) => {
      const rightScore = right.designationPt.length + right.label.length;
      const leftScore = left.designationPt.length + left.label.length;
      return rightScore - leftScore;
    })
    .slice(0, INSIGHTS_MAX_WORDS);
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

export async function fetchWordCombinationInsightsAction(): Promise<WordCombinationInsightsResult> {
  try {
    await requireRole("viewer");

    const words = await getWordsCatalog();
    const candidates = pickInsightCandidateWords(words);
    const summaries = await buildWordCombinationWarningSummaries(candidates, {
      deadlineMs: INSIGHTS_DEADLINE_MS,
      maxWords: INSIGHTS_MAX_WORDS,
    });

    return {
      pairRanking: buildWordPairFrequencyRanking(summaries, words).slice(0, 25),
      uniqueViolationCount: collectDeduplicatedViolations(summaries).length,
      wordsWithWarnings: summaries.size,
      partial: candidates.length < words.length,
    };
  } catch {
    return {
      pairRanking: [],
      uniqueViolationCount: 0,
      wordsWithWarnings: 0,
      partial: true,
    };
  }
}
