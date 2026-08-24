import * as XLSX from "xlsx";
import { readSelectionSnapshot } from "@/lib/selection-snapshot";
import type { SkuHistoryExportItem } from "@/lib/sku-history-data";

function formatExportDate(value: string | null | undefined) {
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

function buildLevelColumns(item: SkuHistoryExportItem) {
  const view = readSelectionSnapshot(item.selectionSnapshot, item.snapshotVersion);
  const columns: Record<string, string> = {};

  if (view.kind === "v2") {
    const levels = [...view.snapshot.levels].sort((left, right) => left.sortOrder - right.sortOrder);
    levels.forEach((level, index) => {
      const prefix = `N${index + 1}_${level.key}`;
      columns[`${prefix}_nivel`] = level.label;
      if (level.selection.kind === "word") {
        columns[`${prefix}_ref`] = level.selection.referenceCode;
        columns[`${prefix}_palavra`] = level.selection.label;
        columns[`${prefix}_pt`] = level.selection.designations.pt;
        columns[`${prefix}_es`] = level.selection.designations.es;
        columns[`${prefix}_en`] = level.selection.designations.en;
      } else {
        columns[`${prefix}_ref`] = level.codeSegment ?? "000";
        columns[`${prefix}_palavra`] = "";
        columns[`${prefix}_pt`] = "";
        columns[`${prefix}_es`] = "";
        columns[`${prefix}_en`] = "";
      }
    });
    columns.Categoria = view.snapshot.category.name;
  }

  return columns;
}

export function downloadSkuHistoryExcel(items: SkuHistoryExportItem[], fileName?: string) {
  const exportRows = items.map((item) => {
    const levelColumns = buildLevelColumns(item);
    return {
      Codigo: item.generatedCode,
      Designacao: item.designation,
      Designacao_PT: item.designationPt,
      Designacao_ES: item.designationEs,
      Designacao_EN: item.designationEn,
      Categoria: item.categoryName ?? levelColumns.Categoria ?? "",
      Prefixo: item.prefixSnapshot,
      ...levelColumns,
      Caixa: item.unitsPerBox ?? "",
      Caixa_estado: item.unitsPerBoxStatus ?? "",
      Multiplos: item.multiples ?? "",
      Multiplos_estado: item.multiplesStatus ?? "",
      Peso: item.weight ?? "",
      Peso_estado: item.weightStatus ?? "",
      Utilizador: item.createdByName ?? "",
      Criado_em: formatExportDate(item.createdAt),
      URL_imagem: item.productImageUrl ?? "",
      Fingerprint: item.selectionFingerprint ?? "",
    };
  });

  const summaryRows = [
    ["Metrica", "Valor"],
    ["Total registos", items.length],
    ["Exportado em", formatExportDate(new Date().toISOString())],
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(exportRows), "Historico");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(summaryRows), "Resumen");
  XLSX.writeFile(workbook, fileName ?? "historico-skus.xlsx");
}
