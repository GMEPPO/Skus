"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { isNormalizationV2Enabled, isSecureGenerationV2Enabled } from "@/lib/skus-feature-flags";
import { toUpperDesignation } from "@/lib/sku";

const measureStatusSchema = z.enum(["real", "estimated"]);

function isLogisticsRequired(formData: FormData): boolean {
  return formData.get("requireLogisticsData") !== "off";
}

const generateSecureSchema = z
  .object({
    categoryId: z.string().uuid(),
    selectionsJson: z.string().min(2),
    requireLogisticsData: z.enum(["on", "off"]).default("on"),
    requestId: z.string().uuid().optional(),
    unitsPerBox: z.coerce.number().positive().optional(),
    unitsPerBoxStatus: measureStatusSchema.optional(),
    multiples: z.coerce.number().positive().optional(),
    multiplesStatus: measureStatusSchema.optional(),
    weight: z.coerce.number().positive().optional(),
    weightStatus: measureStatusSchema.optional(),
  })
  .superRefine((data, ctx) => {
    if (data.requireLogisticsData === "off") {
      return;
    }
    if (
      !data.requestId ||
      data.unitsPerBox == null ||
      data.multiples == null ||
      data.weight == null ||
      !data.unitsPerBoxStatus ||
      !data.multiplesStatus ||
      !data.weightStatus
    ) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "invalid_payload" });
    }
  });

export type GenerateSkuSecureActionResult =
  | {
      ok: true;
      message: string;
      created: boolean;
      generationId: string;
      generatedCode: string;
      generatedCodeCompact: string;
      designationPt: string;
      designationEs: string;
      designationEn: string;
      snapshotVersion: number;
      selectionFingerprint: string;
      unitsPerBox?: number;
      unitsPerBoxStatus?: "real" | "estimated";
      multiples?: number;
      multiplesStatus?: "real" | "estimated";
      weight?: number;
      weightStatus?: "real" | "estimated";
      requestId?: string;
    }
  | { ok: false; message: string; code?: string };

const RPC_ERROR_MESSAGES: Record<string, string> = {
  not_authenticated: "Sessao expirada. Volta a autenticar-te.",
  forbidden: "Nao tens permissao para gerar SKUs.",
  invalid_payload: "Dados invalidos no pedido de geracao.",
  category_not_found: "Categoria nao encontrada.",
  category_inactive: "Categoria inativa.",
  unknown_level: "Nivel desconhecido na selecao.",
  category_has_no_levels: "A categoria nao tem niveis ativos.",
  category_has_no_code_levels: "A categoria nao tem niveis de codigo.",
  measurement_request_conflict: "Conflito de requestId nas medidas.",
  sku_code_collision: "Este codigo SKU ja existe (colisao). Altera a combinacao ou elimina o codigo antigo no Historico.",
  sku_code_collision_legacy:
    "Este codigo SKU ja existe numa geracao anterior. Altera a combinacao ou elimina o codigo antigo no Historico.",
  sku_reference_duplicate:
    "Este codigo SKU ja existe no historico de codigos novos ou normalizados. Nao e possivel criar a mesma referencia duas vezes.",
  sku_generation_invariant_violation: "Invariante de geracao violada.",
  word_not_in_level:
    "Uma palavra selecionada nao pertence ao nivel correto (catalogo desatualizado). Recarrega a pagina ou usa Limpar tudo.",
  word_inactive: "Uma palavra selecionada esta inactiva.",
  word_not_found: "Uma palavra selecionada ja nao existe. Recarrega a pagina ou limpa a selecao.",
  level_required: "Falta preencher um nivel obrigatorio.",
  level_disabled: "Selecionaste um nivel desactivado.",
  invalid_reference_code: "Codigo de referencia invalido numa palavra selecionada.",
  lock_expired: "O bloqueio de normalizacao expirou. Volta a seleccionar a referencia.",
  locked_by_other_user: "Esta referencia esta bloqueada por outro utilizador.",
  normalization_category_mismatch: "A categoria da normalizacao nao coincide com a seleccionada.",
};

