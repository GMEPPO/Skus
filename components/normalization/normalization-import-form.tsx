"use client";

import { useRef, useState } from "react";
import { FileText, Upload } from "lucide-react";
import {
  NormalizationImportResultsModal,
  type NormalizationImportReport,
} from "@/components/generator/normalization-import-results-modal";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { importNormalizationBatchAction } from "@/lib/sku-normalization-import-actions";

export function NormalizationImportForm({
  compact = false,
  onSuccess,
}: {
  compact?: boolean;
  onSuccess?: () => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [report, setReport] = useState<NormalizationImportReport | null>(null);
  const [reportOpen, setReportOpen] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const result = await importNormalizationBatchAction(formData);

    if (!result.ok) {
      setReport({
        message: result.message,
        isError: true,
        loadedRows: 0,
        skippedRows: [],
        ok2DuplicateReviewRows: [],
      });
      setReportOpen(true);
      setIsSubmitting(false);
      return;
    }

    setReport({
      message: result.message,
      isError: false,
      loadedRows: result.loadedRows,
      skippedRows: result.skippedRows,
      ok2DuplicateReviewRows: result.ok2DuplicateReviewRows,
    });
    setReportOpen(true);
    formRef.current?.reset();
    setIsSubmitting(false);
    onSuccess?.();
  }

  const form = (
    <form ref={formRef} onSubmit={handleSubmit} className="grid gap-2">
      {!compact ? (
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Importar Excel</p>
          <p className="mt-1 text-sm text-slate-400">
            Carrega a primeira folha com colunas como Referencia_antiga, Designacao_antiga, Referencia_nova,
            Designacao_nova_pt/es/en (ou Designacao_PT/ES/EN), Estado e Observacoes. Cada import substitui a
            lista anterior de codigos a normalizar.
          </p>
        </div>
      ) : null}

      <label className="space-y-1">
        <span className="text-xs text-slate-400">Ficheiro Excel</span>
        <input
          name="file"
          type="file"
          accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
          required
          className="block w-full text-xs text-slate-300 file:mr-2 file:rounded-md file:border-0 file:bg-amber-400 file:px-2 file:py-1 file:text-xs file:font-medium file:text-slate-950"
        />
      </label>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" disabled={isSubmitting} className="h-7 gap-1.5 px-2.5 text-xs">
          <Upload className="h-3 w-3" />
          {isSubmitting ? "A importar..." : "Importar"}
        </Button>
        {report ? (
          <Button
            type="button"
            variant="outline"
            className="h-7 gap-1.5 px-2.5 text-xs"
            onClick={() => setReportOpen(true)}
          >
            <FileText className="h-3 w-3" />
            Relatorio
          </Button>
        ) : null}
        {!compact ? <p className="text-xs text-slate-500">Max. 10 MB</p> : null}
      </div>
    </form>
  );

  const content = compact ? (
    <div className="border-t border-slate-800 p-2">{form}</div>
  ) : (
    <Card className="space-y-4 p-4">{form}</Card>
  );

  return (
    <>
      {content}
      <NormalizationImportResultsModal open={reportOpen} onClose={() => setReportOpen(false)} report={report} />
    </>
  );
}
