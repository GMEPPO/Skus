import { getGeneratorCatalogForCategory } from "@/lib/category-catalog";
import { mapCategoryCatalogToGeneratorCatalog } from "@/lib/generator-catalog-mapper";
import { buildCatalogCandidates, summarizeCandidatesForPrompt } from "@/lib/sku-assistant/catalog-candidates";
import { callOpenAiJson } from "@/lib/sku-assistant/openai-client";
import type { SkuAssistantMessage, SkuAssistantResponse } from "@/lib/sku-assistant/types";
import { normalizeAssistantSelections, validateAssistantProposal } from "@/lib/sku-assistant/validate-proposal";

type LlmTurnResponse = {
  type: "clarify" | "propose" | "message";
  message: string;
  questions?: string[];
  selections?: Record<string, string>;
  confidence?: number;
  rationale?: string;
};

function buildSystemPrompt(levelSummary: string, candidatesSummary: string) {
  return [
    "Es un asistente de nomenclatura combinada SKU para productos de hotel/cosmetica.",
    "Tu trabajo es ayudar a encontrar el codigo correcto de 6 niveles: brand, format, product, size, packaging, extra.",
    "REGLAS ESTRICTAS:",
    "- Solo puedes proponer wordId que aparezcan en CANDIDATOS.",
    "- Nunca inventes referenceCode ni wordId.",
    "- Si falta informacion critica (color, material, tamano, marca, formato, embalaje), responde type=clarify con preguntas concretas.",
    "- Ejemplo: si el usuario dice 'percha' sin color ni material, pregunta por color y material antes de proponer.",
    "- Si no hay candidatos suficientes, pide mas detalles.",
    "- Responde SIEMPRE JSON valido con este schema:",
    '{"type":"clarify|propose|message","message":"texto","questions":["..."],"selections":{"levelId":"wordId"},"confidence":0.0,"rationale":"..."}',
    "",
    "NIVELES:",
    levelSummary,
    "",
    "CANDIDATOS (usa solo estos wordId):",
    candidatesSummary,
  ].join("\n");
}

function summarizeLevels(catalog: ReturnType<typeof mapCategoryCatalogToGeneratorCatalog>) {
  return catalog.levels
    .map((level) => `- ${level.label} (${level.fieldType}) levelId=${level.id}`)
    .join("\n");
}

function summarizeCurrentSelections(
  catalog: ReturnType<typeof mapCategoryCatalogToGeneratorCatalog>,
  selections: Record<string, string>,
) {
  const parts = catalog.levels
    .map((level) => {
      const selectedId = selections[level.id];
      if (!selectedId) return null;
      const option = level.options.find((entry) => entry.id === selectedId);
      if (!option) return null;
      return `${level.label}: ${option.label} (${option.referenceCode})`;
    })
    .filter(Boolean);

  return parts.length ? parts.join(" | ") : "Nenhuma selecao actual.";
}

export async function runSkuAssistantTurn(input: {
  categoryId: string;
  messages: SkuAssistantMessage[];
  currentSelections: Record<string, string>;
  generatedSku?: {
    codeCompact: string;
    designationPt: string;
    designationEs: string;
    designationEn: string;
  };
}): Promise<SkuAssistantResponse> {
  const categoryCatalog = await getGeneratorCatalogForCategory(input.categoryId);
  if (!categoryCatalog) {
    return { type: "message", message: "Categoria invalida ou catalogo indisponivel." };
  }

  const catalog = mapCategoryCatalogToGeneratorCatalog(categoryCatalog);
  const lastUserMessage = [...input.messages].reverse().find((message) => message.role === "user")?.content ?? "";
  const candidates = buildCatalogCandidates(catalog, input.currentSelections, lastUserMessage);

  const llm = await callOpenAiJson<LlmTurnResponse>([
    {
      role: "system",
      content: buildSystemPrompt(summarizeLevels(catalog), summarizeCandidatesForPrompt(candidates)),
    },
    {
      role: "user",
      content: [
        `Seleccao actual: ${summarizeCurrentSelections(catalog, input.currentSelections)}`,
        input.generatedSku
          ? [
              "",
              "SKU ja gerado nesta sessao:",
              `Referencia: ${input.generatedSku.codeCompact}`,
              `Designacao PT: ${input.generatedSku.designationPt}`,
              `Designacao ES: ${input.generatedSku.designationEs}`,
              `Designacao EN: ${input.generatedSku.designationEn}`,
            ].join("\n")
          : "",
        "",
        "Conversa:",
        ...input.messages.map((message) => `${message.role.toUpperCase()}: ${message.content}`),
      ].join("\n"),
    },
  ]);

  if (llm.type === "clarify") {
    return {
      type: "clarify",
      message: llm.message,
      questions: (llm.questions ?? []).filter(Boolean),
      partialSelections: llm.selections ? normalizeAssistantSelections(catalog, llm.selections) : undefined,
    };
  }

  if (llm.type === "propose" && llm.selections) {
    const validated = validateAssistantProposal(catalog, input.currentSelections, llm.selections);
    if (!validated.ok) {
      return {
        type: "clarify",
        message: validated.reason,
        questions: ["Podes dar mais detalhes sobre marca, formato, produto, tamanho ou embalagem?"],
      };
    }

    return {
      type: "propose",
      message: llm.message,
      proposal: {
        ...validated.proposal,
        rationale: llm.rationale ?? "",
        confidence: Number(llm.confidence ?? 0),
      },
    };
  }

  return {
    type: "message",
    message: llm.message || "Nao consegui encontrar una combinacion valida. Da mas detalhes del producto.",
  };
}
