import type { ColumnDetectionResult } from "@/lib/reference-normalizer/types";
import { normalizeKey, normalizeText } from "@/lib/reference-normalizer/normalization";

const REFERENCE_CANDIDATES = [
  "Referencia",
  "Referência",
  "Referencia antigua",
  "referencia",
  "Referencia_antiga",
  "Referência_antiga",
  "Referencia antiga",
  "Referência antiga",
  "codigo antiguo",
  "codigo antigo",
  "referencia antiga",
];

const DESIGNATION_CANDIDATES = [
  "Designacao",
  "Designação",
  "Descripcion",
  "Descrição",
  "designacao",
  "Designacao_antiga",
  "Designação_antiga",
  "Designacao antiga",
  "Designação antiga",
  "descripcion antigua",
  "descricao antiga",
  "designacao antiga",
];

function columnScore(column: string, candidates: string[]) {
  const normalizedColumn = normalizeKey(column);
  let score = 0;

  for (const candidate of candidates) {
    const normalizedCandidate = normalizeKey(candidate);
    if (normalizedColumn === normalizedCandidate) score += 100;
    else if (normalizedColumn.startsWith(normalizedCandidate)) score += 70;
    else if (normalizedColumn.includes(normalizedCandidate)) score += 50;

    const plainColumn = normalizeText(column);
    const plainCandidate = normalizeText(candidate);
    if (plainColumn === plainCandidate) score += 25;
  }

  return score;
}

export function detectColumns(columns: string[]): ColumnDetectionResult {
  const scoreByColumn: Record<string, number> = {};
  let bestReference: { column: string | null; score: number } = { column: null, score: 0 };
  let bestDesignation: { column: string | null; score: number } = { column: null, score: 0 };

  for (const column of columns) {
    const referenceScore = columnScore(column, REFERENCE_CANDIDATES);
    const designationScore = columnScore(column, DESIGNATION_CANDIDATES);

    scoreByColumn[column] = Math.max(referenceScore, designationScore);

    if (referenceScore > bestReference.score) bestReference = { column, score: referenceScore };
    if (designationScore > bestDesignation.score) bestDesignation = { column, score: designationScore };
  }

  return {
    referenceColumn: bestReference.score > 0 ? bestReference.column : null,
    designationColumn: bestDesignation.score > 0 ? bestDesignation.column : null,
    scoreByColumn,
  };
}
