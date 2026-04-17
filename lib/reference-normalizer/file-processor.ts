import { processRow } from "@/lib/reference-normalizer/row-processor";
import type { NormalizerConfig, WorkbookProcessingResult } from "@/lib/reference-normalizer/types";

export function processRows(
  rows: Array<{ rowNumber: number; originalRow: Record<string, unknown>; oldReference: string; oldDesignation: string; keepExtraColumns: boolean }>,
  config: NormalizerConfig,
): WorkbookProcessingResult {
  const processed = rows.map((row) => processRow(row, config));

  return {
    rows: processed,
    summary: {
      total: processed.length,
      OK: processed.filter((row) => row.status === "OK").length,
      REVIEW: processed.filter((row) => row.status === "REVIEW").length,
      ERROR: processed.filter((row) => row.status === "ERROR").length,
      MANUAL: processed.filter((row) => row.status === "MANUAL").length,
    },
  };
}
