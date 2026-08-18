"use client";

import { AlertTriangle } from "lucide-react";
import type { WordFrequencyInAlerts } from "@/lib/word-combination-frequency";

export function WordCombinationFrequencyDock({
  ranking,
  isLoading,
  wordsWithWarnings,
  onSelectWord,
}: {
  ranking: WordFrequencyInAlerts[];
  isLoading: boolean;
  wordsWithWarnings: number;
  onSelectWord?: (entry: WordFrequencyInAlerts) => void;
}) {
  return (
    <div
      className="pointer-events-none fixed bottom-4 right-4 z-40 w-[min(20rem,calc(100vw-2rem))] max-h-[calc(100vh-6rem)]"
      aria-label="Palavras mais frequentes em alertas de designacao"
    >
      <div className="pointer-events-auto flex max-h-[calc(100vh-6rem)] flex-col overflow-hidden rounded-2xl border border-amber-500/30 bg-slate-950/95 shadow-2xl shadow-black/30 backdrop-blur">
        <div className="border-b border-slate-800 px-4 py-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
            <div>
              <p className="text-sm font-semibold text-slate-50">Palavras em alertas</p>
              <p className="mt-1 text-xs text-slate-400">
                Aparecem com mais frequencia em combinacoes acima de 60 caracteres.
              </p>
              {!isLoading && wordsWithWarnings > 0 ? (
                <p className="mt-1 text-[11px] text-slate-500">{wordsWithWarnings} palavra(s) com alertas</p>
              ) : null}
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {isLoading ? (
            <p className="rounded-lg border border-dashed border-slate-700 px-3 py-4 text-xs text-slate-400">
              A analisar combinacoes...
            </p>
          ) : ranking.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-700 px-3 py-4 text-xs text-slate-400">
              Sem alertas de designacao por agora.
            </p>
          ) : (
            <ol className="space-y-2">
              {ranking.map((entry, index) => (
                <li key={`${entry.label}-${entry.referenceCode}-${entry.levelLabel}-${index}`}>
                  <button
                    type="button"
                    className="w-full rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-left transition hover:border-amber-400/30 hover:bg-slate-900"
                    onClick={() => onSelectWord?.(entry)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-100">{entry.label}</p>
                        <p className="mt-0.5 text-[11px] text-slate-500">
                          {entry.levelLabel} · {entry.referenceCode}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-md bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-200">
                        {entry.count}x
                      </span>
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
