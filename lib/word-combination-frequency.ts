import type { WordCombinationWarningSummary } from "@/lib/word-combination-analysis-data";
import type { CombinationLimitViolation, CombinationSelectionSummary } from "@/lib/word-combination-limits";
import { MAX_DESIGNATION_LENGTH } from "@/lib/sku";
import type { WordListItem } from "@/lib/types";

export type WordPairPart = {
  wordId: string | null;
  label: string;
  referenceCode: string;
  levelLabel: string;
};

export type WordPairInAlerts = {
  left: WordPairPart;
  right: WordPairPart;
  count: number;
  avgOverrun: number;
  failedLocales: Array<"pt" | "es" | "en">;
};

type WordToken = WordPairPart;

function isEmptySelection(selection: CombinationSelectionSummary) {
  return selection.referenceCode === "000" && selection.wordLabel.toLowerCase() === "vazio";
}

function lookupWordMeta(
  wordsByLabelRef: Map<string, WordListItem>,
  label: string,
  referenceCode: string,
): WordListItem | undefined {
  return wordsByLabelRef.get(`${label.trim().toLowerCase()}|${referenceCode.trim().toUpperCase()}`);
}

function selectionSignature(selections: CombinationSelectionSummary[]) {
  return selections.map((entry) => `${entry.levelLabel}|${entry.referenceCode}|${entry.wordLabel}`).join("||");
}

function violationSignature(violation: CombinationLimitViolation) {
  return selectionSignature(violation.selections);
}

export function collectDeduplicatedViolations(
  summaries: Map<string, WordCombinationWarningSummary>,
): CombinationLimitViolation[] {
  const seen = new Set<string>();
  const violations: CombinationLimitViolation[] = [];

  for (const summary of summaries.values()) {
    for (const violation of summary.violations) {
      const signature = violationSignature(violation);
      if (seen.has(signature)) continue;
      seen.add(signature);
      violations.push(violation);
    }
  }

  return violations;
}

function tokenFromSelection(
  selection: CombinationSelectionSummary,
  wordsByLabelRef: Map<string, WordListItem>,
): WordToken | null {
  if (isEmptySelection(selection)) return null;

  const word = lookupWordMeta(wordsByLabelRef, selection.wordLabel, selection.referenceCode);
  if (word && !word.includeInDesignation) return null;

  return {
    wordId: word?.id ?? null,
    label: selection.wordLabel,
    referenceCode: selection.referenceCode,
    levelLabel: selection.levelLabel,
  };
}

function canonicalPairKey(left: WordToken, right: WordToken) {
  const leftKey = `${left.label.toLowerCase()}|${left.referenceCode}|${left.levelLabel}`;
  const rightKey = `${right.label.toLowerCase()}|${right.referenceCode}|${right.levelLabel}`;
  return leftKey <= rightKey ? `${leftKey}::${rightKey}` : `${rightKey}::${leftKey}`;
}

function maxDesignationOverrun(violation: CombinationLimitViolation): number {
  let overrun = 0;

  if (violation.exceededDesignationLocales.includes("pt")) {
    overrun = Math.max(overrun, violation.designationPtLength - MAX_DESIGNATION_LENGTH);
  }
  if (violation.exceededDesignationLocales.includes("es")) {
    overrun = Math.max(overrun, violation.designationEsLength - MAX_DESIGNATION_LENGTH);
  }
  if (violation.exceededDesignationLocales.includes("en")) {
    overrun = Math.max(overrun, violation.designationEnLength - MAX_DESIGNATION_LENGTH);
  }

  return overrun;
}

function mergeFailedLocales(
  existing: Array<"pt" | "es" | "en">,
  violation: CombinationLimitViolation,
): Array<"pt" | "es" | "en"> {
  const locales = new Set(existing);
  for (const locale of violation.exceededDesignationLocales) {
    locales.add(locale);
  }
  return [...locales];
}

export function buildWordPairFrequencyRanking(
  summaries: Map<string, WordCombinationWarningSummary>,
  words: WordListItem[],
): WordPairInAlerts[] {
  const wordsByLabelRef = new Map(
    words.map((word) => [`${word.label.trim().toLowerCase()}|${word.referenceCode.trim().toUpperCase()}`, word]),
  );
  const violations = collectDeduplicatedViolations(summaries);
  const pairStats = new Map<string, WordPairInAlerts & { overrunTotal: number }>();

  for (const violation of violations) {
    const tokens = violation.selections
      .map((selection) => tokenFromSelection(selection, wordsByLabelRef))
      .filter((token): token is WordToken => token !== null);

    if (tokens.length < 2) continue;

    const overrun = maxDesignationOverrun(violation);

    for (let leftIndex = 0; leftIndex < tokens.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < tokens.length; rightIndex += 1) {
        const left = tokens[leftIndex];
        const right = tokens[rightIndex];
        const key = canonicalPairKey(left, right);
        const existing = pairStats.get(key);

        if (existing) {
          existing.count += 1;
          existing.overrunTotal += overrun;
          existing.failedLocales = mergeFailedLocales(existing.failedLocales, violation);
          continue;
        }

        pairStats.set(key, {
          left,
          right,
          count: 1,
          avgOverrun: 0,
          overrunTotal: overrun,
          failedLocales: [...violation.exceededDesignationLocales],
        });
      }
    }
  }

  return [...pairStats.values()]
    .map(({ overrunTotal, ...entry }) => ({
      ...entry,
      avgOverrun: entry.count > 0 ? Math.round(overrunTotal / entry.count) : 0,
    }))
    .sort((left, right) => {
      if (right.count !== left.count) return right.count - left.count;
      if (right.avgOverrun !== left.avgOverrun) return right.avgOverrun - left.avgOverrun;
      return left.left.label.localeCompare(right.left.label, "pt");
    });
}
