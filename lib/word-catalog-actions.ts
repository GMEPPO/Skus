"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { createSupabaseServiceServerClient } from "@/lib/supabase-service-server";
import type { WordHistoryItem } from "@/lib/types";
import { buildIlikePattern } from "@/lib/normalization-search-utils";
import { normalizeWordReferenceCode } from "@/lib/word-reference-validation";
import { parseWordDependencyFormData } from "@/lib/word-dependencies";
import { resolveCategoryIdForLevel, syncWordParentEdges } from "@/lib/word-dependency-persistence";

const WORD_HISTORY_PAGE_SIZE = 50;

const createWordInputSchema = z.object({
  label: z.string().trim().min(1),
  referenceCode: z.string().trim().toUpperCase().regex(/^[A-Z0-9&.]{1,3}$/),
  categoryLevelId: z.string().uuid().optional(),
  fieldTypeId: z.string().uuid().optional(),
  designationPt: z.string().trim().min(1),
  designationEs: z.string().trim().min(1),
  designationEn: z.string().trim().min(1),
  includeInDesignation: z.boolean(),
  selectionHierarchy: z.number().int().min(1).max(2).nullable().optional(),
  visibilityMode: z.enum(["always", "conditional"]).optional(),
  parentWordIds: z.array(z.string().uuid()).optional(),
  parentMatchMode: z.enum(["any", "all"]).optional(),
});

function normalizeLabel(value: string) {
  return value.trim().toLowerCase();
}

function revalidateWordCatalog() {
  revalidatePath("/catalog/words");
  revalidatePath("/catalog/words-manage");
  revalidatePath("/generator");
  revalidatePath("/dashboard");
}

function parseCreateWordFormData(formData: FormData) {
  const dependency = parseWordDependencyFormData(formData);

  return createWordInputSchema.safeParse({
    label: formData.get("label"),
    referenceCode: formData.get("referenceCode"),
    categoryLevelId: formData.get("categoryLevelId") || undefined,
    fieldTypeId: formData.get("fieldTypeId") || undefined,
    designationPt: formData.get("designationPt"),
    designationEs: formData.get("designationEs"),
    designationEn: formData.get("designationEn"),
    includeInDesignation: formData.get("includeInDesignation") === "on",
    selectionHierarchy: dependency.selectionHierarchy,
    visibilityMode: dependency.visibilityMode,
    parentWordIds: dependency.parentWordIds,
    parentMatchMode: dependency.parentMatchMode,
  });
}

async function persistNewWord(
  parsed: z.infer<typeof createWordInputSchema>,
): Promise<{ ok: true; wordId: string } | { ok: false; message: string }> {
  const supabase = createSupabaseServiceServerClient();
  if (!supabase) {
    return { ok: false, message: "Supabase service role nao configurada." };
  }

  const {
    label,
    referenceCode,
    designationPt,
    designationEs,
    designationEn,
    includeInDesignation,
    selectionHierarchy = null,
    parentWordIds = [],
    parentMatchMode = "any",
    visibilityMode = "always",
  } = parsed;

  let categoryLevelId = parsed.categoryLevelId ?? null;
  let defaultFieldTypeId = parsed.fieldTypeId ?? null;

  if (categoryLevelId) {
    const { data: level, error: levelErr } = await supabase
      .from("skus_category_levels")
      .select("id, legacy_field_type_id, is_enabled")
      .eq("id", categoryLevelId)
      .maybeSingle();
    if (levelErr || !level) {
      return { ok: false, message: "Nivel invalido." };
    }
    if (!defaultFieldTypeId) {
      defaultFieldTypeId = level.legacy_field_type_id ? String(level.legacy_field_type_id) : null;
    }
  } else if (defaultFieldTypeId) {
    const { data: level } = await supabase
      .from("skus_category_levels")
      .select("id")
      .eq("legacy_field_type_id", defaultFieldTypeId)
      .limit(1)
      .maybeSingle();
    categoryLevelId = level?.id ? String(level.id) : null;
  }

  if (!categoryLevelId && !defaultFieldTypeId) {
    return { ok: false, message: "Falta nivel ou field type." };
  }

  const normalizedReferenceCode = normalizeWordReferenceCode(referenceCode);

  const insertResult = await supabase
    .from("skus_words")
    .insert({
      label,
      normalized_label: normalizeLabel(label),
      reference_code: normalizedReferenceCode,
      default_field_type_id: defaultFieldTypeId,
      category_level_id: categoryLevelId,
      designation: designationPt,
      designation_pt: designationPt,
      designation_es: designationEs,
      designation_en: designationEn,
      include_in_designation: includeInDesignation,
      selection_hierarchy: selectionHierarchy,
      parent_match_mode: parentMatchMode,
      is_active: true,
    })
    .select("id")
    .single();

  if (insertResult.error || !insertResult.data) {
    if (insertResult.error?.code === "23505") {
      return { ok: false, message: "Referencia ja existente noutra palavra do mesmo nivel." };
    }
    return { ok: false, message: "Nao foi possivel criar a palavra." };
  }

  const wordId = String(insertResult.data.id);
  const categoryId = await resolveCategoryIdForLevel(supabase, categoryLevelId);

  if (categoryId && visibilityMode === "conditional" && parentWordIds.length > 0) {
    const edgeResult = await syncWordParentEdges(supabase, {
      categoryId,
      childWordId: wordId,
      parentWordIds,
      parentMatchMode,
    });
    if (!edgeResult.ok) {
      return edgeResult;
    }
  }

  revalidateWordCatalog();
  return { ok: true, wordId };
}

