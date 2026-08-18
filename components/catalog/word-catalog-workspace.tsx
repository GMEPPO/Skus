"use client";

import { useCallback, useEffect, useState } from "react";
import { NormalizationPaginationControls } from "@/components/generator/normalization-pagination-controls";
import { useDebouncedValue } from "@/components/generator/use-debounced-value";
import { WordCatalogList } from "@/components/catalog/word-catalog-list";
import { WordCombinationFrequencyDock } from "@/components/catalog/word-combination-frequency-dock";
import type { FieldTypeOption } from "@/lib/admin-catalog";
import {
  analyzeWordCombinationWarningsForWordAction,
  fetchWordCombinationInsightsAction,
} from "@/lib/word-combination-insights-actions";
import { countWordsCatalogAction, searchWordsCatalogAction } from "@/lib/word-catalog-search-actions";
import type { WordCombinationWarningSummary } from "@/lib/word-combination-analysis-data";
import type { WordPairInAlerts } from "@/lib/word-combination-frequency";
import type { WordListItem } from "@/lib/types";

export function WordCatalogWorkspace({
  fieldTypes,
  showManageActions = true,
  deleteAction,
}: {
  fieldTypes: FieldTypeOption[];
  showManageActions?: boolean;
  deleteAction?: (formData: FormData) => void | Promise<void>;
}) {
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query);
  const [words, setWords] = useState<WordListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [catalogTotal, setCatalogTotal] = useState<number | null>(null);
  const [combinationWarnings, setCombinationWarnings] = useState<Record<string, WordCombinationWarningSummary>>(
    {},
  );
  const [loadingWarningIds, setLoadingWarningIds] = useState<Set<string>>(new Set());
  const [analyzedNoWarningIds, setAnalyzedNoWarningIds] = useState<Set<string>>(new Set());
  const [pairRanking, setPairRanking] = useState<WordPairInAlerts[]>([]);
  const [uniqueViolationCount, setUniqueViolationCount] = useState(0);
  const [wordsWithWarnings, setWordsWithWarnings] = useState(0);
  const [insightsLoading, setInsightsLoading] = useState(true);

  const loadWords = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await searchWordsCatalogAction({ page, query: debouncedQuery });
      setWords(result.items);
      setTotal(result.total);
      setTotalPages(result.totalPages);
      if (page > result.totalPages && result.totalPages > 0) {
        setPage(result.totalPages);
      }
    } finally {
      setIsLoading(false);
    }
  }, [debouncedQuery, page]);

  useEffect(() => {
    void loadWords();
  }, [loadWords]);

  useEffect(() => {
    setPage(1);
  }, [debouncedQuery]);

  useEffect(() => {
    let cancelled = false;
    void countWordsCatalogAction().then((count) => {
      if (!cancelled) setCatalogTotal(count);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setInsightsLoading(true);
    void fetchWordCombinationInsightsAction()
      .then((result) => {
        if (cancelled) return;
        setPairRanking(result.pairRanking);
        setUniqueViolationCount(result.uniqueViolationCount);
        setWordsWithWarnings(result.wordsWithWarnings);
      })
      .finally(() => {
        if (!cancelled) setInsightsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleRequestWordWarnings(word: WordListItem) {
    if (combinationWarnings[word.id] || loadingWarningIds.has(word.id) || analyzedNoWarningIds.has(word.id)) {
      return;
    }

    setLoadingWarningIds((current) => new Set(current).add(word.id));
    try {
      const summary = await analyzeWordCombinationWarningsForWordAction(word);
      if (summary) {
        setCombinationWarnings((current) => ({ ...current, [word.id]: summary }));
      } else {
        setAnalyzedNoWarningIds((current) => new Set(current).add(word.id));
      }
    } finally {
      setLoadingWarningIds((current) => {
        const next = new Set(current);
        next.delete(word.id);
        return next;
      });
    }
  }

  function handleSelectPair(entry: WordPairInAlerts) {
    const longerLabel =
      entry.left.label.length >= entry.right.label.length ? entry.left.label : entry.right.label;
    setQuery(longerLabel);
    setPage(1);
  }

  return (
    <div className="relative pb-4">
      {catalogTotal !== null ? (
        <p className="mb-4 text-xs text-slate-500">{catalogTotal} palavra(s) na biblioteca</p>
      ) : null}

      <WordCatalogList
        words={words}
        fieldTypes={fieldTypes}
        showManageActions={showManageActions}
        deleteAction={deleteAction}
        combinationWarnings={combinationWarnings}
        loadingWarningWordIds={loadingWarningIds}
        analyzedNoWarningWordIds={analyzedNoWarningIds}
        onRequestWordWarnings={handleRequestWordWarnings}
        searchQuery={query}
        onSearchQueryChange={setQuery}
        isLoading={isLoading}
        serverPaginated
      />

      <NormalizationPaginationControls
        page={page}
        totalPages={totalPages}
        total={total}
        isLoading={isLoading}
        onPageChange={setPage}
      />

      <WordCombinationFrequencyDock
        pairRanking={pairRanking}
        isLoading={insightsLoading}
        uniqueViolationCount={uniqueViolationCount}
        wordsWithWarnings={wordsWithWarnings}
        onSelectPair={handleSelectPair}
      />
    </div>
  );
}
