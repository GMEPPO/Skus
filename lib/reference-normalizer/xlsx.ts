import * as XLSX from "xlsx";
import type { RowProcessResult, WorkbookSheetData } from "@/lib/reference-normalizer/types";

export async function readWorkbookFile(file: File): Promise<WorkbookSheetData[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });

  return workbook.SheetNames.map((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
    const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

    return {
      sheetName,
      columns,
      rows,
    };
  });
}

export function downloadNormalizerTemplate() {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet([
    {
      Referencia_antiga: "CASECOBOD030VAZ",
      Designacao_antiga: "CASTELBEL Garrafa Ecofill Locao de Maos e Corpo 30ml Vazia",
    },
  ]);

  XLSX.utils.book_append_sheet(workbook, worksheet, "Template");
  XLSX.writeFile(workbook, "normalizador-template.xlsx");
}

export function downloadProcessedWorkbook(
  rows: RowProcessResult[],
  originalSheetName: string,
  keepExtraColumns: boolean,
) {
  const workbook = XLSX.utils.book_new();
  const exportRows = rows.map((row) => ({
    ...(keepExtraColumns ? row.originalRow : {}),
    row_number: row.rowNumber,
    Referencia_antiga: row.oldReference,
    Designacao_antiga: row.oldDesignation,
    Referencia_nova: row.newReference,
    Designacao_nova_pt: row.designationPt,
    caracteres_pt: row.charactersPt,
    Designacao_nova_es: row.designationEs,
    caracteres_es: row.charactersEs,
    Designacao_nova_en: row.designationEn,
    caracteres_en: row.charactersEn,
    status: row.status,
    observacoes: row.observations.join(" | "),
    trace_summary_json: JSON.stringify({
      segments: {
        brand: row.segments.brand?.canonicalValue ?? "",
        format: row.segments.format?.canonicalValue ?? "",
        product: row.segments.product?.canonicalValue ?? "",
        size: row.segments.size?.canonicalValue ?? "",
        packaging: row.segments.packaging?.canonicalValue ?? "",
        extra: row.segments.extra?.canonicalValue ?? "",
      },
      triggeredRules: row.trace.triggeredRules,
      warnings: row.trace.warnings,
    }),
  }));

  const worksheet = XLSX.utils.json_to_sheet(exportRows);
  XLSX.utils.book_append_sheet(workbook, worksheet, originalSheetName || "Resultados");
  XLSX.writeFile(workbook, "normalizador-resultados.xlsx");
}
