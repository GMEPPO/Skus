"use client";

import { AlertTriangle } from "lucide-react";
import type { WordPairInAlerts } from "@/lib/word-combination-frequency";

function formatPairLine(entry: WordPairInAlerts) {
  return `${entry.left.label} (${entry.left.referenceCode}) + ${entry.right.label} (${entry.right.referenceCode})`;
}

function formatPairMeta(entry: WordPairInAlerts) {
  return `${entry.left.levelLabel} · ${entry.right.levelLabel}`;
}

export function WordCombinationFrequencyDock({
  pairRanking,
  isLoading,
  uniqueViolationCount,
  wordsWithWarnings,
  onSelectPair,
}: {
  pairRanking: WordPairInAlerts[];
  isLoading: boolean;
  uniqueViolationCount: number;
  wordsWithWarnings: number;
  onSelectPair?: (entry: WordPairInAlerts) => void;
}) {
  return (
    <div
      className="pointer-events-none fixed bottom-4 right-4 z-40 w-[min(22rem,calc(100vw-2rem))] max-h-[calc(100vh-6rem)]"
      aria-label="Pares de palavras mais frequentes em alertas de designacao"
    >
      <div className="pointer-events-auto flex max-h-[calc(100vh-6rem)] flex-col overflow-hidden rounded-2xl border border-amber-500/30 bg-slate-950/95 shadow-2xl shadow-black/30 backdrop-blur">
        <div className="border-b border-slate-800 px-4 py-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
            <div>
              <p className="text-sm font-semibold text-slate-50">Combinacoes em alertas</p>
              <p className="mt-1 text-xs text-slate-400">
                Pares de palavras que mais aparecem juntos acima de 60 caracteres.
              </p>
              {!isLoading && uniqueViolationCount > 0 ? (
                <p className="mt-1 text-[11px] text-slate-500">
                  {uniqueViolationCount} combinacao(oes) unicas · {wordsWithWarnings} palavra(s) analisadas com alertas
                </p>
              ) : null}
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {isLoading ? (
            <p className="rounded-lg border border-dashed border-slate-700 px-3 py-4 text-xs text-slate-400">
              A analisar combinacoes...
            </p>
          ) : pairRanking.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-700 px-3 py-4 text-xs text-slate-400">
              Sem pares problematicos por agora.
            </p>
          ) : (
            <ol className="space-y-2">
              {pairRanking.map((entry, index) => (
                <li key={`${formatPairLine(entry)}-${index}`}>
                  <button
                    type="button"
                    className="w-full rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-left transition hover:border-amber-400/30 hover:bg-slate-900"
                    onClick={() => onSelectPair?.(entry)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium leading-snug text-slate-100">{formatPairLine(entry)}</p>
                        <p className="mt-1 text-[11px] text-slate-500">{formatPairMeta(entry)}</p>
                        {entry.failedLocales.length > 0 ? (
                          <p className="mt-1 text-[10px] uppercase tracking-wide text-slate-600">
                            {entry.failedLocales.join(" · ")}
                          </p>
                        ) : null}
                      </div>
                      <div className="shrink-0 text-right">
                        <span className="rounded-md bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-200">
                          {entry.count}x
                        </span>
                        {entry.avgOverrun > 0 ? (
                          <p className="mt-1 text-[10px] text-amber-200/80">+{entry.avgOverrun} chars</p>
                        ) : null}
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}