function mapRpcError(error: { message?: string; code?: string } | null): { code: string; message: string } {
  const raw = (error?.message || error?.code || "unknown_error").trim();
  const known = Object.keys(RPC_ERROR_MESSAGES).find((key) => raw.includes(key));
  if (known) {
    return { code: known, message: RPC_ERROR_MESSAGES[known] };
  }
  return { code: "rpc_error", message: "Nao foi possivel gerar o SKU (RPC)." };
}

/**
 * Server action for public.generate_sku_secure.
 * Only runs when NEXT_PUBLIC_SKUS_SECURE_GENERATION_V2 is enabled.
 * Uses the authenticated user session (auth.uid) — never service role.
 */
export async function generateSkuSecureAction(formData: FormData): Promise<GenerateSkuSecureActionResult> {
  if (!isSecureGenerationV2Enabled()) {
    return {
      ok: false,
      code: "flag_off",
      message: "Geracao segura V2 desativada (feature flag OFF).",
    };
  }

  const requireLogisticsData = isLogisticsRequired(formData) ? "on" : "off";

  const parsed = generateSecureSchema.safeParse({
    categoryId: formData.get("categoryId"),
    selectionsJson: formData.get("selectionsJson"),
    requireLogisticsData,
    requestId: requireLogisticsData === "on" ? formData.get("requestId") || randomUUID() : undefined,
    unitsPerBox: requireLogisticsData === "on" ? formData.get("unitsPerBox") : undefined,
    unitsPerBoxStatus: requireLogisticsData === "on" ? formData.get("unitsPerBoxStatus") : undefined,
    multiples: requireLogisticsData === "on" ? formData.get("multiples") : undefined,
    multiplesStatus: requireLogisticsData === "on" ? formData.get("multiplesStatus") : undefined,
    weight: requireLogisticsData === "on" ? formData.get("weight") : undefined,
    weightStatus: requireLogisticsData === "on" ? formData.get("weightStatus") : undefined,
  });

  if (!parsed.success) {
    return { ok: false, code: "invalid_payload", message: RPC_ERROR_MESSAGES.invalid_payload };
  }

  let selections: Record<string, unknown>;
  try {
    const raw = JSON.parse(parsed.data.selectionsJson);
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      return { ok: false, code: "invalid_payload", message: RPC_ERROR_MESSAGES.invalid_payload };
    }
    selections = raw as Record<string, unknown>;
  } catch {
    return { ok: false, code: "invalid_payload", message: RPC_ERROR_MESSAGES.invalid_payload };
  }

  const supabase = createSupabaseServerClient();
  if (!supabase) {
    return { ok: false, code: "not_authenticated", message: "Supabase client nao configurado." };
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return { ok: false, code: "not_authenticated", message: RPC_ERROR_MESSAGES.not_authenticated };
  }

  const payload: Record<string, unknown> = {
    categoryId: parsed.data.categoryId,
    selections,
    requireLogisticsData: parsed.data.requireLogisticsData,
  };

  if (parsed.data.requireLogisticsData === "on") {
    payload.requestId = parsed.data.requestId;
    payload.measures = {
      unitsPerBox: parsed.data.unitsPerBox,
      unitsPerBoxStatus: parsed.data.unitsPerBoxStatus,
      multiples: parsed.data.multiples,
      multiplesStatus: parsed.data.multiplesStatus,
      weight: parsed.data.weight,
      weightStatus: parsed.data.weightStatus,
    };
  }

  const { data, error } = await supabase.rpc("generate_sku_secure", { p_payload: payload });
  if (error || !data) {
    const mapped = mapRpcError(error);
    return { ok: false, code: mapped.code, message: mapped.message };
  }

  const row = data as Record<string, unknown>;
  const generatedCode = String(row.generatedCode ?? "");
  revalidatePath("/generator");
  revalidatePath("/sku-history");
  revalidatePath("/dashboard");

  return {
    ok: true,
    message: row.created ? "SKU criado com sucesso." : "SKU reutilizado (idempotente).",
    created: Boolean(row.created),
    generationId: String(row.generationId ?? ""),
    generatedCode,
    generatedCodeCompact: generatedCode.replaceAll("-", ""),
    designationPt: toUpperDesignation(String(row.designationPt ?? "")),
    designationEs: toUpperDesignation(String(row.designationEs ?? "")),
    designationEn: toUpperDesignation(String(row.designationEn ?? "")),
    snapshotVersion: Number(row.snapshotVersion ?? 2),
    selectionFingerprint: String(row.selectionFingerprint ?? ""),
    unitsPerBox: parsed.data.unitsPerBox,
    unitsPerBoxStatus: parsed.data.unitsPerBoxStatus,
    multiples: parsed.data.multiples,
    multiplesStatus: parsed.data.multiplesStatus,
    weight: parsed.data.weight,
    weightStatus: parsed.data.weightStatus,
    requestId: parsed.data.requestId,
  };
}

