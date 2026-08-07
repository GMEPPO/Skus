"use client";

import { useCallback, useEffect, useState } from "react";
import { BookText, Search, X } from "lucide-react";
import { NormalizationPaginationControls } from "@/components/generator/normalization-pagination-controls";
import { useDebouncedValue } from "@/components/generator/use-debounced-value";
import { Button } from "@/components/ui/button";
import { countRecentWordsAction, searchRecentWordsAction } from "@/lib/word-catalog-actions";
import type { WordHistoryItem } from "@/lib/types";

function formatCreatedAt(value: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function WordHistoryModal({ refreshToken }: { refreshToken: number }) {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<WordHistoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [wordsTotal, setWordsTotal] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query);

  const loadWords = useCallback(async () => {
    if (!open) return;
    setIsLoading(true);
    try {
      const result = await searchRecentWordsAction({ page, query: debouncedQuery });
      setItems(result.items);
      setTotal(result.total);
      setTotalPages(result.totalPages);
      if (page > result.totalPages && result.totalPages > 0) {
        setPage(result.totalPages);
      }
    } finally {
      setIsLoading(false);
    }
  }, [open, page, debouncedQuery]);

  useEffect(() => {
    void loadWords();
  }, [loadWords, refreshToken]);

  useEffect(() => {
    setPage(1);
  }, [debouncedQuery]);

  useEffect(() => {
    let cancelled = false;
    void countRecentWordsAction().then((count) => {
      if (!cancelled) setWordsTotal(count);
    });
    return () => {
      cancelled = true;
    };
  }, [refreshToken]);

  return (
    <>
      <Button type="button" variant="outline" className="h-9 gap-2 px-3" onClick={() => setOpen(true)}>
        <BookText className="h-4 w-4" />
        Historico palavras ({wordsTotal ?? "…"})
      </Button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setOpen(false)}
          onKeyDown={(event) => {
            if (event.key === "Escape") setOpen(false);
          }}
          role="presentation"
        >
          <div
            className="flex max-h-[min(90vh,820px)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="word-history-title"
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-800 px-5 py-4">
              <div>
                <h2 id="word-history-title" className="text-lg font-semibold text-slate-50">
                  Historico de palavras criadas
                </h2>
                <p className="mt-1 text-sm text-slate-400">
                  Palavras da biblioteca global ordenadas pela data de criacao mais recente.
                </p>
                <p className="mt-2 text-xs text-slate-500">{total} registo(s)</p>
              </div>
              <Button type="button" variant="outline" className="h-9 w-9 shrink-0 p-0" onClick={() => setOpen(false)}>
                <X className="h-4 w-4" />
                <span className="sr-only">Fechar</span>
              </Button>
            </div>

            <div className="border-b border-slate-800 px-5 py-3">
              <label className="relative block">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Filtrar por palavra, referencia ou designacao PT..."
                  className="flex h-10 w-full rounded-lg border border-slate-700 bg-slate-950 py-2 pl-9 pr-3 text-sm text-slate-100"
                />
              </label>
            </div>

            <div className="min-h-0 flex-1 overflow-auto p-4">
              {isLoading && items.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-700 p-6 text-sm text-slate-400">
                  A carregar historico...
                </p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-800">
                  <table className="min-w-full divide-y divide-slate-800 text-sm">
                    <thead className="bg-slate-950/80 text-left text-xs uppercase tracking-[0.12em] text-slate-500">
                      <tr>
                        <th className="px-3 py-2">Palavra</th>
                        <th className="px-3 py-2">Referencia</th>
                        <th className="px-3 py-2">Nivel</th>
                        <th className="px-3 py-2">Designacao PT</th>
                        <th className="px-3 py-2">Criada</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 bg-slate-900/40">
                      {items.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                            {isLoading ? "A pesquisar..." : "Nenhum resultado."}
                          </td>
                        </tr>
                      ) : (
                        items.map((item) => (
                          <tr key={item.id}>
                            <td className="px-3 py-2.5 text-slate-100">{item.label}</td>
                            <td className="px-3 py-2.5 font-mono text-amber-200">{item.referenceCode}</td>
                            <td className="px-3 py-2.5 text-slate-300">{item.fieldTypeLabel || "—"}</td>
                            <td className="max-w-sm px-3 py-2.5 text-slate-300">{item.designationPt || "—"}</td>
                            <td className="whitespace-nowrap px-3 py-2.5 text-slate-500">{formatCreatedAt(item.createdAt)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <NormalizationPaginationControls
              page={page}
              totalPages={totalPages}
              total={total}
              isLoading={isLoading}
              onPageChange={setPage}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
