"use server";

import { requireRole } from "@/lib/auth";
import { createSupabaseServiceServerClient } from "@/lib/supabase-service-server";

export type ParentWordOption = {
  id: string;
  label: string;
  referenceCode: string;
};

export type ParentLevelOption = {
  levelId: string;
  levelKey: string;
  levelLabel: string;
  sortOrder: number;
  words: ParentWordOption[];
};

export async function getParentWordOptionsForLevel(
  categoryLevelId: string,
): Promise<{ categoryId: string; currentSortOrder: number; levels: ParentLevelOption[] } | null> {
  await requireRole("viewer");

  const supabase = createSupabaseServiceServerClient();
  if (!supabase) return null;

  const { data: currentLevel, error: levelError } = await supabase
    .from("skus_category_levels")
    .select("id, category_id, key, label, sort_order")
    .eq("id", categoryLevelId)
    .maybeSingle();

  if (levelError || !currentLevel) return null;

  const categoryId = String(currentLevel.category_id);
  const currentSortOrder = Number(currentLevel.sort_order ?? 0);

  const { data: levels, error: levelsError } = await supabase
    .from("skus_category_levels")
    .select("id, key, label, sort_order")
    .eq("category_id", categoryId)
    .lt("sort_order", currentSortOrder)
    .eq("is_enabled", true)
    .order("sort_order", { ascending: true });

  if (levelsError) return null;

  const levelRows = levels ?? [];
  const levelIds = levelRows.map((level) => String(level.id));
  if (levelIds.length === 0) {
    return { categoryId, currentSortOrder, levels: [] };
  }

  const { data: words, error: wordsError } = await supabase
    .from("skus_words")
    .select("id, label, reference_code, category_level_id")
    .in("category_level_id", levelIds)
    .eq("is_active", true)
    .order("label", { ascending: true });

  if (wordsError) return null;

  return {
    categoryId,
    currentSortOrder,
    levels: levelRows.map((level) => ({
      levelId: String(level.id),
      levelKey: String(level.key),
      levelLabel: String(level.label),
      sortOrder: Number(level.sort_order ?? 0),
      words: (words ?? [])
        .filter((word) => String(word.category_level_id) === String(level.id))
        .map((word) => ({
          id: String(word.id),
          label: String(word.label ?? ""),
          referenceCode: String(word.reference_code ?? ""),
        })),
    })),
  };
}

export async function getWordParentEdges(wordId: string): Promise<string[]> {
  await requireRole("viewer");

  const supabase = createSupabaseServiceServerClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("skus_word_parent_edges")
    .select("parent_word_id")
    .eq("child_word_id", wordId);

  if (error) return [];
  return (data ?? []).map((row) => String(row.parent_word_id));
}
