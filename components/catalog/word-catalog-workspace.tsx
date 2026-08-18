"use client";

import { useCallback, useEffect, useState } from "react";
import { NormalizationPaginationControls } from "@/components/generator/normalization-pagination-controls";
import { useDebouncedValue } from "@/components/generator/use-debounced-value";
import { WordCatalogList } from "@/components/catalog/word-catalog-list";
import type { FieldTypeOption } from "@/lib/admin-catalog";
import { countWordsCatalogAction, searchWordsCatalogAction } from "@/lib/word-catalog-search-actions";
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
    </div>
  );
}
