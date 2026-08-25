import {
  buildDesignationByLocale,
  buildEmptySelectionId,
  buildSkuPreview,
  getAvailableOptions,
  isEmptyReferenceWord,
} from "@/lib/sku";
import { buildSkuCompactReference } from "@/lib/word-combination-limits";
import type { GeneratorCatalog } from "@/lib/types";
import type { SkuAssistantProposal } from "@/lib/sku-assistant/types";

export function normalizeAssistantSelections(
  catalog: GeneratorCatalog,
  rawSelections: Record<string, string>,
): Record<string, string> {
  const normalized: Record<string, string> = {};

  for (const level of catalog.levels) {
    const raw = rawSelections[level.id];
    if (!raw) continue;
    if (raw === "empty" || raw === "000") {
      normalized[level.id] = buildEmptySelectionId(level.id);
      continue;
    }

    const option = level.options.find((entry) => entry.id === raw);
    if (!option) continue;
    normalized[level.id] = isEmptyReferenceWord(option) ? buildEmptySelectionId(level.id) : option.id;
  }

  return normalized;
}

export function validateAssistantProposal(
  catalog: GeneratorCatalog,
  baseSelections: Record<string, string>,
  rawSelections: Record<string, string>,
): { ok: true; proposal: SkuAssistantProposal } | { ok: false; reason: string } {
  const selections = normalizeAssistantSelections(catalog, { ...baseSelections, ...rawSelections });

  for (const level of catalog.levels) {
    const selectedId = selections[level.id];
    if (!selectedId) continue;

    const visible = getAvailableOptions(catalog, level.id, selections);
    const option = level.options.find((entry) => entry.id === selectedId);
    if (!option) {
      return { ok: false, reason: `Selecao invalida em ${level.label}.` };
    }

    if (!visible.some((entry) => entry.id === selectedId)) {
      return { ok: false, reason: `"${option.label}" nao e valido em ${level.label} com as dependencias actuais.` };
    }
  }

  const proposal: SkuAssistantProposal = {
    selections,
    codeHyphen: buildSkuPreview(catalog, selections),
    codeCompact: buildSkuCompactReference(catalog, selections),
    designationPt: buildDesignationByLocale(catalog, selections, "pt"),
    designationEs: buildDesignationByLocale(catalog, selections, "es"),
    designationEn: buildDesignationByLocale(catalog, selections, "en"),
    rationale: "",
    confidence: 0,
  };

  return { ok: true, proposal };
}
