"use client";

import { useCallback, useEffect, useState } from "react";
import { NormalizationPaginationControls } from "@/components/generator/normalization-pagination-controls";
import { useDebouncedValue } from "@/components/generator/use-debounced-value";
import { WordCatalogList } from "@/components/catalog/word-catalog-list";
import { WordCombinationFrequencyDock } from "@/components/catalog/word-combination-frequency-dock";
import { WordPairViolationsModal } from "@/components/catalog/word-pair-violations-modal";
import type { FieldTypeOption } from "@/lib/admin-catalog";
import type { WordPairViolationAnalysis } from "@/lib/word-combination-types";
import {
  analyzeWordCombinationWarningsForWordAction,
  analyzeWordPairViolationsAction,
  fetchWordCombinationInsightsAction,
} from "@/lib/word-combination-insights-actions";
import { countWordsCatalogAction, searchWordsCatalogAction } from "@/lib/word-catalog-search-actions";
import type { WordCombinationWarningSummary } from "@/lib/word-combination-types";
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
  const [insightsPartial, setInsightsPartial] = useState(false);
  const [selectedPair, setSelectedPair] = useState<WordPairInAlerts | null>(null);
  const [pairAnalysis, setPairAnalysis] = useState<WordPairViolationAnalysis | null>(null);
  const [pairAnalysisLoading, setPairAnalysisLoading] = useState(false);

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
        setInsightsPartial(result.partial);
      })
      .catch(() => {
        if (cancelled) return;
        setPairRanking([]);
        setUniqueViolationCount(0);
        setWordsWithWarnings(0);
        setInsightsPartial(true);
      })
      .finally(() => {
        if (!cancelled) setInsightsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleRequestWordWarnings(word: WordListItem) {
    const cached = combinationWarnings[word.id];
    if (
      cached &&
      !cached.truncated &&
      cached.violations.length >= cached.violationCount &&
      !loadingWarningIds.has(word.id)
    ) {
      return;
    }

    if (loadingWarningIds.has(word.id) || analyzedNoWarningIds.has(word.id)) {
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

  async function handleSelectPair(entry: WordPairInAlerts) {
    setSelectedPair(entry);
    setPairAnalysis(null);
    setPairAnalysisLoading(true);
    try {
      const analysis = await analyzeWordPairViolationsAction(entry);
      setPairAnalysis(analysis);
    } finally {
      setPairAnalysisLoading(false);
    }
  }

  function handleClosePairModal() {
    setSelectedPair(null);
    setPairAnalysis(null);
    setPairAnalysisLoading(false);
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
        insightsPartial={insightsPartial}
        onSelectPair={(entry) => void handleSelectPair(entry)}
      />

      <WordPairViolationsModal
        analysis={pairAnalysis}
        isLoading={pairAnalysisLoading && selectedPair !== null}
        onClose={handleClosePairModal}
      />
    </div>
  );
}
