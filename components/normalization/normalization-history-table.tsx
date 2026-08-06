"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { isOk2SourceStatus } from "@/lib/normalization-source-status";
import type { NormalizationHistoryItem } from "@/lib/types";

function matchesPartialQuery(value: string | null | undefined, query: string) {
  if (!query) return true;
  return String(value ?? "")
    .toLowerCase()
    .includes(query);
}

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

export function NormalizationHistoryTable({ items }: { items: NormalizationHistoryItem[] }) {
  const [referenceFilter, setReferenceFilter] = useState("");
  const [designationFilter, setDesignationFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");

  const filteredItems = useMemo(() => {
    const refQuery = referenceFilter.trim().toLowerCase();
    const desQuery = designationFilter.trim().toLowerCase();
    const catQuery = categoryFilter.trim().toLowerCase();
    if (!refQuery && !desQuery && !catQuery) return items;

    return items.filter((item) => {
      const referenceMatch =
        matchesPartialQuery(item.legacyCode, refQuery) || matchesPartialQuery(item.newCode, refQuery);
      const designationMatch =
        matchesPartialQuery(item.legacyDesignation, desQuery) ||
        matchesPartialQuery(item.newDesignationPt, desQuery);
      const categoryMatch =
        matchesPartialQuery(item.categoryName, catQuery) || matchesPartialQuery(item.categorySlug, catQuery);
      return referenceMatch && designationMatch && categoryMatch;
    });
  }, [items, referenceFilter, designationFilter, categoryFilter]);

  if (items.length === 0) {
    return (
      <Card className="p-6 text-sm text-slate-400">
        Ainda nao existem produtos normalizados. Conclui registos no gerador ou importa um Excel com linhas OK2.
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            type="search"
            value={referenceFilter}
            onChange={(event) => setReferenceFilter(event.target.value)}
            placeholder="Filtrar referencia..."
            className="flex h-10 w-full rounded-lg border border-slate-700 bg-slate-950 py-2 pl-9 pr-3 text-sm text-slate-100"
          />
        </label>
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            type="search"
            value={designationFilter}
            onChange={(event) => setDesignationFilter(event.target.value)}
            placeholder="Filtrar designacao..."
            className="flex h-10 w-full rounded-lg border border-slate-700 bg-slate-950 py-2 pl-9 pr-3 text-sm text-slate-100"
          />
        </label>
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            type="search"
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
            placeholder="Filtrar categoria..."
            className="flex h-10 w-full rounded-lg border border-slate-700 bg-slate-950 py-2 pl-9 pr-3 text-sm text-slate-100"
          />
        </label>
      </div>

      <p className="text-sm text-slate-400">
        {filteredItems.length === items.length
          ? `${items.length} registo(s) normalizado(s)`
          : `${filteredItems.length} de ${items.length} registo(s)`}
      </p>

      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="min-w-full divide-y divide-slate-800 text-sm">
          <thead className="bg-slate-950/80 text-left text-xs uppercase tracking-[0.15em] text-slate-500">
            <tr>
              <th className="px-4 py-3">Referencia antiga</th>
              <th className="px-4 py-3">Designacao antiga</th>
              <th className="px-4 py-3">Referencia nova</th>
              <th className="px-4 py-3">Designacao nova</th>
              <th className="px-4 py-3">Categoria</th>
              <th className="px-4 py-3">Concluido</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 bg-slate-900/40">
            {filteredItems.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  Nenhum resultado para estes filtros.
                </td>
              </tr>
            ) : (
              filteredItems.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-3 font-mono text-slate-100">{item.legacyCode ?? "—"}</td>
                  <td className="max-w-xs px-4 py-3 text-slate-300">{item.legacyDesignation ?? "—"}</td>
                  <td className="px-4 py-3 font-mono text-emerald-200">{item.newCode ?? "—"}</td>
                  <td className="max-w-md px-4 py-3 text-slate-300">{item.newDesignationPt ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-300">
                    <div className="flex flex-wrap items-center gap-2">
                      <span>{item.categoryName ?? "—"}</span>
                      {isOk2SourceStatus(item.sourceStatus) ? (
                        <Badge variant="outline" className="text-xs text-slate-400">
                          OK2
                        </Badge>
                      ) : null}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-500">{formatCompletedAt(item.completedAt)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
