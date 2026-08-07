import type { createSupabaseServiceServerClient } from "@/lib/supabase-service-server";
import {
  EMPTY_WORD_REFERENCE_CODE,
  isSizeReferenceScope,
  normalizeWordReferenceCode,
} from "@/lib/word-reference-validation";

export const WORD_REFERENCE_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
export const THREE_CHAR_REFERENCE_POOL_SIZE = WORD_REFERENCE_ALPHABET.length ** 3;
export const USABLE_THREE_CHAR_REFERENCE_POOL = THREE_CHAR_REFERENCE_POOL_SIZE - 1;

const THREE_CHAR_REFERENCE_PATTERN = /^[A-Z0-9]{3}$/;

type ServiceSupabase = NonNullable<ReturnType<typeof createSupabaseServiceServerClient>>;

export type ThreeCharReferenceAvailability = {
  available: number;
  capacity: number;
  used: number;
};

export function isThreeCharCatalogReference(code: string | null | undefined): boolean {
  const normalized = normalizeWordReferenceCode(code);
  return (
    normalized.length === 3 &&
    normalized !== EMPTY_WORD_REFERENCE_CODE &&
    THREE_CHAR_REFERENCE_PATTERN.test(normalized)
  );
}

export function computeThreeCharReferenceAvailability(usedReferences: Iterable<string>): ThreeCharReferenceAvailability {
  const used = new Set(usedReferences).size;
  const capacity = USABLE_THREE_CHAR_REFERENCE_POOL;

  return {
    available: Math.max(capacity - used, 0),
    capacity,
    used,
  };
}

function fieldTypeCodeFromRelation(
  relation: { code?: string | null } | Array<{ code?: string | null }> | null | undefined,
): string | null {
  if (Array.isArray(relation)) return relation[0]?.code ? String(relation[0].code) : null;
  return relation?.code ? String(relation.code) : null;
}

export async function getThreeCharReferenceAvailability(
  supabase: ServiceSupabase,
): Promise<ThreeCharReferenceAvailability> {
  const { data: levels, error: levelsError } = await supabase
    .from("skus_category_levels")
    .select("id, skus_field_types:legacy_field_type_id(code)")
    .eq("is_enabled", true);

  if (levelsError) throw new Error(levelsError.message);

  const eligibleLevelIds = new Set(
    (levels ?? [])
      .filter((level) => !isSizeReferenceScope(fieldTypeCodeFromRelation(level.skus_field_types)))
      .map((level) => String(level.id)),
  );

  const usedReferences = new Set<string>();
  const pageSize = 1000;
  let offset = 0;

  while (true) {
    const { data: words, error: wordsError } = await supabase
      .from("skus_words")
      .select("reference_code, category_level_id")
      .eq("is_active", true)
      .not("category_level_id", "is", null)
      .range(offset, offset + pageSize - 1);

    if (wordsError) throw new Error(wordsError.message);

    const page = words ?? [];
    for (const word of page) {
      const levelId = word.category_level_id ? String(word.category_level_id) : null;
      if (!levelId || !eligibleLevelIds.has(levelId)) continue;

      const referenceCode = normalizeWordReferenceCode(word.reference_code);
      if (!isThreeCharCatalogReference(referenceCode)) continue;

      usedReferences.add(referenceCode);
    }

    if (page.length < pageSize) break;
    offset += pageSize;
  }

  return computeThreeCharReferenceAvailability(usedReferences);
}
