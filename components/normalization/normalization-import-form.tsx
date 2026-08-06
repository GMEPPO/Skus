"use client";

import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { importNormalizationBatchAction } from "@/lib/sku-normalization-import-actions";

export function NormalizationImportForm({
  categories,
  defaultCategoryId,
}: {
  categories: Array<{ id: string; name: string; slug: string }>;
  defaultCategoryId: string | null;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    setMessage(null);
    setIsError(false);

    const formData = new FormData(event.currentTarget);
    const result = await importNormalizationBatchAction(formData);

    if (!result.ok) {
      setIsError(true);
      setMessage(result.message);
      setIsSubmitting(false);
      return;
    }

    setMessage(result.message);
    formRef.current?.reset();
    setIsSubmitting(false);
  }

  return (
    <Card className="space-y-4 p-4">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Importar Excel</p>
        <p className="mt-1 text-sm text-slate-400">
          Carrega a primeira folha com colunas como Referencia_antiga, Designacao_antiga, Referencia_nova,
          Designacao_PT/ES/EN, Estado e Observacoes.
        </p>
      </div>

      <form ref={formRef} onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
        <label className="space-y-2">
          <span className="text-sm text-slate-300">Categoria predefinida (opcional)</span>
          <select
            name="categoryId"
            defaultValue={defaultCategoryId ?? ""}
            className="flex h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
          >
            <option value="">Sem categoria predefinida</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name} ({category.slug})
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2 md:col-span-2">
          <span className="text-sm text-slate-300">Ficheiro Excel</span>
          <input
            name="file"
            type="file"
            accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
            required
            className="block w-full text-sm text-slate-300 file:mr-3 file:rounded-md file:border-0 file:bg-amber-400 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-950"
          />
        </label>

        <div className="md:col-span-2 flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={isSubmitting} className="gap-2">
            <Upload className="h-4 w-4" />
            {isSubmitting ? "A importar..." : "Importar batch"}
          </Button>
          <p className="text-xs text-slate-500">Max. 10 MB · duplicados bloqueados por SHA-256</p>
        </div>
      </form>

      {message ? (
        <p className={`text-sm ${isError ? "text-red-300" : "text-emerald-300"}`}>{message}</p>
      ) : null}
    </Card>
  );
}
