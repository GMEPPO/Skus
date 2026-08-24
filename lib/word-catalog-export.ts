import * as XLSX from "xlsx";
import type { FieldTypeOption } from "@/lib/admin-catalog";
import type { WordListItem } from "@/lib/types";

function formatExportDate(value: string) {
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

function wordRow(word: WordListItem) {
  return [
    word.referenceCode,
    word.label,
    word.designationPt,
    word.designationEs,
    word.designationEn,
    word.selectionHierarchy ?? "",
    word.includeInDesignation ? "Sim" : "Nao",
    word.parentWordLabels.join("; "),
    word.parentMatchMode,
  ];
}

const WORD_HEADERS = [
  "Referencia",
  "Palavra",
  "Designacao PT",
  "Designacao ES",
  "Designacao EN",
  "Jerarquia",
  "Incluir designacao",
  "Padres",
  "Modo padres",
];

export function downloadWordCatalogExcel(
  words: WordListItem[],
  fieldTypes: FieldTypeOption[],
  fileName?: string,
) {
  const levelByFieldTypeId = new Map(fieldTypes.map((fieldType, index) => [fieldType.id, index + 1]));

  const wordsByLevel = new Map<number, WordListItem[]>();
  for (const fieldType of fieldTypes) {
    wordsByLevel.set(levelByFieldTypeId.get(fieldType.id) ?? 0, []);
  }

  for (const word of words) {
    const level = levelByFieldTypeId.get(word.fieldTypeId) ?? 0;
    const bucket = wordsByLevel.get(level) ?? [];
    bucket.push(word);
    wordsByLevel.set(level, bucket);
  }

  const workbook = XLSX.utils.book_new();

  const summaryRows = [
    ["Nivel", "Nombre", "Palabras"],
    ...fieldTypes.map((fieldType, index) => [
      index + 1,
      fieldType.name,
      (wordsByLevel.get(index + 1) ?? []).length,
    ]),
    [],
    ["Total", "", words.length],
    [],
    ["Exportado em", formatExportDate(new Date().toISOString())],
  ];
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(summaryRows), "Resumen");

  const allRows: Array<Array<string | number>> = [["Nivel", "Nombre nivel", ...WORD_HEADERS]];
  for (const fieldType of fieldTypes) {
    const level = levelByFieldTypeId.get(fieldType.id) ?? 0;
    for (const word of wordsByLevel.get(level) ?? []) {
      allRows.push([level, fieldType.name, ...wordRow(word)]);
    }
  }
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(allRows), "Todo");

  for (const fieldType of fieldTypes) {
    const level = levelByFieldTypeId.get(fieldType.id) ?? 0;
    const sheetName = `Nivel ${level}`.slice(0, 31);
    const rows = [WORD_HEADERS, ...(wordsByLevel.get(level) ?? []).map(wordRow)];
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), sheetName);
  }

  XLSX.writeFile(workbook, fileName ?? "biblioteca-palavras.xlsx");
}
