"use client";

import { AlertTriangle } from "lucide-react";
import {
  formatCombinationSelectionLine,
  formatCombinationViolationSummary,
  MAX_SKU_REFERENCE_COMPACT_LENGTH,
  type CombinationLimitViolation,
  type WordCombinationAnalysisResult,
} from "@/lib/word-combination-limits";
import { MAX_DESIGNATION_LENGTH } from "@/lib/sku";

export function WordCombinationWarningsPanel({
  analysis,
  compact = false,
  title = "Combinacoes que excedem limites",
}: {
  analysis: WordCombinationAnalysisResult | null;
  compact?: boolean;
  title?: string;
}) {
  if (!analysis || analysis.violations.length === 0) return null;

  return (
    <div
      className={`rounded-xl border border-amber-400/30 bg-amber-400/10 p-4 ${compact ? "" : "md:col-span-2 xl:col-span-3"}`}
    >
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
        <div className="min-w-0 flex-1">
          <p className={`font-medium text-amber-200 ${compact ? "text-xs" : "text-sm"}`}>{title}</p>
          <p className={`mt-1 text-amber-100/80 ${compact ? "text-[11px]" : "text-xs"}`}>
            Limites: designacao {MAX_DESIGNATION_LENGTH} caracteres (PT/ES/EN) · referencia compacta{" "}
            {MAX_SKU_REFERENCE_COMPACT_LENGTH} caracteres.
            {analysis.totalViolationsFound > analysis.violations.length
              ? ` A mostrar ${analysis.violations.length} de ${analysis.totalViolationsFound} combinacoes.`
              : null}
            {analysis.truncated
              ? " Analise parcial: existem mais combinacoes possiveis do que as exploradas."
              : null}
          </p>
          <ul className={`mt-3 max-h-[min(60vh,32rem)] space-y-2 overflow-y-auto ${compact ? "text-[11px]" : "text-xs"} text-amber-100/90`}>
            {analysis.violations.map((violation, index) => (
              <ViolationItem key={`${formatCombinationSelectionLine(violation.selections)}-${index}`} violation={violation} />
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function ViolationItem({ violation }: { violation: CombinationLimitViolation }) {
  return (
    <li className="rounded-lg border border-amber-400/20 bg-slate-950/40 px-3 py-2">
      <p className="font-medium text-amber-100">{formatCombinationViolationSummary(violation)}</p>
      <p className="mt-1 text-slate-300">{formatCombinationSelectionLine(violation.selections)}</p>
      {violation.exceededDesignationLocales.length > 0 ? (
        <p className="mt-1 text-slate-400">
          {violation.exceededDesignationLocales.includes("pt") ? (
            <span className="block truncate">PT: {violation.designationPt}</span>
          ) : null}
          {violation.exceededDesignationLocales.includes("es") ? (
            <span className="block truncate">ES: {violation.designationEs}</span>
          ) : null}
          {violation.exceededDesignationLocales.includes("en") ? (
            <span className="block truncate">EN: {violation.designationEn}</span>
          ) : null}
        </p>
      ) : null}
      {violation.referenceExceeded ? (
        <p className="mt-1 font-mono text-slate-400">Ref: {violation.referenceCompact}</p>
      ) : null}
    </li>
  );
}
