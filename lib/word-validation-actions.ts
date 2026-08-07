"use server";

import { requireRole } from "@/lib/auth";
import { createSupabaseServiceServerClient } from "@/lib/supabase-service-server";
import {
  collectDesignationLengthWarnings,
  findWordReferenceConflict,
  formatWordReferenceConflictMessage,
  normalizeWordReferenceCode,
} from "@/lib/word-reference-validation";

export async function checkWordReferenceCodeAction(
  referenceCode: string,
  excludeWordId?: string,
): Promise<
  | { ok: true; available: true }
  | { ok: true; available: false; message: string; conflictLabel: string; conflictLevel: string }
  | { ok: false; message: string }
> {
  await requireRole("editor");

  const normalized = normalizeWordReferenceCode(referenceCode);
  if (!normalized) {
    return { ok: false, message: "Referencia invalida." };
  }

  if (normalized === "000") {
    return { ok: true, available: true };
  }

  const supabase = createSupabaseServiceServerClient();
  if (!supabase) {
    return { ok: false, message: "Supabase service role nao configurada." };
  }

  try {
    const conflict = await findWordReferenceConflict(supabase, normalized, { excludeWordId });
    if (!conflict) {
      return { ok: true, available: true };
    }

    return {
      ok: true,
      available: false,
      message: formatWordReferenceConflictMessage(conflict),
      conflictLabel: conflict.label,
      conflictLevel: conflict.levelLabel,
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
