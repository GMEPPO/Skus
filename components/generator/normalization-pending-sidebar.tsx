"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { NormalizationQueueItem } from "@/lib/types";

function matchesPartialQuery(value: string | null | undefined, query: string) {
  if (!query) return true;
  return String(value ?? "")
    .toLowerCase()
    .includes(query);
}

export function NormalizationPendingSidebar({
  items,
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
}: {
  items: NormalizationQueueItem[];
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
}) {
  const filteredItems = useMemo(() => {
    const refQuery = referenceFilter.trim().toLowerCase();
    const desQuery = designationFilter.trim().toLowerCase();
    if (!refQuery && !desQuery) return items;

    return items.filter((item) => {
      const referenceMatch =
        matchesPartialQuery(item.legacyCode, refQuery) || matchesPartialQuery(item.sourceNewCode, refQuery);
      const designationMatch =
        matchesPartialQuery(item.legacyDesignation, desQuery) ||
        matchesPartialQuery(item.sourceDesignationPt, desQuery);
      return referenceMatch && designationMatch;
    });
  }, [items, referenceFilter, designationFilter]);

  if (!isOpen) {
    return (
      <div className="flex shrink-0 flex-col items-start gap-2">
        <Button type="button" variant="outline" className="h-9 gap-2 px-3" onClick={onToggle}>
          <ChevronRight className="h-4 w-4" />
          Normalizar ({items.length})
        </Button>
      </div>
    );
  }

  return (
    <Card className="flex w-full shrink-0 flex-col overflow-hidden border-slate-700 bg-slate-900/60 lg:w-80 xl:w-96">
      <div className="flex items-center justify-between gap-2 border-b border-slate-800 px-3 py-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-amber-300">A normalizar</p>
          <p className="text-sm text-slate-400">
            {filteredItems.length === items.length
              ? `${items.length} pendente(s)`
              : `${filteredItems.length} de ${items.length} pendente(s)`}
          </p>
          <p className="text-xs text-slate-500">Linhas OK2 do Excel ficam fora desta fila.</p>
        </div>
        <Button type="button" variant="outline" className="h-8 w-8 p-0" onClick={onToggle} aria-label="Ocultar painel">
          <ChevronLeft className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-2 border-b border-slate-800 p-3">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            type="search"
            value={referenceFilter}
            onChange={(event) => onReferenceFilterChange(event.target.value)}
            placeholder="Filtrar referencia..."
            className="flex h-10 w-full rounded-lg border border-slate-700 bg-slate-950 py-2 pl-9 pr-3 text-sm text-slate-100"
          />
        </label>
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            type="search"
            value={designationFilter}
            onChange={(event) => onDesignationFilterChange(event.target.value)}
            placeholder="Filtrar designacao..."
            className="flex h-10 w-full rounded-lg border border-slate-700 bg-slate-950 py-2 pl-9 pr-3 text-sm text-slate-100"
          />
        </label>
        <Link href="/normalization" className="text-xs text-amber-300 hover:text-amber-200">
          Importar Excel / ver fila completa
        </Link>
      </div>

      {sidebarError ? <p className="px-3 py-2 text-xs text-red-300">{sidebarError}</p> : null}

      <div className="max-h-[min(70vh,720px)] overflow-y-auto p-2">
        {filteredItems.length === 0 ? (
          <p className="p-3 text-sm text-slate-500">
            {items.length === 0
              ? "Sem registos pendentes. Importa um Excel para comecar."
              : "Nenhum resultado para estes filtros."}
          </p>
        ) : (
          <ul className="space-y-1">
            {filteredItems.map((item) => {
              const isSelected = selectedId === item.id;
              const isLoading = isLoadingId === item.id;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(item)}
                    disabled={Boolean(isLoadingId)}
                    className={`w-full rounded-lg border px-3 py-2 text-left transition ${
                      isSelected
                        ? "border-amber-400/50 bg-amber-500/10"
                        : "border-slate-800 bg-slate-950/50 hover:border-slate-600 hover:bg-slate-900"
                    }`}
                  >
                    <p className="font-mono text-sm text-slate-100">{item.legacyCode ?? "—"}</p>
                    <p className="mt-1 line-clamp-2 text-xs text-slate-400">
                      {item.legacyDesignation ?? item.sourceDesignationPt ?? "Sem designacao"}
                    </p>
                    {isLoading ? <p className="mt-1 text-xs text-amber-300">A reivindicar...</p> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Card>
  );
}
