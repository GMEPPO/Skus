"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { isNormalizationV2Enabled, isSecureGenerationV2Enabled } from "@/lib/skus-feature-flags";

const measureStatusSchema = z.enum(["real", "estimated"]);

const generateSecureSchema = z.object({
  categoryId: z.string().uuid(),
  selectionsJson: z.string().min(2),
  requestId: z.string().uuid(),
  unitsPerBox: z.coerce.number().positive(),
  unitsPerBoxStatus: measureStatusSchema,
  multiples: z.coerce.number().positive(),
  multiplesStatus: measureStatusSchema,
  weight: z.coerce.number().positive(),
  weightStatus: measureStatusSchema,
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
      unitsPerBox: number;
      unitsPerBoxStatus: "real" | "estimated";
      multiples: number;
      multiplesStatus: "real" | "estimated";
      weight: number;
      weightStatus: "real" | "estimated";
      requestId: string;
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
  sku_code_collision: "Colisao de codigo SKU (v2).",
  sku_code_collision_legacy: "Colisao com geracao legacy (fingerprint NULL).",
  sku_reference_duplicate:
    "Esta referencia SKU ja existe no historico de codigos novos ou normalizados. Escolhe outra combinacao.",
  sku_generation_invariant_violation: "Invariante de geracao violada.",
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

  const parsed = generateSecureSchema.safeParse({
    categoryId: formData.get("categoryId"),
    selectionsJson: formData.get("selectionsJson"),
    requestId: formData.get("requestId") || randomUUID(),
    unitsPerBox: formData.get("unitsPerBox"),
    unitsPerBoxStatus: formData.get("unitsPerBoxStatus"),
    multiples: formData.get("multiples"),
    multiplesStatus: formData.get("multiplesStatus"),
    weight: formData.get("weight"),
    weightStatus: formData.get("weightStatus"),
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

  const payload = {
    categoryId: parsed.data.categoryId,
    selections,
    requestId: parsed.data.requestId,
    measures: {
      unitsPerBox: parsed.data.unitsPerBox,
      unitsPerBoxStatus: parsed.data.unitsPerBoxStatus,
      multiples: parsed.data.multiples,
      multiplesStatus: parsed.data.multiplesStatus,
      weight: parsed.data.weight,
      weightStatus: parsed.data.weightStatus,
    },
  };

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
    designationPt: String(row.designationPt ?? ""),
    designationEs: String(row.designationEs ?? ""),
    designationEn: String(row.designationEn ?? ""),
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
