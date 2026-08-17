"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, History, X } from "lucide-react";
import { NormalizationPaginationControls } from "@/components/generator/normalization-pagination-controls";
import { useDebouncedValue } from "@/components/generator/use-debounced-value";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { downloadNormalizationHistoryExcel } from "@/lib/normalization-history-export";
import { isOk2SourceStatus } from "@/lib/normalization-source-status";
import {
  countCompletedNormalizationAction,
  exportCompletedNormalizationHistoryAction,
  searchCompletedNormalizationHistoryAction,
} from "@/lib/normalization-query-actions";

function formatCompletedAt(value: string | null) {
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

const filterInputClassName =
  "mt-2 flex h-8 w-full min-w-[7rem] rounded-md border border-slate-700 bg-slate-950 px-2 text-xs text-slate-100 placeholder:text-slate-600";

export function NormalizationHistoryModal({ refreshToken }: { refreshToken: number }) {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<NormalizationHistoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [completedTotal, setCompletedTotal] = useState<number | null>(null);

  const [legacyCodeFilter, setLegacyCodeFilter] = useState("");
  const [legacyDesignationFilter, setLegacyDesignationFilter] = useState("");
  const [newCodeFilter, setNewCodeFilter] = useState("");
  const [newDesignationFilter, setNewDesignationFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");

  const debouncedLegacyCodeFilter = useDebouncedValue(legacyCodeFilter);
  const debouncedLegacyDesignationFilter = useDebouncedValue(legacyDesignationFilter);
  const debouncedNewCodeFilter = useDebouncedValue(newCodeFilter);
  const debouncedNewDesignationFilter = useDebouncedValue(newDesignationFilter);
  const debouncedCategoryFilter = useDebouncedValue(categoryFilter);

  const loadHistory = useCallback(async () => {
    if (!open) return;
    setIsLoading(true);
    try {
      const result = await searchCompletedNormalizationHistoryAction({
        page,
        legacyCodeFilter: debouncedLegacyCodeFilter,
        legacyDesignationFilter: debouncedLegacyDesignationFilter,
        newCodeFilter: debouncedNewCodeFilter,
        newDesignationFilter: debouncedNewDesignationFilter,
        categoryFilter: debouncedCategoryFilter,
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
  }, [
    open,
    page,
    debouncedLegacyCodeFilter,
    debouncedLegacyDesignationFilter,
    debouncedNewCodeFilter,
    debouncedNewDesignationFilter,
    debouncedCategoryFilter,
  ]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory, refreshToken]);

  useEffect(() => {
    setPage(1);
  }, [
    debouncedLegacyCodeFilter,
    debouncedLegacyDesignationFilter,
    debouncedNewCodeFilter,
    debouncedNewDesignationFilter,
    debouncedCategoryFilter,
  ]);

  useEffect(() => {
    let cancelled = false;
    void countCompletedNormalizationAction().then((count) => {
      if (!cancelled) setCompletedTotal(count);
    });
    return () => {
      cancelled = true;
    };
  }, [refreshToken]);

  function closeModal() {
    setOpen(false);
    setExportError(null);
  }

  async function handleExportExcel() {
    setIsExporting(true);
    setExportError(null);
    try {
      const rows = await exportCompletedNormalizationHistoryAction({
        legacyCodeFilter: debouncedLegacyCodeFilter,
        legacyDesignationFilter: debouncedLegacyDesignationFilter,
        newCodeFilter: debouncedNewCodeFilter,
        newDesignationFilter: debouncedNewDesignationFilter,
        categoryFilter: debouncedCategoryFilter,
      });

      if (rows.length === 0) {
        setExportError("Nao ha registos para exportar com estes filtros.");
        return;
      }

      const suffix = hasFilters ? "-filtrado" : "";
      downloadNormalizationHistoryExcel(rows, `historico-normalizados${suffix}.xlsx`);
    } catch {
      setExportError("Nao foi possivel exportar o historico.");
    } finally {
      setIsExporting(false);
    }
  }

  const hasFilters = Boolean(
    legacyCodeFilter.trim() ||
      legacyDesignationFilter.trim() ||
      newCodeFilter.trim() ||
      newDesignationFilter.trim() ||
      categoryFilter.trim(),
  );

  return (
    <>
      <Button type="button" variant="outline" className="h-9 gap-2 px-3" onClick={() => setOpen(true)}>
        <History className="h-4 w-4" />
        Histórico normalizados ({completedTotal ?? "…"})
      </Button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={closeModal}
          onKeyDown={(event) => {
            if (event.key === "Escape") closeModal();
          }}
          role="presentation"
        >
          <div
            className="flex max-h-[min(90vh,960px)] w-full max-w-[96rem] flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="normalization-history-title"
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-800 px-5 py-4">
              <div>
                <h2 id="normalization-history-title" className="text-lg font-semibold text-slate-50">
                  Histórico de normalização
                </h2>
                <p className="mt-1 text-sm text-slate-400">
                  Referencias e designacoes antigas e novas (PT, ES, EN), com categoria. Os filtros pesquisam em todo
                  o historico.
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  {hasFilters ? `${total} resultado(s) no universo total` : `${total} registo(s)`}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 gap-2 px-3"
                  disabled={isExporting || (completedTotal !== null && completedTotal === 0 && !hasFilters)}
                  onClick={() => void handleExportExcel()}
                >
                  <Download className="h-4 w-4" />
                  {isExporting ? "A exportar..." : "Exportar Excel"}
                </Button>
                <Button type="button" variant="outline" className="h-9 w-9 shrink-0 p-0" onClick={closeModal}>
                  <X className="h-4 w-4" />
                  <span className="sr-only">Fechar</span>
                </Button>
              </div>
            </div>

            {exportError ? (
              <p className="border-b border-slate-800 px-5 py-2 text-sm text-amber-200">{exportError}</p>
            ) : null}

            <div className="min-h-0 flex-1 overflow-auto p-4">
              {isLoading && items.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-700 p-6 text-sm text-slate-400">
                  A carregar historico...
                </p>
              ) : total === 0 && !hasFilters ? (
                <p className="rounded-xl border border-dashed border-slate-700 p-6 text-sm text-slate-400">
                  Ainda nao existem produtos normalizados. Conclui registos no gerador a partir da fila pendente.
                </p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-800">
                  <table className="min-w-full divide-y divide-slate-800 text-sm">
                    <thead className="bg-slate-950/80 text-left text-xs uppercase tracking-[0.12em] text-slate-500">
                      <tr>
                        <th className="px-3 py-2 align-top">
                          <span>Referencia antiga</span>
                          <input
                            type="search"
                            value={legacyCodeFilter}
                            onChange={(event) => setLegacyCodeFilter(event.target.value)}
                            placeholder="Filtrar..."
                            className={filterInputClassName}
                          />
                        </th>
                        <th className="px-3 py-2 align-top">
                          <span>Designacao antiga</span>
                          <input
                            type="search"
                            value={legacyDesignationFilter}
                            onChange={(event) => setLegacyDesignationFilter(event.target.value)}
                            placeholder="Filtrar..."
                            className={filterInputClassName}
                          />
                        </th>
                        <th className="px-3 py-2 align-top">
                          <span>Referencia nova</span>
                          <input
                            type="search"
                            value={newCodeFilter}
                            onChange={(event) => setNewCodeFilter(event.target.value)}
                            placeholder="Filtrar..."
                            className={filterInputClassName}
                          />
                        </th>
                        <th className="px-3 py-2 align-top">
                          <span>Designacao nova PT</span>
                          <input
                            type="search"
                            value={newDesignationFilter}
                            onChange={(event) => setNewDesignationFilter(event.target.value)}
                            placeholder="Filtrar PT/ES/EN..."
                            className={filterInputClassName}
                          />
                        </th>
                        <th className="px-3 py-2 align-top">
                          <span>Designacao nova ES</span>
                        </th>
                        <th className="px-3 py-2 align-top">
                          <span>Designacao nova EN</span>
                        </th>
                        <th className="px-3 py-2 align-top">
                          <span>Categoria</span>
                          <input
                            type="search"
                            value={categoryFilter}
                            onChange={(event) => setCategoryFilter(event.target.value)}
                            placeholder="Filtrar..."
                            className={filterInputClassName}
                          />
                        </th>
                        <th className="whitespace-nowrap px-3 py-2 align-top">Concluido</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 bg-slate-900/40">
                      {items.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                            {isLoading ? "A pesquisar..." : "Nenhum resultado para estes filtros."}
                          </td>
                        </tr>
                      ) : (
                        items.map((item) => (
                          <tr key={item.id}>
                            <td className="px-3 py-2.5 font-mono text-slate-100">{item.legacyCode ?? "—"}</td>
                            <td className="max-w-xs px-3 py-2.5 text-slate-300">{item.legacyDesignation ?? "—"}</td>
                            <td className="px-3 py-2.5 font-mono text-emerald-200">{item.newCode ?? "—"}</td>
                            <td className="max-w-sm px-3 py-2.5 text-slate-300">{item.newDesignationPt ?? "—"}</td>
                            <td className="max-w-sm px-3 py-2.5 text-slate-300">{item.newDesignationEs ?? "—"}</td>
                            <td className="max-w-sm px-3 py-2.5 text-slate-300">{item.newDesignationEn ?? "—"}</td>
                            <td className="px-3 py-2.5 text-slate-300">
                              <div className="flex flex-wrap items-center gap-2">
                                <span>{item.categoryName ?? "—"}</span>
                                {isOk2SourceStatus(item.sourceStatus) ? (
                                  <Badge variant="outline" className="text-xs text-slate-400">
                                    OK2
                                  </Badge>
                                ) : null}
                              </div>
                            </td>
                            <td className="whitespace-nowrap px-3 py-2.5 text-slate-500">
                              {formatCompletedAt(item.completedAt)}
                            </td>
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
