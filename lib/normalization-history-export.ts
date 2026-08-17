import * as XLSX from "xlsx";
import type { NormalizationHistoryItem } from "@/lib/types";

function formatExportDate(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function downloadNormalizationHistoryExcel(items: NormalizationHistoryItem[], fileName?: string) {
  const exportRows = items.map((item) => ({
    Referencia_antiga: item.legacyCode ?? "",
    Designacao_antiga: item.legacyDesignation ?? "",
    Referencia_nova: item.newCode ?? "",
    Designacao_nova_pt: item.newDesignationPt ?? "",
    Designacao_nova_es: item.newDesignationEs ?? "",
    Designacao_nova_en: item.newDesignationEn ?? "",
    Categoria: item.categoryName ?? "",
    Estado_origem: item.sourceStatus ?? "",
    Concluido_em: formatExportDate(item.completedAt),
  }));

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(exportRows);
  XLSX.utils.book_append_sheet(workbook, worksheet, "Historico");
  XLSX.writeFile(workbook, fileName ?? "historico-normalizados.xlsx");
}
