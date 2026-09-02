"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteSkuGenerationAction } from "@/lib/sku-history-actions";
import type { RecentSkuGeneration } from "@/lib/types";

type SkuHistoryListProps = {
  rows: RecentSkuGeneration[];
  canDelete: boolean;
};

export function SkuHistoryList({ rows, canDelete }: SkuHistoryListProps) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const pendingRow = pendingId ? rows.find((row) => row.id === pendingId) : null;

  async function confirmDelete() {
    if (!pendingId) return;
    setBusyId(pendingId);
    setErrorMessage(null);
    const result = await deleteSkuGenerationAction(pendingId);
    setBusyId(null);
    if (!result.ok) {
      setErrorMessage(result.message);
      return;
    }
    setPendingId(null);
    router.refresh();
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/30 p-4 text-sm text-slate-500">
        Sem SKUs gerados ainda.
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {rows.map((row) => (
          <div key={row.id} className="rounded-xl border border-slate-700 bg-slate-900/50 p-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              {row.productImageUrl ? (
                <img
                  src={row.productImageUrl}
                  alt={`Imagem do produto ${row.generatedCode}`}
                  className="h-28 w-28 rounded-xl border border-slate-700 object-cover"
                />
              ) : null}
              <div className="min-w-0 flex-1">
                <p className="font-medium text-slate-100">{row.generatedCode}</p>
                <p className="text-sm text-slate-400">{row.designation}</p>
                <p className="mt-2 text-xs text-slate-500">
                  Caixa: {row.unitsPerBox ?? "-"} ({row.unitsPerBoxStatus ?? "-"}) | Multiplos: {row.multiples ?? "-"} (
                  {row.multiplesStatus ?? "-"}) | Peso: {row.weight ?? "-"} ({row.weightStatus ?? "-"})
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-start gap-2 md:items-end">
                <p className="text-sm text-slate-500">
                  {row.createdByName ?? "Sem utilizador"} | {row.createdAtLabel}
                </p>
                {canDelete ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9 border-red-500/40 px-3 text-red-200 hover:bg-red-500/10"
                    onClick={() => {
                      setErrorMessage(null);
                      setPendingId(row.id);
                    }}
                    disabled={busyId === row.id}
                  >
                    <Trash2 className="mr-1.5 h-4 w-4" />
                    Eliminar
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        ))}
      </div>

      {pendingRow ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-sku-title"
            className="w-full max-w-lg rounded-2xl border border-red-500/40 bg-slate-950 p-5 shadow-2xl"
          >
            <h3 id="delete-sku-title" className="text-lg font-semibold text-slate-50">
              Eliminar codigo do historico?
            </h3>
            <p className="mt-3 text-sm text-slate-300">
              Vais eliminar a referencia <span className="font-semibold text-slate-50">{pendingRow.generatedCode}</span>.
              Esta acao nao pode ser desfeita.
            </p>
            {errorMessage ? (
              <div className="mt-4 rounded-xl border border-red-500/50 bg-red-500/15 px-4 py-3 text-sm text-red-100">
                {errorMessage}
              </div>
            ) : null}
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (busyId) return;
                  setPendingId(null);
                  setErrorMessage(null);
                }}
                disabled={Boolean(busyId)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                className="bg-red-500 text-white hover:bg-red-400"
                onClick={() => void confirmDelete()}
                disabled={Boolean(busyId)}
              >
                {busyId ? "A eliminar..." : "Eliminar codigo"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
