import type { createSupabaseServiceServerClient } from "@/lib/supabase-service-server";

export const EMPTY_WORD_REFERENCE_CODE = "000";
export const SIZE_FIELD_TYPE_CODE = "size";

export function normalizeWordReferenceCode(code: string | null | undefined): string {
  return String(code ?? "")
    .trim()
    .toUpperCase();
}

export function isEmptyWordReferenceCode(code: string | null | undefined): boolean {
  return normalizeWordReferenceCode(code) === EMPTY_WORD_REFERENCE_CODE;
}

export function isSizeReferenceScope(fieldTypeCode: string | null | undefined): boolean {
  return fieldTypeCode === SIZE_FIELD_TYPE_CODE;
}

export function normalizeWordLabel(label: string | null | undefined): string {
  return String(label ?? "")
    .trim()
    .toLowerCase();
}

export type WordReferenceConflict = {
  wordId: string;
  label: string;
  referenceCode: string;
  levelLabel: string;
};

export type SharedWordReferenceMatch = {
  wordId: string;
  label: string;
};

export type WordReferenceScope = {
  fieldTypeId?: string | null;
  categoryLevelId?: string | null;
  fieldTypeCode?: string | null;
};

type ServiceSupabase = NonNullable<ReturnType<typeof createSupabaseServiceServerClient>>;

type WordRowForScope = {
  normalized_label?: string | null;
  label?: string | null;
  default_field_type_id?: string | null;
  category_level_id?: string | null;
  skus_field_types?:
    | { code?: string | null }
    | Array<{ code?: string | null }>
    | null;
  skus_category_levels?:
    | {
        legacy_field_type_id?: string | null;
        skus_field_types?:
          | { code?: string | null }
          | Array<{ code?: string | null }>
          | null;
      }
    | Array<{
        legacy_field_type_id?: string | null;
        skus_field_types?:
          | { code?: string | null }
          | Array<{ code?: string | null }>
          | null;
      }>
    | null;
};

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function fieldTypeCodeFromRelation(
  relation: { code?: string | null } | Array<{ code?: string | null }> | null | undefined,
): string | null {
  const row = firstRelation(relation);
  return row?.code ? String(row.code) : null;
}

export function resolveWordFieldTypeCodeFromRow(word: WordRowForScope): string | null {
  const direct = fieldTypeCodeFromRelation(word.skus_field_types);
  if (direct) return direct;

  const level = firstRelation(word.skus_category_levels);
  const fromLevel = fieldTypeCodeFromRelation(level?.skus_field_types);
  if (fromLevel) return fromLevel;

  return null;
}

export async function resolveFieldTypeCode(
  supabase: ServiceSupabase,
  scope: WordReferenceScope,
): Promise<string | null> {
  if (scope.fieldTypeCode) {
    return scope.fieldTypeCode;
  }

  if (scope.fieldTypeId) {
    const { data, error } = await supabase
      .from("skus_field_types")
      .select("code")
      .eq("id", scope.fieldTypeId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data?.code ? String(data.code) : null;
  }

  if (scope.categoryLevelId) {
    const { data, error } = await supabase
      .from("skus_category_levels")
      .select("skus_field_types:legacy_field_type_id(code)")
      .eq("id", scope.categoryLevelId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return fieldTypeCodeFromRelation(
      data?.skus_field_types as { code?: string | null } | Array<{ code?: string | null }> | null,
    );
  }

  return null;
}

export async function resolveCategoryLevelId(
  supabase: ServiceSupabase,
  scope: WordReferenceScope,
): Promise<string | null> {
  if (scope.categoryLevelId) {
    return scope.categoryLevelId;
  }

  if (scope.fieldTypeId) {
    const { data, error } = await supabase
      .from("skus_category_levels")
      .select("id")
      .eq("legacy_field_type_id", scope.fieldTypeId)
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data?.id ? String(data.id) : null;
  }

  return null;
}

export async function findWordsSharingReference(
  supabase: ServiceSupabase,
  referenceCode: string,
  options?: WordReferenceScope & { excludeWordId?: string },
): Promise<SharedWordReferenceMatch[]> {
  const normalized = normalizeWordReferenceCode(referenceCode);
  if (!normalized || isEmptyWordReferenceCode(normalized)) {
    return [];
  }

  const categoryLevelId = await resolveCategoryLevelId(supabase, options ?? {});
  if (!categoryLevelId) {
    return [];
  }

  let query = supabase
    .from("skus_words")
    .select("id, label")
    .eq("is_active", true)
    .eq("reference_code", normalized)
    .eq("category_level_id", categoryLevelId);

  if (options?.excludeWordId) {
    query = query.neq("id", options.excludeWordId);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    wordId: String(row.id),
    label: String(row.label ?? ""),
  }));
}

/** @deprecated Usar findWordsSharingReference + formatSharedReferenceWarningMessage */
export async function findWordReferenceConflict(
  supabase: ServiceSupabase,
  referenceCode: string,
  options?: WordReferenceScope & { excludeWordId?: string; wordLabel?: string; normalizedLabel?: string },
): Promise<WordReferenceConflict | null> {
  const matches = await findWordsSharingReference(supabase, referenceCode, options);
  if (matches.length === 0) return null;

  const categoryLevelId = await resolveCategoryLevelId(supabase, options ?? {});
  let levelLabel = "Sem nivel";
  if (categoryLevelId) {
    const { data } = await supabase
      .from("skus_category_levels")
      .select("label")
      .eq("id", categoryLevelId)
      .maybeSingle();
    levelLabel = String(data?.label ?? levelLabel);
  }

  const first = matches[0];
  return {
    wordId: first.wordId,
    label: first.label,
    referenceCode: normalizeWordReferenceCode(referenceCode),
    levelLabel,
  };
}

export function formatSharedReferenceWarningMessage(sharedCount: number): string {
  return `${sharedCount} PALAVRAS PARTILHAM ESTA MESMA REFERÊNCIA`;
}

export function formatWordReferenceConflictMessage(conflict: WordReferenceConflict): string {
  return formatSharedReferenceWarningMessage(1);
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
