"use client";

import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { importNormalizationBatchAction } from "@/lib/sku-normalization-import-actions";
import type { Ok2DuplicateReviewRow, SkippedImportRow } from "@/lib/normalization-import-load";

export function NormalizationImportForm({
  categories,
  defaultCategoryId,
  compact = false,
  onSuccess,
}: {
  categories: Array<{ id: string; name: string; slug: string }>;
  defaultCategoryId: string | null;
  compact?: boolean;
  onSuccess?: () => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [skippedRows, setSkippedRows] = useState<SkippedImportRow[]>([]);
  const [ok2DuplicateReviewRows, setOk2DuplicateReviewRows] = useState<Ok2DuplicateReviewRow[]>([]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    setMessage(null);
    setIsError(false);
    setSkippedRows([]);
    setOk2DuplicateReviewRows([]);

    const formData = new FormData(event.currentTarget);
    const result = await importNormalizationBatchAction(formData);

    if (!result.ok) {
      setIsError(true);
      setMessage(result.message);
      setIsSubmitting(false);
      return;
    }

    setMessage(result.message);
    setSkippedRows(result.skippedRows);
    setOk2DuplicateReviewRows(result.ok2DuplicateReviewRows);
    formRef.current?.reset();
    setIsSubmitting(false);
    onSuccess?.();
  }

  const form = (
    <form ref={formRef} onSubmit={handleSubmit} className="grid gap-3">
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

      <label className="space-y-1.5">
        <span className="text-xs text-slate-400">Categoria (opcional)</span>
        <select
          name="categoryId"
          defaultValue={defaultCategoryId ?? ""}
          className="flex h-9 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 text-xs text-slate-100"
        >
          <option value="">Sem categoria</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </label>

      <label className="space-y-1.5">
        <span className="text-xs text-slate-400">Ficheiro Excel</span>
        <input
          name="file"
          type="file"
          accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
          required
          className="block w-full text-xs text-slate-300 file:mr-2 file:rounded-md file:border-0 file:bg-amber-400 file:px-2 file:py-1.5 file:text-xs file:font-medium file:text-slate-950"
        />
      </label>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" disabled={isSubmitting} className="h-8 gap-2 px-3 text-xs">
          <Upload className="h-3.5 w-3.5" />
          {isSubmitting ? "A importar..." : "Importar Excel"}
        </Button>
        {!compact ? <p className="text-xs text-slate-500">Max. 10 MB</p> : null}
      </div>

      {message ? <p className={`text-xs ${isError ? "text-red-300" : "text-emerald-300"}`}>{message}</p> : null}

      {ok2DuplicateReviewRows.length > 0 ? (
        <div className="space-y-2 border-t border-slate-800 pt-3">
          <p className="text-xs font-medium text-yellow-300">
            OK2 duplicados para rever ({ok2DuplicateReviewRows.length})
          </p>
          <p className="text-xs text-slate-500">
            Estas linhas OK2 partilham a mesma referencia nova no Excel. Revê-as manualmente antes de usar.
          </p>
          <div className="max-h-48 overflow-y-auto rounded-lg border border-yellow-900/50">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-slate-900 text-slate-400">
                <tr>
                  <th className="px-2 py-1.5 font-medium">Linha</th>
                  <th className="px-2 py-1.5 font-medium">Referencia antiga</th>
                  <th className="px-2 py-1.5 font-medium">Referencia nova</th>
                  <th className="px-2 py-1.5 font-medium">Aviso</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300">
                {ok2DuplicateReviewRows.map((row) => (
                  <tr key={`ok2-${row.sourceRowNumber}-${row.sourceNewCode ?? "empty"}`}>
                    <td className="px-2 py-1.5 tabular-nums">{row.sourceRowNumber}</td>
                    <td className="px-2 py-1.5">{row.legacyCode ?? "—"}</td>
                    <td className="px-2 py-1.5">{row.sourceNewCode ?? "—"}</td>
                    <td className="px-2 py-1.5 text-yellow-200/80">{row.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {skippedRows.length > 0 ? (
        <div className="space-y-2 border-t border-slate-800 pt-3">
          <p className="text-xs font-medium text-amber-300">Linhas nao carregadas ({skippedRows.length})</p>
          <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-800">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-slate-900 text-slate-400">
                <tr>
                  <th className="px-2 py-1.5 font-medium">Linha</th>
                  <th className="px-2 py-1.5 font-medium">Referencia antiga</th>
                  <th className="px-2 py-1.5 font-medium">Motivo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300">
                {skippedRows.map((row) => (
                  <tr key={`${row.sourceRowNumber}-${row.legacyCode ?? "empty"}`}>
                    <td className="px-2 py-1.5 tabular-nums">{row.sourceRowNumber}</td>
                    <td className="px-2 py-1.5">{row.legacyCode ?? "—"}</td>
                    <td className="px-2 py-1.5 text-slate-400">{row.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </form>
  );

  if (compact) {
    return <div className="border-t border-slate-800 p-3">{form}</div>;
  }

  return <Card className="space-y-4 p-4">{form}</Card>;
}
