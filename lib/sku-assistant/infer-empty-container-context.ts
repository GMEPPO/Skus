import type { CombinedNomenclatureAbbreviation, CombinedNomenclatureDesignation } from "@/lib/sku-assistant/types";

const BOTTLE_FORMAT_PATTERN =
  /garrafa|botella|bottle|ecofill|recarga|flacon|flacon|doseador|dispenser|envase|embalagem/i;

const LIQUID_PRODUCT_PATTERN =
  /condicionador|acondicionador|conditioner|shampoo|champo|gel|sabonete|soap|locao|lotion|balsamo|balm|creme|cream/i;

export function inferEmptyContainerContext(
  designation: CombinedNomenclatureDesignation,
  abbreviationGlossary: CombinedNomenclatureAbbreviation[] = [],
): string | null {
  const combined = [designation.designationPt, designation.designationEs, designation.designationEn]
    .filter(Boolean)
    .join(" ");

  const hasBottleFormat =
    BOTTLE_FORMAT_PATTERN.test(combined) ||
    abbreviationGlossary.some(
      (entry) =>
        entry.fieldType === "format" && BOTTLE_FORMAT_PATTERN.test(`${entry.label} ${entry.designationPt}`),
    );

  if (!hasBottleFormat) return null;

  const namesLiquidProduct = LIQUID_PRODUCT_PATTERN.test(combined);
  const packagingMaterial = abbreviationGlossary.find((entry) => entry.fieldType === "packaging");

  const lines = [
    "CONTEXTO OBRIGATORIO — ENVASE VAZIO (amenities hoteleiras):",
    "- A designacao descreve um RECIPIENTE/ENVASE VAZIO, nao o liquido cosmetico enchido.",
    "- Termos como Garrafa, Ecofill, Recarga, Bottle indicam formato de envase vazio.",
  ];

  if (namesLiquidProduct) {
    lines.push(
      "- Palavras como Condicionador, Shampoo, Gel ou Sabonete indicam o TIPO de envase, nao o conteudo liquido.",
      "- NAO classifiques como preparacao cosmetica (cap. 33) nem perguntes composicao do liquido.",
    );
  }

  if (packagingMaterial) {
    lines.push(
      `- Material do envase (glossario): ${packagingMaterial.referenceCode} = ${packagingMaterial.designationPt}.`,
      "- Classifica pelo material e forma do envase vazio (ex.: aluminio 7610/7612, plastico 3923/3924).",
    );
  } else {
    lines.push("- Classifica pelo material e forma do envase vazio; pergunta material apenas se nao estiver no glossario.");
  }

  lines.push("- Devolve apenas UM codigo NC final (type=propose) quando tiveres confianca.");

  return lines.join("\n");
}
