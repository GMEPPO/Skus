import type { CombinedNomenclatureAbbreviation, CombinedNomenclatureDesignation } from "@/lib/sku-assistant/types";

const RECARGA_PATTERN = /\brecarga\b|\brefill\b|\brec\s|\becs\b/i;
const FRASCO_PATTERN = /\bfrasco\b|\bflacon\b/i;
const GARRAFA_PATTERN = /\bgarrafa\b|\bbotella ecofill\b|\bbottle ecofill\b/i;

const LIQUID_PRODUCT_PATTERN =
  /condicionador|acondicionador|conditioner|shampoo|champo|gel|sabonete|soap|locao|lotion|balsamo|balm|creme|cream|body wash|limpeza|lavant/i;

type FormatKind = "empty-garrafa" | "filled-recarga" | "filled-frasco" | null;

function formatEntryText(entry: CombinedNomenclatureAbbreviation) {
  return `${entry.label} ${entry.designationPt}`.toLowerCase();
}

function detectFormatKind(
  combinedDesignation: string,
  abbreviationGlossary: CombinedNomenclatureAbbreviation[],
): FormatKind {
  const formatEntry = abbreviationGlossary.find((entry) => entry.fieldType === "format");
  const formatText = formatEntry ? formatEntryText(formatEntry) : "";
  const combined = `${combinedDesignation} ${formatText}`.toLowerCase();

  if (RECARGA_PATTERN.test(combined) || (formatText && /\brecarga\b/.test(formatText))) {
    return "filled-recarga";
  }

  if (FRASCO_PATTERN.test(combined) || (formatText && /\bfrasco\b/.test(formatText))) {
    return "filled-frasco";
  }

  if (GARRAFA_PATTERN.test(combined) || (formatText && /\bgarrafa\b/.test(formatText))) {
    return "empty-garrafa";
  }

  return null;
}

function buildEmptyGarrafaContext(
  designation: CombinedNomenclatureDesignation,
  abbreviationGlossary: CombinedNomenclatureAbbreviation[],
): string {
  const packagingMaterial = abbreviationGlossary.find((entry) => entry.fieldType === "packaging");
  const namesLiquidProduct = LIQUID_PRODUCT_PATTERN.test(
    [designation.designationPt, designation.designationEs, designation.designationEn].filter(Boolean).join(" "),
  );

  const lines = [
    "CONTEXTO OBRIGATORIO — GARRAFA VAZIA (amenities hoteleiras):",
    "- Formato Garrafa/Ecofill = RECIPIENTE VAZIO para encher no hotel, sem liquido cosmetico dentro.",
    "- Condicionador, Shampoo, Gel, etc. na designacao indicam o TIPO de garrafa, nao o conteudo.",
    "- NAO uses capitulo 33 (cosmeticos/preparacoes liquidas enchidas).",
    "- NAO perguntes composicao do liquido; classifica material e forma do envase vazio.",
  ];

  if (namesLiquidProduct) {
    lines.push("- O produto cosmetico (ex. condicionador) NAO esta dentro desta garrafa vazia.");
  }

  if (packagingMaterial) {
    lines.push(
      `- Material do envase (glossario): ${packagingMaterial.referenceCode} = ${packagingMaterial.designationPt}.`,
      "- Classifica pelo material do envase vazio (ex.: aluminio 7610/7612, plastico 3923/3924).",
    );
  }

  lines.push("- Devolve apenas UM codigo NC final (type=propose).");
  return lines.join("\n");
}

function buildFilledProductContext(kind: "filled-recarga" | "filled-frasco"): string {
  const formatLabel = kind === "filled-recarga" ? "Recarga" : "Frasco";

  return [
    `CONTEXTO OBRIGATORIO — ${formatLabel.toUpperCase()} COM LIQUIDO:`,
    `- Formato ${formatLabel} = produto cosmetico LIQUIDO ENCHIDO dentro do envase, nao envase vazio.`,
    "- Classifica como preparacao cosmetica ou produto de higiene (capitulo 33, ou 3401 para sabonetes solidos).",
    "- Exemplos: condicionador liquido -> 3305; shampoo -> 3305; gel duche/corpo -> 3307; sabonete liquido -> 3401.",
    "- Condicionador/Shampoo/Gel na designacao indicam o TIPO de produto liquido dentro.",
    "- Podes perguntar composicao ou ingredientes especificos apenas se forem decisivos para a subposicao NC.",
    "- NAO classifiques como envase vazio de aluminio/plastico (7612/3923) — ha liquido cosmetico dentro.",
    "- Devolve apenas UM codigo NC final (type=propose).",
  ].join("\n");
}

export function inferNcProductContext(
  designation: CombinedNomenclatureDesignation,
  abbreviationGlossary: CombinedNomenclatureAbbreviation[] = [],
): string | null {
  const combinedDesignation = [designation.designationPt, designation.designationEs, designation.designationEn]
    .filter(Boolean)
    .join(" ");

  const formatKind = detectFormatKind(combinedDesignation, abbreviationGlossary);

  if (formatKind === "empty-garrafa") {
    return buildEmptyGarrafaContext(designation, abbreviationGlossary);
  }

  if (formatKind === "filled-recarga" || formatKind === "filled-frasco") {
    return buildFilledProductContext(formatKind);
  }

  return null;
}

/** @deprecated Use inferNcProductContext */
export function inferEmptyContainerContext(
  designation: CombinedNomenclatureDesignation,
  abbreviationGlossary: CombinedNomenclatureAbbreviation[] = [],
): string | null {
  const context = inferNcProductContext(designation, abbreviationGlossary);
  return context?.includes("GARRAFA VAZIA") ? context : null;
}

export { detectFormatKind };
