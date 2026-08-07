"use client";

import { useCallback, useEffect, useState } from "react";
import { Search } from "lucide-react";
import { NormalizationImportForm } from "@/components/normalization/normalization-import-form";
import { NormalizationPaginationControls } from "@/components/generator/normalization-pagination-controls";
import { useDebouncedValue } from "@/components/generator/use-debounced-value";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  countPendingNormalizationAction,
  searchPendingNormalizationAction,
} from "@/lib/normalization-query-actions";
import type { NormalizationQueueItem } from "@/lib/types";

function NormalizationToggleButton({
  pendingCount,
  isOpen,
  onToggle,
}: {
  pendingCount: number;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      className="h-7 w-7 shrink-0 p-0 text-xs font-semibold"
      onClick={onToggle}
      title={`${isOpen ? "Ocultar" : "Mostrar"} fila de normalizacao (${pendingCount} pendente(s))`}
      aria-label={`${isOpen ? "Ocultar" : "Mostrar"} fila de normalizacao`}
      aria-expanded={isOpen}
    >
      N
    </Button>
  );
}

export function NormalizationPendingSidebar({
  selectedId,
  referenceFilter,
  designationFilter,
  onReferenceFilterChange,
  onDesignationFilterChange,
  onSelect,
  isOpen,
  onToggle,
  isLoadingId,
  sidebarError,
  onImportSuccess,
  refreshToken,
}: {
  selectedId: string | null;
  referenceFilter: string;
  designationFilter: string;
  onReferenceFilterChange: (value: string) => void;
  onDesignationFilterChange: (value: string) => void;
  onSelect: (item: NormalizationQueueItem) => void;
  isOpen: boolean;
  onToggle: () => void;
  isLoadingId: string | null;
  sidebarError: string | null;
  onImportSuccess: () => void;
  refreshToken: number;
}) {
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<NormalizationQueueItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingTotal, setPendingTotal] = useState<number | null>(null);

  const debouncedReferenceFilter = useDebouncedValue(referenceFilter);
  const debouncedDesignationFilter = useDebouncedValue(designationFilter);

  const loadQueue = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await searchPendingNormalizationAction({
        page,
        referenceFilter: debouncedReferenceFilter,
        designationFilter: debouncedDesignationFilter,
      });
      setItems(result.items);
      setTotal(result.total);
      setTotalPages(result.totalPages);
      if (page > result.totalPages && result.totalPages > 0) {
        setPage(result.totalPages);
      }
    } finally {
      setIsLoading(false);
    }
  }, [page, debouncedReferenceFilter, debouncedDesignationFilter]);

  useEffect(() => {
    void loadQueue();
  }, [loadQueue, refreshToken]);

  useEffect(() => {
    setPage(1);
  }, [debouncedReferenceFilter, debouncedDesignationFilter]);

  useEffect(() => {
    let cancelled = false;
    void countPendingNormalizationAction().then((count) => {
      if (!cancelled) setPendingTotal(count);
    });
    return () => {
      cancelled = true;
    };
  }, [refreshToken]);

  const hasFilters = Boolean(referenceFilter.trim() || designationFilter.trim());
  const collapsedCount = pendingTotal ?? total;

  if (!isOpen) {
    return (
      <div className="flex shrink-0 flex-col items-start">
        <NormalizationToggleButton pendingCount={collapsedCount} isOpen={false} onToggle={onToggle} />
      </div>
    );
  }

  return (
    <Card className="flex w-full shrink-0 flex-col overflow-hidden border-slate-700 bg-slate-900/60 lg:w-72 xl:w-80">
      <div className="flex items-center justify-between gap-2 border-b border-slate-800 px-2 py-2">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.2em] text-amber-300">A normalizar</p>
          <p className="truncate text-xs text-slate-400">
            {hasFilters ? `${total} resultado(s)` : `${total} pendente(s)`}
          </p>
        </div>
        <NormalizationToggleButton pendingCount={collapsedCount} isOpen onToggle={onToggle} />
      </div>

      <div className="space-y-2 border-b border-slate-800 p-2">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
          <input
            type="search"
            value={referenceFilter}
            onChange={(event) => onReferenceFilterChange(event.target.value)}
            placeholder="Filtrar referencia..."
            className="flex h-8 w-full rounded-lg border border-slate-700 bg-slate-950 py-2 pl-8 pr-2 text-xs text-slate-100"
          />
        </label>
        <label className="relative block">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
          <input
            type="search"
            value={designationFilter}
            onChange={(event) => onDesignationFilterChange(event.target.value)}
            placeholder="Filtrar designacao..."
            className="flex h-8 w-full rounded-lg border border-slate-700 bg-slate-950 py-2 pl-8 pr-2 text-xs text-slate-100"
          />
        </label>
      </div>

      {sidebarError ? <p className="px-2 py-1.5 text-xs text-red-300">{sidebarError}</p> : null}

      <div className="max-h-[min(50vh,520px)] overflow-y-auto p-1.5">
        {isLoading ? (
          <p className="p-2 text-xs text-slate-500">A carregar pendentes...</p>
        ) : items.length === 0 ? (
          <p className="p-2 text-xs text-slate-500">
            {hasFilters ? "Nenhum resultado para estes filtros." : "Sem registos pendentes. Importa um Excel abaixo."}
          </p>
        ) : (
          <ul className="space-y-1">
            {items.map((item) => {
              const isSelected = selectedId === item.id;
              const isLoadingItem = isLoadingId === item.id;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(item)}
                    disabled={Boolean(isLoadingId)}
                    className={`w-full rounded-lg border px-2.5 py-1.5 text-left transition ${
                      isSelected
                        ? "border-amber-400/50 bg-amber-500/10"
                        : "border-slate-800 bg-slate-950/50 hover:border-slate-600 hover:bg-slate-900"
                    }`}
                  >
                    <p className="font-mono text-xs text-slate-100">{item.legacyCode ?? "—"}</p>
                    <p className="mt-0.5 line-clamp-2 text-[11px] text-slate-400">
                      {item.legacyDesignation ?? item.sourceDesignationPt ?? "Sem designacao"}
                    </p>
                    {isLoadingItem ? <p className="mt-0.5 text-[11px] text-amber-300">A reivindicar...</p> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <NormalizationPaginationControls
        page={page}
        totalPages={totalPages}
        total={total}
        isLoading={isLoading}
        onPageChange={setPage}
      />

      <NormalizationImportForm compact onSuccess={onImportSuccess} />
    </Card>
  );
}
