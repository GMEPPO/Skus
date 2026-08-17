"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { isNormalizationV2Enabled } from "@/lib/skus-feature-flags";

const NORMALIZATION_RPC_ERRORS: Record<string, string> = {
  not_authenticated: "Sessao expirada. Volta a autenticar-te.",
  forbidden: "Nao tens permissao para normalizar SKUs.",
  not_found: "Registo de normalizacao nao encontrado.",
  completed: "Esta normalizacao ja foi concluida.",
  cancelled: "Esta normalizacao foi cancelada.",
  locked_by_other_user: "Este registo esta bloqueado por outro utilizador.",
  lock_expired: "O bloqueio expirou. Volta a reivindicar o registo.",
  lock_required: "Precisas de reivindicar o registo antes de concluir.",
  claim_failed: "Nao foi possivel reivindicar o registo.",
  renew_failed: "Nao foi possivel renovar o bloqueio.",
  release_failed: "Nao foi possivel libertar o bloqueio.",
  missing_legacy_code: "Registo sem codigo legacy valido.",
  word_not_in_level:
    "Uma palavra selecionada nao pertence ao nivel correto (catalogo desatualizado). Recarrega a pagina ou usa Limpar tudo.",
  word_inactive: "Uma palavra selecionada esta inactiva.",
  level_required: "Falta preencher um nivel obrigatorio.",
  invalid_reference_code: "Codigo de referencia invalido numa palavra selecionada.",
  normalization_category_mismatch: "A categoria da normalizacao nao coincide com a seleccionada.",
};

function mapRpcError(error: { message?: string } | null): { code: string; message: string } {
  const raw = (error?.message ?? "unknown_error").trim();
  const known = Object.keys(NORMALIZATION_RPC_ERRORS).find((key) => raw.includes(key));
  if (known) {
    return { code: known, message: NORMALIZATION_RPC_ERRORS[known] };
  }
  return { code: "rpc_error", message: "Operacao de normalizacao falhou (RPC)." };
}

export type NormalizationRpcActionResult =
  | { ok: true; message: string }
  | { ok: false; message: string; code?: string };

async function getAuthenticatedClient() {
  if (!isNormalizationV2Enabled()) {
    return {
      ok: false as const,
      code: "flag_off",
      message: "Normalizacao V2 desativada (feature flag OFF).",
    };
  }

  await requireRole("editor");
  const supabase = createSupabaseServerClient();
  if (!supabase) {
    return { ok: false as const, code: "not_authenticated", message: "Supabase client nao configurado." };
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return { ok: false as const, code: "not_authenticated", message: NORMALIZATION_RPC_ERRORS.not_authenticated };
  }

  return { ok: true as const, supabase };
}

async function claimNormalizationRpc(normalizationId: string) {
  await requireRole("editor");
  const supabase = createSupabaseServerClient();
  if (!supabase) {
    return { ok: false as const, code: "not_authenticated", message: "Supabase client nao configurado." };
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return { ok: false as const, code: "not_authenticated", message: NORMALIZATION_RPC_ERRORS.not_authenticated };
  }

  const { error } = await supabase.rpc("claim_sku_normalization", {
    p_normalization_id: normalizationId,
  });

  if (error) {
    const mapped = mapRpcError(error);
    return { ok: false as const, code: mapped.code, message: mapped.message };
  }

  revalidatePath("/generator");
  return { ok: true as const, message: "Registo reivindicado." };
}

export async function claimNormalizationForGeneratorAction(
  normalizationId: string,
): Promise<NormalizationRpcActionResult> {
  if (!isNormalizationV2Enabled()) {
    return {
      ok: false,
      code: "flag_off",
      message: "Normalizacao V2 desativada (feature flag OFF).",
    };
  }

  const result = await claimNormalizationRpc(normalizationId);
  if (!result.ok) {
    return { ok: false, code: result.code, message: result.message };
  }
  return { ok: true, message: result.message };
}

export async function releaseNormalizationAction(normalizationId: string): Promise<NormalizationRpcActionResult> {
  const client = await getAuthenticatedClient();
  if (!client.ok) {
    return { ok: false, code: client.code, message: client.message };
  }

  const { error } = await client.supabase.rpc("release_sku_normalization_claim", {
    p_normalization_id: normalizationId,
  });

  if (error) {
    const mapped = mapRpcError(error);
    return { ok: false, code: mapped.code, message: mapped.message };
  }

  revalidatePath("/generator");
  return { ok: true, message: "Bloqueio libertado." };
}

export async function renewNormalizationClaimAction(normalizationId: string): Promise<NormalizationRpcActionResult> {
  const client = await getAuthenticatedClient();
  if (!client.ok) {
    return { ok: false, code: client.code, message: client.message };
  }

  const { error } = await client.supabase.rpc("renew_sku_normalization_claim", {
    p_normalization_id: normalizationId,
  });

  if (error) {
    const mapped = mapRpcError(error);
    return { ok: false, code: mapped.code, message: mapped.message };
  }

  revalidatePath("/generator");
  return { ok: true, message: "Bloqueio renovado." };
}
