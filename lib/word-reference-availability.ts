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
  levels: number;
  poolPerLevel: number;
};

export function isThreeCharCatalogReference(code: string | null | undefined): boolean {
  const normalized = normalizeWordReferenceCode(code);
  return (
    normalized.length === 3 &&
    normalized !== EMPTY_WORD_REFERENCE_CODE &&
    THREE_CHAR_REFERENCE_PATTERN.test(normalized)
  );
}

export function computeThreeCharReferenceAvailability(input: {
  levelIds: string[];
  usedByLevel: Map<string, Set<string>>;
}): ThreeCharReferenceAvailability {
  const poolPerLevel = USABLE_THREE_CHAR_REFERENCE_POOL;
  let used = 0;
  let available = 0;

  for (const levelId of input.levelIds) {
    const levelUsed = input.usedByLevel.get(levelId)?.size ?? 0;
    used += levelUsed;
    available += poolPerLevel - levelUsed;
  }

  return {
    available,
    capacity: input.levelIds.length * poolPerLevel,
    used,
    levels: input.levelIds.length,
    poolPerLevel,
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

  const levelIds = (levels ?? [])
    .filter((level) => !isSizeReferenceScope(fieldTypeCodeFromRelation(level.skus_field_types)))
    .map((level) => String(level.id));

  const usedByLevel = new Map<string, Set<string>>();
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
      if (!levelId || !levelIds.includes(levelId)) continue;

      const referenceCode = normalizeWordReferenceCode(word.reference_code);
      if (!isThreeCharCatalogReference(referenceCode)) continue;

      const bucket = usedByLevel.get(levelId) ?? new Set<string>();
      bucket.add(referenceCode);
      usedByLevel.set(levelId, bucket);
    }

    if (page.length < pageSize) break;
    offset += pageSize;
  }

  return computeThreeCharReferenceAvailability({ levelIds, usedByLevel });
}
