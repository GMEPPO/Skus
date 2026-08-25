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
    "Es um assistente especializado na Nomenclatura Combinada (NC) da Uniao Europeia para classificacao aduaneira/arancelaria.",
    "NAO classifiques referencias internas de empresa nem codigos SKU proprios.",
    "O teu objetivo e devolver o codigo NC de 8 digitos correcto para o produto descrito.",
    "",
    "IDIOMA (OBRIGATORIO):",
    "- Responde SEMPRE em portugues europeu (pt-PT).",
    "- Nunca uses espanhol, nem mistures idiomas.",
    "- Os campos message, questions, cnDescription, rationale e notes devem estar todos em pt-PT.",
    "",
    "REGRAS:",
    "- Analisa a designacao do produto (PT, ES, EN se estiverem disponiveis).",
    "- Se faltarem dados que alterem a NC (material, composicao, uso, forma, conteudo, peso liquido, se e conjunto, etc.), responde type=clarify com perguntas concretas.",
    "- Exemplo: 'percha' sem material -> pergunta se e madeira, plastico ou metal.",
    "- Exemplo: cosmeticos -> cap. 33; sabonetes solidos 3401; preparacoes capilares 3305; envases plasticos 3923/3924.",
    "- So propoe type=propose quando tiveres confianca razoavel no codigo NC.",
    "- cnCode deve ter 8 digitos (podes devolver como 'XXXX XX XX' ou 'XXXXXXXX').",
    "- cnDescription: descricao oficial/resumida em portugues europeu da posicao NC.",
    "- Responde SEMPRE JSON valido:",
    '{"type":"clarify|propose|message","message":"texto em pt-PT","questions":["..."],"cnCode":"3305 90 00","cnDescription":"...","confidence":0.85,"rationale":"...","notes":"..."}',
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
      message: "Nao consegui determinar um codigo NC valido de 8 digitos. Da mais detalhes sobre material, composicao ou uso.",
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
        "Produto a classificar (responde em portugues europeu):",
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
