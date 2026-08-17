import type { SupabaseClient } from "@supabase/supabase-js";
import type { ParentMatchMode } from "@/lib/word-dependencies";

export async function syncWordParentEdges(
  supabase: SupabaseClient,
  params: {
    categoryId: string;
    childWordId: string;
    parentWordIds: string[];
    parentMatchMode: ParentMatchMode;
  },
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { categoryId, childWordId, parentWordIds, parentMatchMode } = params;

  const updateMode = await supabase
    .from("skus_words")
    .update({ parent_match_mode: parentMatchMode, updated_at: new Date().toISOString() })
    .eq("id", childWordId);

  if (updateMode.error) {
    return { ok: false, message: "Nao foi possivel guardar o modo de dependencia." };
  }

  const { error: deleteError } = await supabase
    .from("skus_word_parent_edges")
    .delete()
    .eq("child_word_id", childWordId);

  if (deleteError) {
    return { ok: false, message: "Nao foi possivel actualizar dependencias." };
  }

  if (parentWordIds.length === 0) {
    return { ok: true };
  }

  const rows = parentWordIds.map((parentWordId) => ({
    category_id: categoryId,
    child_word_id: childWordId,
    parent_word_id: parentWordId,
  }));

  const { error: insertError } = await supabase.from("skus_word_parent_edges").insert(rows);
  if (insertError) {
    return { ok: false, message: "Nao foi possivel guardar dependencias." };
  }

  return { ok: true };
}

export async function resolveCategoryIdForLevel(
  supabase: SupabaseClient,
  categoryLevelId: string | null,
): Promise<string | null> {
  if (!categoryLevelId) return null;

  const { data, error } = await supabase
    .from("skus_category_levels")
    .select("category_id")
    .eq("id", categoryLevelId)
    .maybeSingle();

  if (error || !data) return null;
  return String(data.category_id);
}
