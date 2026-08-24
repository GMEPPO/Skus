"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadSkuHistoryExcel } from "@/lib/sku-history-export";
import { exportSkuHistoryAction } from "@/lib/sku-history-export-actions";

export function SkuHistoryExportButton() {
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleExport() {
    setIsExporting(true);
    setError(null);
    try {
      const rows = await exportSkuHistoryAction();
      if (rows.length === 0) {
        setError("Nao ha SKUs para exportar.");
        return;
      }
      downloadSkuHistoryExcel(rows);
    } catch {
      setError("Nao foi possivel exportar para Excel.");
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div>
      <Button
        type="button"
        variant="outline"
        className="h-9 gap-2 px-3"
        onClick={() => void handleExport()}
        disabled={isExporting}
      >
        <Download className="h-4 w-4" />
        {isExporting ? "A exportar..." : "Exportar Excel"}
      </Button>
      {error ? <p className="mt-1 text-xs text-red-400">{error}</p> : null}
    </div>
  );
}
