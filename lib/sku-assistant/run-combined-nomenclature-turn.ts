import { callOpenAiJson } from "@/lib/sku-assistant/openai-client";
import type {
  CombinedNomenclatureDesignation,
  CombinedNomenclatureMessage,
  CombinedNomenclatureResponse,
} from "@/lib/sku-assistant/types";

type LlmCombinedNomenclatureResponse = {
  type: "clarify" | "propose" | "message";
  message: string;
  questions?: string[];
  cnCode?: string;
  cnDescription?: string;
  confidence?: number;
  rationale?: string;
  notes?: string;
};

function buildSystemPrompt() {
  return [
    "Es un asistente especializado en la Nomenclatura Combinada (NC) de la Union Europea para clasificacion arancelaria/aduanera.",
    "NO clasifiques referencias internas de empresa ni codigos SKU propios.",
    "Tu objetivo es devolver el codigo NC de 8 digitos correcto para el producto descrito.",
    "",
    "REGLAS:",
    "- Analiza la designacion del producto (PT, ES, EN si estan disponibles).",
    "- Si faltan datos que cambian la NC (material, composicion, uso, forma, contenido, peso neto, si es set, etc.), responde type=clarify con preguntas concretas.",
    "- Ejemplo: 'percha' sin material -> pregunta si es madera, plastico o metal.",
    "- Ejemplo: cosmeticos -> cap. 33; jabones solidos 3401; preparaciones capilares 3305; envases plasticos 3923/3924.",
    "- Solo propone type=propose cuando tengas confianza razonable en el codigo NC.",
    "- cnCode debe ser 8 digitos (puedes devolverlo como 'XXXX XX XX' o 'XXXXXXXX').",
    "- cnDescription: descripcion oficial/resumida en portugues de la partida NC.",
    "- Responde SIEMPRE JSON valido:",
    '{"type":"clarify|propose|message","message":"texto","questions":["..."],"cnCode":"3305 90 00","cnDescription":"...","confidence":0.85,"rationale":"...","notes":"..."}',
  ].join("\n");
}

function summarizeDesignation(designation: CombinedNomenclatureDesignation) {
  return [
    `Designacao PT: ${designation.designationPt}`,
    designation.designationEs ? `Designacao ES: ${designation.designationEs}` : null,
    designation.designationEn ? `Designacao EN: ${designation.designationEn}` : null,
    designation.referenceCode ? `Referencia interna (NO es NC): ${designation.referenceCode}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

export function normalizeCnCode(code: string): string | null {
  const digits = code.replace(/\D/g, "");
  if (digits.length !== 8) return null;
  return `${digits.slice(0, 4)} ${digits.slice(4, 6)} ${digits.slice(6, 8)}`;
}

function buildProposal(llm: LlmCombinedNomenclatureResponse): CombinedNomenclatureResponse {
  const normalized = normalizeCnCode(String(llm.cnCode ?? ""));
  if (!normalized) {
    return {
      type: "message",
      message: "Nao consegui determinar un codigo NC valido de 8 digitos. Da mais detalhes sobre material, composicao ou uso.",
    };
  }

  return {
    type: "propose",
    message: llm.message,
    proposal: {
      cnCode: normalized,
      cnDescription: String(llm.cnDescription ?? "").trim() || "Sem descricao NC.",
      confidence: Number(llm.confidence ?? 0),
      rationale: String(llm.rationale ?? "").trim(),
      notes: String(llm.notes ?? "").trim() || undefined,
    },
  };
}

export async function runCombinedNomenclatureTurn(input: {
  designation: CombinedNomenclatureDesignation;
  messages: CombinedNomenclatureMessage[];
}): Promise<CombinedNomenclatureResponse> {
  const conversationBlock =
    input.messages.length > 0
      ? ["Conversa:", ...input.messages.map((message) => `${message.role.toUpperCase()}: ${message.content}`)].join("\n")
      : "Conversa: (inicio automatico — classifica a partir da designacao)";

  const llm = await callOpenAiJson<LlmCombinedNomenclatureResponse>([
    { role: "system", content: buildSystemPrompt() },
    {
      role: "user",
      content: [
        "Produto a classificar:",
        summarizeDesignation(input.designation),
        "",
        conversationBlock,
      ].join("\n"),
    },
  ]);

  if (llm.type === "clarify") {
    return {
      type: "clarify",
      message: llm.message,
      questions: (llm.questions ?? []).filter(Boolean),
    };
  }

  if (llm.type === "propose") {
    return buildProposal(llm);
  }

  return {
    type: "message",
    message: llm.message || "Nao consegui classificar este produto. Indica material, composicao ou uso.",
  };
}
