"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadWordCatalogExcel } from "@/lib/word-catalog-export";
import { exportWordCatalogAction } from "@/lib/word-catalog-export-actions";

export function WordCatalogExportButton() {
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleExport() {
    setIsExporting(true);
    setError(null);
    try {
      const payload = await exportWordCatalogAction();
      if (payload.words.length === 0) {
        setError("Nao ha palavras para exportar.");
        return;
      }
      downloadWordCatalogExcel(payload.words, payload.fieldTypes);
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
