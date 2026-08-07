"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Ok2DuplicateReviewRow, SkippedImportRow } from "@/lib/normalization-import-load";

export type NormalizationImportReport = {
  message: string;
  isError: boolean;
  loadedRows: number;
  skippedRows: SkippedImportRow[];
  ok2DuplicateReviewRows: Ok2DuplicateReviewRow[];
};

export function NormalizationImportResultsModal({
  open,
  onClose,
  report,
}: {
  open: boolean;
  onClose: () => void;
  report: NormalizationImportReport | null;
}) {
  if (!open || !report) return null;

  const hasSkipped = report.skippedRows.length > 0;
  const hasOk2Review = report.ok2DuplicateReviewRows.length > 0;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose();
      }}
      role="presentation"
    >
      <div
        className="flex max-h-[min(90vh,820px)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="normalization-import-results-title"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-800 px-5 py-4">
          <div>
            <h2 id="normalization-import-results-title" className="text-lg font-semibold text-slate-50">
              Relatorio de importacao
            </h2>
            <p className={`mt-2 text-sm ${report.isError ? "text-red-300" : "text-emerald-300"}`}>{report.message}</p>
            {!report.isError ? (
              <p className="mt-1 text-xs text-slate-500">
                {report.loadedRows} linha(s) carregada(s)
                {hasSkipped ? ` · ${report.skippedRows.length} nao carregada(s)` : ""}
                {hasOk2Review ? ` · ${report.ok2DuplicateReviewRows.length} OK2 para rever` : ""}
              </p>
            ) : null}
          </div>
          <Button type="button" variant="outline" className="h-8 w-8 shrink-0 p-0" onClick={onClose}>
            <X className="h-4 w-4" />
            <span className="sr-only">Fechar</span>
          </Button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-auto p-4">
          {hasOk2Review ? (
            <section className="space-y-2">
              <p className="text-sm font-medium text-yellow-300">
                OK2 duplicados para rever ({report.ok2DuplicateReviewRows.length})
              </p>
              <p className="text-xs text-slate-500">
                Estas linhas OK2 partilham a mesma referencia nova no Excel. Revê-as manualmente antes de usar.
              </p>
              <div className="overflow-x-auto rounded-xl border border-yellow-900/50">
                <table className="min-w-full text-left text-xs">
                  <thead className="bg-slate-900 text-slate-400">
                    <tr>
                      <th className="px-3 py-2 font-medium">Linha</th>
                      <th className="px-3 py-2 font-medium">Referencia antiga</th>
                      <th className="px-3 py-2 font-medium">Referencia nova</th>
                      <th className="px-3 py-2 font-medium">Aviso</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-300">
                    {report.ok2DuplicateReviewRows.map((row) => (
                      <tr key={`ok2-${row.sourceRowNumber}-${row.sourceNewCode ?? "empty"}`}>
                        <td className="px-3 py-2 tabular-nums">{row.sourceRowNumber}</td>
                        <td className="px-3 py-2 font-mono">{row.legacyCode ?? "—"}</td>
                        <td className="px-3 py-2 font-mono">{row.sourceNewCode ?? "—"}</td>
                        <td className="px-3 py-2 text-yellow-200/80">{row.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          {hasSkipped ? (
            <section className="space-y-2">
              <p className="text-sm font-medium text-amber-300">Linhas nao carregadas ({report.skippedRows.length})</p>
              <div className="overflow-x-auto rounded-xl border border-slate-800">
                <table className="min-w-full text-left text-xs">
                  <thead className="bg-slate-900 text-slate-400">
                    <tr>
                      <th className="px-3 py-2 font-medium">Linha</th>
                      <th className="px-3 py-2 font-medium">Referencia antiga</th>
                      <th className="px-3 py-2 font-medium">Motivo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-300">
                    {report.skippedRows.map((row) => (
                      <tr key={`${row.sourceRowNumber}-${row.legacyCode ?? "empty"}`}>
                        <td className="px-3 py-2 tabular-nums">{row.sourceRowNumber}</td>
                        <td className="px-3 py-2 font-mono">{row.legacyCode ?? "—"}</td>
                        <td className="px-3 py-2 text-slate-400">{row.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          {!hasSkipped && !hasOk2Review && !report.isError ? (
            <p className="rounded-xl border border-dashed border-slate-700 p-6 text-sm text-slate-400">
              Todas as linhas validas foram carregadas sem avisos adicionais.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
