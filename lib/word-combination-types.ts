import type { CombinationLimitViolation } from "@/lib/word-combination-limits";
import type { WordPairInAlerts } from "@/lib/word-combination-frequency";

export type WordCombinationWarningSummary = {
  wordId: string;
  violationCount: number;
  violations: CombinationLimitViolation[];
  truncated: boolean;
  pathsExplored: number;
};

export type WordPairViolationAnalysis = {
  pair: WordPairInAlerts;
  violations: CombinationLimitViolation[];
  violationCount: number;
  truncated: boolean;
  pathsExplored: number;
};

export type WordCombinationInsightsResult = {
  pairRanking: WordPairInAlerts[];
  uniqueViolationCount: number;
  wordsWithWarnings: number;
  partial: boolean;
};
