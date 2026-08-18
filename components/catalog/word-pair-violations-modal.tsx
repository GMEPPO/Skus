"use client";

import { X } from "lucide-react";
import { WordCombinationWarningsPanel } from "@/components/catalog/word-combination-warnings-panel";
import { Button } from "@/components/ui/button";
import type { WordPairViolationAnalysis } from "@/lib/word-combination-types";

function formatPairLine(analysis: WordPairViolationAnalysis) {
  const { pair } = analysis;
  return `${pair.left.label} (${pair.left.referenceCode}) + ${pair.right.label} (${pair.right.referenceCode})`;
}

export function WordPairViolationsModal({
  analysis,
  isLoading,
  onClose,
}: {
  analysis: WordPairViolationAnalysis | null;
  isLoading: boolean;
  onClose: () => void;
}) {
  if (!analysis && !isLoading) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
      <div
        className="flex max-h-[min(90vh,48rem)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-amber-500/30 bg-slate-900 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label="Combinacoes problematicas do par selecionado"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-800 px-5 py-4">
          <div className="min-w-0">
            <p className="text-lg font-semibold text-slate-50">Analise completa do par</p>
            {analysis ? (
              <>
                <p className="mt-1 text-sm text-slate-300">{formatPairLine(analysis)}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {analysis.violationCount} combinacao(oes) acima do limite
                  {analysis.truncated ? " · analise ainda parcial por limite de exploracao" : ""}
                </p>
              </>
            ) : (
              <p className="mt-1 text-sm text-slate-400">A calcular todas as combinacoes...</p>
            )}
          </div>
          <Button type="button" variant="outline" className="h-9 w-9 shrink-0 p-0" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {isLoading ? (
            <p className="rounded-lg border border-dashed border-slate-700 px-4 py-6 text-sm text-slate-400">
              A analisar combinacoes deste par...
            </p>
          ) : analysis ? (
            <WordCombinationWarningsPanel
              compact
              title="Todas as combinacoes problematicas deste par"
              analysis={{
                violations: analysis.violations,
                pathsExplored: analysis.pathsExplored,
                truncated: analysis.truncated,
                totalViolationsFound: analysis.violationCount,
              }}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
