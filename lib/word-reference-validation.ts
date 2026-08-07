import type { createSupabaseServiceServerClient } from "@/lib/supabase-service-server";

export const EMPTY_WORD_REFERENCE_CODE = "000";

export function normalizeWordReferenceCode(code: string | null | undefined): string {
  return String(code ?? "")
    .trim()
    .toUpperCase();
}

export function isEmptyWordReferenceCode(code: string | null | undefined): boolean {
  return normalizeWordReferenceCode(code) === EMPTY_WORD_REFERENCE_CODE;
}

export type WordReferenceConflict = {
  wordId: string;
  label: string;
  referenceCode: string;
  levelLabel: string;
};

type ServiceSupabase = NonNullable<ReturnType<typeof createSupabaseServiceServerClient>>;

export async function findWordReferenceConflict(
  supabase: ServiceSupabase,
  referenceCode: string,
  options?: { excludeWordId?: string },
): Promise<WordReferenceConflict | null> {
  const normalized = normalizeWordReferenceCode(referenceCode);
  if (!normalized || isEmptyWordReferenceCode(normalized)) {
    return null;
  }

  let query = supabase
    .from("skus_words")
    .select("id, label, reference_code, skus_category_levels(label)")
    .eq("is_active", true)
    .eq("reference_code", normalized);

  if (options?.excludeWordId) {
    query = query.neq("id", options.excludeWordId);
  }

  const { data, error } = await query.limit(1).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;

  const levelRelation = data.skus_category_levels as { label?: string } | { label?: string }[] | null;
  const levelLabel = Array.isArray(levelRelation)
    ? String(levelRelation[0]?.label ?? "Sem nivel")
    : String(levelRelation?.label ?? "Sem nivel");

  return {
    wordId: String(data.id),
    label: String(data.label ?? ""),
    referenceCode: String(data.reference_code ?? normalized),
    levelLabel,
  };
}

export function formatWordReferenceConflictMessage(conflict: WordReferenceConflict): string {
  return `A referencia ${conflict.referenceCode} ja esta usada por "${conflict.label}" (${conflict.levelLabel}). As referencias devem ser unicas em todos os niveis (excepto 000).`;
}

export type DesignationLengthWarning = {
  locale: "pt" | "es" | "en";
  label: string;
  length: number;
  maxLength: number;
};

export function collectDesignationLengthWarnings(
  values: { pt?: string; es?: string; en?: string },
  options?: { wordLabel?: string; maxLength?: number },
): DesignationLengthWarning[] {
  const maxLength = options?.maxLength ?? 60;
  const wordLabel = options?.wordLabel ?? "Designacao";
  const warnings: DesignationLengthWarning[] = [];

  for (const locale of ["pt", "es", "en"] as const) {
    const value = String(values[locale] ?? "").trim();
    if (value.length > maxLength) {
      warnings.push({ locale, label: wordLabel, length: value.length, maxLength });
    }
  }

  return warnings;
}

export function formatDesignationLengthWarning(warning: DesignationLengthWarning): string {
  const localeLabel = warning.locale.toUpperCase();
  return `${warning.label} (${localeLabel}): ${warning.length}/${warning.maxLength} caracteres.`;
}