const completeSecureSchema = z.object({
  normalizationId: z.string().uuid(),
  categoryId: z.string().uuid(),
  selectionsJson: z.string().min(2),
  requestId: z.string().uuid().optional(),
  measuresJson: z.string().optional(),
});

export type CompleteSkuNormalizationActionResult =
  | { ok: true; message: string; data: Record<string, unknown> }
  | { ok: false; message: string; code?: string };

/**
 * Server action for public.complete_sku_normalization.
 * Gated by NEXT_PUBLIC_SKUS_NORMALIZATION_V2 (independent from generator V2).
 */
export async function completeSkuNormalizationSecureAction(
  formData: FormData,
): Promise<CompleteSkuNormalizationActionResult> {
  if (!isNormalizationV2Enabled()) {
    return {
      ok: false,
      code: "flag_off",
      message: "Normalizacao segura V2 desativada (feature flag OFF).",
    };
  }

  const parsed = completeSecureSchema.safeParse({
    normalizationId: formData.get("normalizationId"),
    categoryId: formData.get("categoryId"),
    selectionsJson: formData.get("selectionsJson"),
    requestId: formData.get("requestId") || undefined,
    measuresJson: formData.get("measuresJson") || undefined,
  });

  if (!parsed.success) {
    return { ok: false, code: "invalid_payload", message: RPC_ERROR_MESSAGES.invalid_payload };
  }

  const supabase = createSupabaseServerClient();
  if (!supabase) {
    return { ok: false, code: "not_authenticated", message: "Supabase client nao configurado." };
  }

  let selections: Record<string, unknown>;
  try {
    selections = JSON.parse(parsed.data.selectionsJson) as Record<string, unknown>;
  } catch {
    return { ok: false, code: "invalid_payload", message: RPC_ERROR_MESSAGES.invalid_payload };
  }

  const payload: Record<string, unknown> = {
    categoryId: parsed.data.categoryId,
    selections,
  };
  if (parsed.data.requestId) payload.requestId = parsed.data.requestId;
  if (parsed.data.measuresJson) {
    try {
      payload.measures = JSON.parse(parsed.data.measuresJson);
    } catch {
      return { ok: false, code: "invalid_payload", message: RPC_ERROR_MESSAGES.invalid_payload };
    }
  }

  const { data, error } = await supabase.rpc("complete_sku_normalization", {
    p_normalization_id: parsed.data.normalizationId,
    p_payload: payload,
  });

  if (error || !data) {
    const mapped = mapRpcError(error);
    return { ok: false, code: mapped.code, message: mapped.message };
  }

  revalidatePath("/generator");
  revalidatePath("/sku-history");
  revalidatePath("/dashboard");

  return {
    ok: true,
    message: "Normalizacao concluida.",
    data: data as Record<string, unknown>,
  };
}
