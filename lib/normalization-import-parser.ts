import { createHash } from "node:crypto";
import * as XLSX from "xlsx";
import { isOk2SourceStatus } from "@/lib/normalization-source-status";

export const NORMALIZATION_IMPORT_MAX_BYTES = 10 * 1024 * 1024;

export type ParsedNormalizationImportRow = {
  sourceRowNumber: number;
  legacyCode: string | null;
  legacyDesignation: string | null;
  sourceNewCode: string | null;
  sourceDesignationPt: string | null;
  sourceDesignationEs: string | null;
  sourceDesignationEn: string | null;
  sourceStatus: string | null;
  sourceObservations: string | null;
  normalizationStatus: "pending" | "completed" | "cancelled";
  importIssue: string | null;
};

export type ParsedNormalizationImport = {
  rows: ParsedNormalizationImportRow[];
  sheetName: string;
};

const COLUMN_ALIASES: Record<string, keyof Omit<ParsedNormalizationImportRow, "sourceRowNumber" | "normalizationStatus" | "importIssue">> = {
  referencia_antiga: "legacyCode",
  legacy_code: "legacyCode",
  codigo_antigo: "legacyCode",
  cod_antigo: "legacyCode",
  designacao_antiga: "legacyDesignation",
  legacy_designation: "legacyDesignation",
  designacao: "legacyDesignation",
  referencia_nova: "sourceNewCode",
  source_new_code: "sourceNewCode",
  codigo_novo: "sourceNewCode",
  cod_novo: "sourceNewCode",
  designacao_pt: "sourceDesignationPt",
  source_designation_pt: "sourceDesignationPt",
  designacao_es: "sourceDesignationEs",
  source_designation_es: "sourceDesignationEs",
  designacao_en: "sourceDesignationEn",
  source_designation_en: "sourceDesignationEn",
  estado: "sourceStatus",
  status: "sourceStatus",
  observacoes: "sourceObservations",
  observaciones: "sourceObservations",
  source_observations: "sourceObservations",
};

function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function cleanCell(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : null;
}

function mapRawRow(raw: Record<string, unknown>, sourceRowNumber: number): ParsedNormalizationImportRow {
  const mapped: ParsedNormalizationImportRow = {
    sourceRowNumber,
    legacyCode: null,
    legacyDesignation: null,
    sourceNewCode: null,
    sourceDesignationPt: null,
    sourceDesignationEs: null,
    sourceDesignationEn: null,
    sourceStatus: null,
    sourceObservations: null,
    normalizationStatus: "pending",
    importIssue: null,
  };

  for (const [header, value] of Object.entries(raw)) {
    const key = COLUMN_ALIASES[normalizeHeader(header)];
    if (!key) continue;
    mapped[key] = cleanCell(value);
  }

  if (!mapped.legacyCode) {
    mapped.normalizationStatus = "cancelled";
    mapped.importIssue = "MISSING_LEGACY_CODE";
  } else if (isOk2SourceStatus(mapped.sourceStatus)) {
    mapped.normalizationStatus = "completed";
  }

  return mapped;
}

function isRowEmpty(raw: Record<string, unknown>): boolean {
  return Object.values(raw).every((value) => cleanCell(value) === null);
}

export function parseNormalizationWorkbook(buffer: Buffer): ParsedNormalizationImport {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: false });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return { rows: [], sheetName: "" };
  }

  const sheet = workbook.Sheets[sheetName];
  const jsonRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: false,
  });

  const rows: ParsedNormalizationImportRow[] = [];
  jsonRows.forEach((raw, index) => {
    if (isRowEmpty(raw)) return;
    rows.push(mapRawRow(raw, index + 2));
  });

  return { rows, sheetName };
}

export function sha256Buffer(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

export function summarizeImportRows(rows: ParsedNormalizationImportRow[]) {
  const pendingRows = rows.filter((row) => row.normalizationStatus === "pending").length;
  const completedRows = rows.filter((row) => row.normalizationStatus === "completed").length;
  const invalidRows = rows.filter((row) => row.normalizationStatus === "cancelled").length;
  return {
    totalRows: rows.length,
    pendingRows,
    completedRows,
    invalidRows,
  };
}
