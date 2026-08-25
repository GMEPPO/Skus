import { filterGeneratorWords, getAvailableOptions } from "@/lib/sku";
import type { GeneratorCatalog } from "@/lib/types";
import type { SkuAssistantCandidate } from "@/lib/sku-assistant/types";

const MAX_CANDIDATES_PER_LEVEL = 12;

function tokenizeQuery(query: string) {
  return query
    .toLowerCase()
    .split(/[^a-z0-9à-ú]+/i)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
}

export function buildCatalogCandidates(
  catalog: GeneratorCatalog,
  selections: Record<string, string>,
  query: string,
): SkuAssistantCandidate[] {
  const tokens = tokenizeQuery(query);
  const candidates: SkuAssistantCandidate[] = [];

  for (const level of catalog.levels) {
    const visible = getAvailableOptions(catalog, level.id, selections);
    const ranked = tokens.length
      ? tokens.flatMap((token) => filterGeneratorWords(visible, token))
      : visible;

    const unique = new Map<string, (typeof visible)[number]>();
    for (const option of ranked) {
      if (!unique.has(option.id)) unique.set(option.id, option);
    }

    for (const option of [...unique.values()].slice(0, MAX_CANDIDATES_PER_LEVEL)) {
      candidates.push({
        levelId: level.id,
        levelLabel: level.label,
        fieldType: level.fieldType,
        wordId: option.id,
        label: option.label,
        referenceCode: option.referenceCode,
        designationPt: option.designationPt || option.designation || option.label,
      });
    }
  }

  return candidates;
}

export function summarizeCandidatesForPrompt(candidates: SkuAssistantCandidate[]) {
  if (candidates.length === 0) return "Sem candidatos encontrados para esta pesquisa.";
  return candidates
    .map(
      (candidate) =>
        `- [${candidate.fieldType}] ${candidate.levelLabel}: wordId=${candidate.wordId} | ref=${candidate.referenceCode} | ${candidate.label} | designacao=${candidate.designationPt}`,
    )
    .join("\n");
}
