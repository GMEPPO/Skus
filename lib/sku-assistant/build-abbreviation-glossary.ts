import { isEmptyReferenceWord } from "@/lib/sku";
import type { GeneratorCatalog } from "@/lib/types";

export type AbbreviationGlossaryEntry = {
  levelLabel: string;
  fieldType: string;
  referenceCode: string;
  label: string;
  designationPt: string;
};

export function buildAbbreviationGlossary(
  catalog: GeneratorCatalog,
  selections: Record<string, string>,
): AbbreviationGlossaryEntry[] {
  const entries: AbbreviationGlossaryEntry[] = [];

  for (const level of catalog.levels) {
    const selectedId = selections[level.id];
    if (!selectedId) continue;

    const option = level.options.find((item) => item.id === selectedId);
    if (!option || isEmptyReferenceWord(option)) continue;

    entries.push({
      levelLabel: level.label,
      fieldType: level.fieldType,
      referenceCode: option.referenceCode,
      label: option.label,
      designationPt: option.designationPt || option.label,
    });
  }

  return entries;
}

export function summarizeAbbreviationGlossaryForPrompt(entries: AbbreviationGlossaryEntry[]): string {
  if (entries.length === 0) {
    return "Nenhuma abreviatura seleccionada disponivel.";
  }

  const lines = [
    "Glossario de abreviaturas internas deste SKU (codigos de 3 letras na designacao):",
    ...entries.map(
      (entry) =>
        `- ${entry.referenceCode} (${entry.levelLabel}/${entry.fieldType}): ${entry.designationPt} [${entry.label}]`,
    ),
    "",
    "Usa este glossario para interpretar siglas como ALU, CLS, ECO, etc. na designacao.",
    "ALU costuma significar aluminio/embalagem em aluminio; CLS costuma ser variante/classico (extra).",
  ];

  return lines.join("\n");
}
