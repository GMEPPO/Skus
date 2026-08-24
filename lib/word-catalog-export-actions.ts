"use server";

import { getFieldTypeOptions, getWordsCatalog } from "@/lib/admin-catalog";
import { requireRole } from "@/lib/auth";
import type { FieldTypeOption } from "@/lib/admin-catalog";
import type { WordListItem } from "@/lib/types";

export interface WordCatalogExportPayload {
  words: WordListItem[];
  fieldTypes: FieldTypeOption[];
}

export async function exportWordCatalogAction(): Promise<WordCatalogExportPayload> {
  await requireRole("viewer");
  const [words, fieldTypes] = await Promise.all([getWordsCatalog(), getFieldTypeOptions()]);
  return { words, fieldTypes };
}