export async function createWordFromGeneratorAction(
  formData: FormData,
): Promise<{ ok: true; wordId: string } | { ok: false; message: string }> {
  await requireRole("editor");
  const parsed = parseCreateWordFormData(formData);
  if (!parsed.success) {
    return { ok: false, message: "Dados invalidos na nova palavra." };
  }
  return persistNewWord(parsed.data);
}

function mapWordHistoryRow(row: Record<string, unknown>): WordHistoryItem {
  const relation = row.skus_field_types as { name?: string | null } | { name?: string | null }[] | null;
  const fieldTypeName = Array.isArray(relation) ? relation[0]?.name : relation?.name;

  return {
    id: String(row.id),
    label: String(row.label ?? ""),
    referenceCode: String(row.reference_code ?? ""),
    fieldTypeLabel: String(fieldTypeName ?? ""),
    designationPt: String(row.designation_pt ?? row.designation ?? row.label ?? ""),
    createdAt: String(row.created_at ?? ""),
  };
}

export async function countRecentWordsAction(): Promise<number> {
  const supabase = createSupabaseServiceServerClient();
  if (!supabase) return 0;

  const { count, error } = await supabase
    .from("skus_words")
    .select("id", { count: "exact", head: true })
    .eq("is_active", true);

  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function searchRecentWordsAction(params: {
  page: number;
  query?: string;
}): Promise<{ items: WordHistoryItem[]; total: number; totalPages: number }> {
  await requireRole("viewer");

  const supabase = createSupabaseServiceServerClient();
  if (!supabase) {
    return { items: [], total: 0, totalPages: 1 };
  }

  const page = Math.max(1, params.page);
  const query = params.query?.trim() ?? "";
  const from = (page - 1) * WORD_HISTORY_PAGE_SIZE;
  const to = from + WORD_HISTORY_PAGE_SIZE - 1;

  let countQuery = supabase.from("skus_words").select("id", { count: "exact", head: true }).eq("is_active", true);
  let dataQuery = supabase
    .from("skus_words")
    .select("id, label, reference_code, designation_pt, designation, created_at, skus_field_types(name)")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (query) {
    const pattern = buildIlikePattern(query);
    const filter = `label.ilike.${pattern},reference_code.ilike.${pattern},designation_pt.ilike.${pattern}`;
    countQuery = countQuery.or(filter);
    dataQuery = dataQuery.or(filter);
  }

  const [{ count, error: countError }, { data, error: dataError }] = await Promise.all([countQuery, dataQuery]);

  if (countError) throw new Error(countError.message);
  if (dataError) throw new Error(dataError.message);

  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / WORD_HISTORY_PAGE_SIZE));

  return {
    items: ((data ?? []) as Record<string, unknown>[]).map(mapWordHistoryRow),
    total,
    totalPages,
  };
}
