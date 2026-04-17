import type { NormalizerConfig, NormalizerStatus, RuleRuntimeContext } from "@/lib/reference-normalizer/types";

export function validateRow(context: RuleRuntimeContext, config: NormalizerConfig) {
  const observations = [...context.trace.warnings];

  if (!context.input.oldReference && !context.input.oldDesignation) {
    observations.push("Linha sem referencia antiga e sem designacao antiga.");
    return { status: "ERROR" as NormalizerStatus, observations };
  }

  if (!context.input.oldReference) observations.push("Referencia antiga em falta.");
  if (!context.input.oldDesignation) observations.push("Designacao antiga em falta.");

  if (!context.segments.brand) observations.push("Marca nao identificada com seguranca.");
  if (!context.segments.format) observations.push("Formato nao identificado com seguranca.");
  if (!context.segments.product) observations.push("Produto nao identificado com seguranca.");

  if (context.overrides.preservedReferenceTokens.has("VAZ") && !context.builtReference.includes("VAZ")) {
    observations.push("A referencia nova perdeu o token VAZ.");
  }

  if ((context.segments.brand?.canonicalValue ?? "") === "CASTELBEL" && !context.builtReference.includes("CAS")) {
    observations.push("A referencia nova deve manter o codigo de CASTELBEL.");
  }

  const nearLimitWarnings = [
    { language: "PT", count: context.designationDraft.pt.length, limit: config.settings.charLimitPt },
    { language: "ES", count: context.designationDraft.es.length, limit: config.settings.charLimitEs },
    { language: "EN", count: context.designationDraft.en.length, limit: config.settings.charLimitEn },
  ];

  for (const item of nearLimitWarnings) {
    if (item.count > item.limit) {
      observations.push(`Designacao ${item.language} excede o limite de ${item.limit} caracteres.`);
    } else if (item.count >= item.limit - 3) {
      observations.push(`Designacao ${item.language} perto do limite (${item.count}/${item.limit}).`);
    }
  }

  if (observations.some((item) => item.toLowerCase().includes("em falta"))) {
    return { status: "ERROR" as NormalizerStatus, observations };
  }

  if (context.reviewForced || observations.length > 0) {
    return { status: "REVIEW" as NormalizerStatus, observations };
  }

  return { status: "OK" as NormalizerStatus, observations };
}
