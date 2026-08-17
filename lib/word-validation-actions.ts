"use server";

import { requireRole } from "@/lib/auth";
import { createSupabaseServiceServerClient } from "@/lib/supabase-service-server";
import {
  collectDesignationLengthWarnings,
  findWordsSharingReference,
  formatSharedReferenceWarningMessage,
  normalizeWordReferenceCode,
} from "@/lib/word-reference-validation";

export async function checkWordReferenceCodeAction(
  referenceCode: string,
  excludeWordId?: string,
  fieldTypeId?: string,
  wordLabel?: string,
): Promise<
  | { ok: true; available: true; sharedReferenceCount?: number; message?: string }
  | { ok: false; message: string }
> {
  await requireRole("editor");

  const normalized = normalizeWordReferenceCode(referenceCode);
  if (!normalized) {
    return { ok: false, message: "Referencia invalida." };
  }

  if (normalized === "000") {
    return { ok: true, available: true, message: "000 e reservado para Vazio e pode repetir-se em cada nivel." };
  }

  const supabase = createSupabaseServiceServerClient();
  if (!supabase) {
    return { ok: false, message: "Supabase service role nao configurada." };
  }

  try {
    const sharedMatches = await findWordsSharingReference(supabase, normalized, {
      excludeWordId,
      fieldTypeId,
    });

    if (sharedMatches.length === 0) {
      return { ok: true, available: true, message: "Referencia valida neste nivel." };
    }

    return {
      ok: true,
      available: true,
      sharedReferenceCount: sharedMatches.length,
      message: formatSharedReferenceWarningMessage(sharedMatches.length),
    };
  } catch {
    return { ok: false, message: "Nao foi possivel validar a referencia." };
  }
}

export async function checkWordDesignationLengthsAction(input: {
  label?: string;
  designationPt?: string;
  designationEs?: string;
  designationEn?: string;
}) {
  await requireRole("editor");

  const warnings = collectDesignationLengthWarnings(
    {
      pt: input.designationPt,
      es: input.designationEs,
      en: input.designationEn,
    },
    { wordLabel: input.label?.trim() || "Designacao" },
  );

  return { ok: true as const, warnings };
}
