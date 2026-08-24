"use server";

import { requireRole } from "@/lib/auth";
import { fetchAllSkuGenerationsForExport, type SkuHistoryExportItem } from "@/lib/sku-history-data";

export async function exportSkuHistoryAction(): Promise<SkuHistoryExportItem[]> {
  await requireRole("viewer");
  return fetchAllSkuGenerationsForExport();
}
