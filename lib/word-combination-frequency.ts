import type { WordCombinationWarningSummary } from "@/lib/word-combination-analysis-data";
import type { WordListItem } from "@/lib/types";

export type WordFrequencyInAlerts = {
  wordId: string | null;
  label: string;
  referenceCode: string;
  levelLabel: string;
  count: number;
};

function lookupWordId(
  wordsByLabelRef: Map<string, string>,
  label: string,
  referenceCode: string,
): string | null {
  return wordsByLabelRef.get(`${label.trim().toLowerCase()}|${referenceCode.trim().toUpperCase()}`) ?? null;
}

export function buildWordFrequencyRanking(
  summaries: Map<string, WordCombinationWarningSummary>,
  words: WordListItem[],
): WordFrequencyInAlerts[] {
  const wordsById = new Map(words.map((word) => [word.id, word]));
  const wordsByLabelRef = new Map(
    words.map((word) => [`${word.label.trim().toLowerCase()}|${word.referenceCode.trim().toUpperCase()}`, word.id]),
  );
  const counts = new Map<string, WordFrequencyInAlerts>();

  function bump(wordId: string | null, label: string, referenceCode: string, levelLabel: string) {
    const key = wordId ?? `${label.trim().toLowerCase()}|${referenceCode.trim().toUpperCase()}|${levelLabel}`;
    const existing = counts.get(key);
    if (existing) {
      existing.count += 1;
      return;
    }
    counts.set(key, {
      wordId,
      label,
      referenceCode,
      levelLabel,
      count: 1,
    });
  }

  for (const [wordId, summary] of summaries) {
    const targetWord = wordsById.get(wordId);
    for (const violation of summary.violations) {
      for (const selection of violation.selections) {
        if (selection.referenceCode === "000" && selection.wordLabel.toLowerCase() === "vazio") {
          continue;
        }
        const matchedWordId = lookupWordId(wordsByLabelRef, selection.wordLabel, selection.referenceCode);
        bump(
          matchedWordId,
          selection.wordLabel,
          selection.referenceCode,
          selection.levelLabel || targetWord?.fieldTypeLabel || "—",
        );
      }
    }
  }

  return [...counts.values()].sort((left, right) => {
    if (right.count !== left.count) return right.count - left.count;
    return left.label.localeCompare(right.label, "pt");
  });
}
