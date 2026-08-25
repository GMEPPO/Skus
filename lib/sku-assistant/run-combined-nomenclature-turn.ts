import { callOpenAiJson } from "@/lib/sku-assistant/openai-client";
import { summarizeAbbreviationGlossaryForPrompt } from "@/lib/sku-assistant/build-abbreviation-glossary";
import { inferEmptyContainerContext } from "@/lib/sku-assistant/infer-empty-container-context";
import type {
  CombinedNomenclatureAbbreviation,
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
    "",
    "ENVASES VAZIOS (amenities hoteleiras — MUITO IMPORTANTE):",
    "- Se a designacao inclui Garrafa, Ecofill, Recarga, Bottle ou formato equivalente, classifica o ENVASE VAZIO, nunca o liquido.",
    "- Condicionador, Shampoo, Gel, Sabonete, etc. na designacao indicam o tipo de garrafa/envase, NAO o produto cosmetico enchido.",
    "- NAO uses capitulo 33 (cosmeticos) para garrafas/ecofill vazias.",
    "- NAO perguntes composicao do condicionador/shampoo/gel; pergunta material, capacidade ou fecho do envase se faltar.",
    "- Usa ALU/Plastico/Vidro do glossario como material do envase.",
    "",
    "OUTROS EXEMPLOS:",
    "- Sabonete solido enchido -> 3401; preparacao capilar liquida enchida -> 3305; envases plasticos vazios -> 3923/3924.",
    "- So propoe type=propose quando tiveres confianca razoavel no codigo NC.",
    "- Devolve apenas UMA proposta NC por resposta (um unico cnCode).",
    "- cnCode deve ter 8 digitos (podes devolver como 'XXXX XX XX' ou 'XXXXXXXX').",
    "- cnDescription: descricao oficial/resumida em portugues europeu da posicao NC.",
    "- Usa o glossario de abreviaturas internas (ALU, CLS, ECO, etc.) para interpretar a designacao antes de classificar.",
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
  abbreviationGlossary?: CombinedNomenclatureAbbreviation[];
}): Promise<CombinedNomenclatureResponse> {
  const conversationBlock =
    input.messages.length > 0
      ? ["Conversa:", ...input.messages.map((message) => `${message.role.toUpperCase()}: ${message.content}`)].join("\n")
      : "Conversa: (inicio automatico — classifica a partir da designacao)";

  const glossaryBlock = summarizeAbbreviationGlossaryForPrompt(input.abbreviationGlossary ?? []);
  const containerContext = inferEmptyContainerContext(input.designation, input.abbreviationGlossary);

  const llm = await callOpenAiJson<LlmCombinedNomenclatureResponse>([
    { role: "system", content: buildSystemPrompt() },
    {
      role: "user",
      content: [
        "Produto a classificar (responde em portugues europeu):",
        summarizeDesignation(input.designation),
        "",
        glossaryBlock,
        containerContext ? ["", containerContext].join("\n") : "",
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
