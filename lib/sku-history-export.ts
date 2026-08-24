import * as XLSX from "xlsx-js-style";
import type { SkuHistoryExportItem } from "@/lib/sku-history-data";

const HEADERS = ["Fecha", "Referencia", "Designacion PT", "Designacion ES", "Designacion EN"];

const thinBorder = {
  top: { style: "thin", color: { rgb: "CBD5E1" } },
  bottom: { style: "thin", color: { rgb: "CBD5E1" } },
  left: { style: "thin", color: { rgb: "CBD5E1" } },
  right: { style: "thin", color: { rgb: "CBD5E1" } },
};

const headerStyle = {
  font: { bold: true, color: { rgb: "FFFFFF" }, sz: 11 },
  fill: { patternType: "solid", fgColor: { rgb: "1E3A5F" } },
  alignment: { horizontal: "center", vertical: "center", wrapText: true },
  border: thinBorder,
};

export function stripReferenceSeparators(code: string) {
  return code.replace(/-/g, "");
}

function formatExportDate(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function buildDataRows(items: SkuHistoryExportItem[]) {
  return items.map((item) => [
    formatExportDate(item.createdAt),
    stripReferenceSeparators(item.generatedCode),
    item.designationPt,
    item.designationEs,
    item.designationEn,
  ]);
}

function applyTableStyles(worksheet: XLSX.WorkSheet, rowCount: number) {
  for (let column = 0; column < HEADERS.length; column += 1) {
    const headerAddress = XLSX.utils.encode_cell({ r: 0, c: column });
    if (worksheet[headerAddress]) {
      worksheet[headerAddress].s = headerStyle;
    }
  }

  for (let row = 1; row <= rowCount; row += 1) {
    const isEvenRow = row % 2 === 0;
    for (let column = 0; column < HEADERS.length; column += 1) {
      const address = XLSX.utils.encode_cell({ r: row, c: column });
      if (!worksheet[address]) continue;

      worksheet[address].s = {
        font: { sz: 10, color: { rgb: "0F172A" } },
        fill: isEvenRow ? { patternType: "solid", fgColor: { rgb: "F8FAFC" } } : undefined,
        alignment: {
          horizontal: column <= 1 ? "center" : "left",
          vertical: "center",
          wrapText: column >= 2,
        },
        border: thinBorder,
      };
    }
  }

  worksheet["!cols"] = [{ wch: 20 }, { wch: 18 }, { wch: 44 }, { wch: 44 }, { wch: 44 }];
  worksheet["!rows"] = [{ hpt: 28 }];
  worksheet["!autofilter"] = { ref: `A1:E${rowCount + 1}` };
  worksheet["!views"] = [{ state: "frozen", ySplit: 1, xSplit: 0, topLeftCell: "A2", activeCell: "A2" }];
}

export function downloadSkuHistoryExcel(items: SkuHistoryExportItem[], fileName?: string) {
  const dataRows = buildDataRows(items);
  const worksheet = XLSX.utils.aoa_to_sheet([HEADERS, ...dataRows]);
  applyTableStyles(worksheet, dataRows.length);

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Historico SKUs");
  XLSX.writeFile(workbook, fileName ?? "historico-skus.xlsx");
}
