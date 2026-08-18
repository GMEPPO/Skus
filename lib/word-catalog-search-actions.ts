"use server";

import { requireRole } from "@/lib/auth";
import { buildIlikePattern } from "@/lib/normalization-search-utils";
import { createSupabaseServiceServerClient } from "@/lib/supabase-service-server";
import type { WordListItem } from "@/lib/types";

const WORD_CATALOG_PAGE_SIZE = 20;

type FieldTypeRelation =
  | { id?: string | null; code?: string | null; name?: string | null; sort_order?: number | null }
  | Array<{ id?: string | null; code?: string | null; name?: string | null; sort_order?: number | null }>
  | null;

type WordRow = {
  id: string;
  label: string;
  reference_code: string;
  default_field_type_id: string | null;
  category_level_id?: string | null;
  designation: string | null;
  designation_pt: string | null;
  designation_es: string | null;
  designation_en: string | null;
  include_in_designation: boolean | null;
  selection_hierarchy?: number | null;
  parent_match_mode?: string | null;
  skus_field_types?: FieldTypeRelation;
};

function getFieldTypeRelation(relation: FieldTypeRelation | undefined) {
  if (!relation) return null;
  return Array.isArray(relation) ? relation[0] ?? null : relation;
}

function mapWordRow(row: WordRow): WordListItem {
  const relation = getFieldTypeRelation(row.skus_field_types);
  const designationPt = String(row.designation_pt ?? row.designation ?? row.label ?? "");

  return {
    id: String(row.id),
    label: String(row.label ?? ""),
    referenceCode: String(row.reference_code ?? ""),
    fieldTypeId: String(row.default_field_type_id ?? relation?.id ?? ""),
    fieldTypeLabel: String(relation?.name ?? ""),
    designation: designationPt,
    designationPt,
    designationEs: String(row.designation_es ?? row.designation ?? row.label ?? ""),
    designationEn: String(row.designation_en ?? row.designation ?? row.label ?? ""),
    includeInDesignation: Boolean(row.include_in_designation ?? true),
    familyIds: [],
    familyLabels: [],
    parentWordIds: [],
    parentWordLabels: [],
    parentMatchMode: String(row.parent_match_mode ?? "any") === "all" ? "all" : "any",
    selectionHierarchy:
      row.selection_hierarchy === null || row.selection_hierarchy === undefined
        ? null
        : Number(row.selection_hierarchy),
    categoryLevelId: row.category_level_id ? String(row.category_level_id) : null,
  };
}

function applyWordSearchFilter<T extends { or: (filter: string) => T }>(query: T, searchText: string): T {
  const pattern = buildIlikePattern(searchText);
  if (!pattern) return query;
  return query.or(
    `label.ilike.${pattern},reference_code.ilike.${pattern},designation_pt.ilike.${pattern},designation_es.ilike.${pattern},designation_en.ilike.${pattern},designation.ilike.${pattern}`,
  );
}

export async function countWordsCatalogAction(searchText?: string): Promise<number> {
  await requireRole("viewer");

  const supabase = createSupabaseServiceServerClient();
  if (!supabase) return 0;

  let query = supabase.from("skus_words").select("id", { count: "exact", head: true }).eq("is_active", true);
  query = applyWordSearchFilter(query, searchText?.trim() ?? "");

  const { count, error } = await query;
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function searchWordsCatalogAction(params: {
  page: number;
  query?: string;
}): Promise<{ items: WordListItem[]; total: number; totalPages: number }> {
  await requireRole("viewer");

  const supabase = createSupabaseServiceServerClient();
  if (!supabase) {
    return { items: [], total: 0, totalPages: 1 };
  }

  const page = Math.max(1, params.page);
  const searchText = params.query?.trim() ?? "";
  const from = (page - 1) * WORD_CATALOG_PAGE_SIZE;
  const to = from + WORD_CATALOG_PAGE_SIZE - 1;

  let countQuery = supabase.from("skus_words").select("id", { count: "exact", head: true }).eq("is_active", true);
  let dataQuery = supabase
    .from("skus_words")
    .select(
      "id, label, reference_code, default_field_type_id, category_level_id, designation, designation_pt, designation_es, designation_en, include_in_designation, selection_hierarchy, parent_match_mode, skus_field_types(id, code, name, sort_order)",
    )
    .eq("is_active", true)
    .order("label", { ascending: true })
    .range(from, to);

  countQuery = applyWordSearchFilter(countQuery, searchText);
  dataQuery = applyWordSearchFilter(dataQuery, searchText);

  const [{ count, error: countError }, { data, error: dataError }] = await Promise.all([countQuery, dataQuery]);

  if (countError) throw new Error(countError.message);
  if (dataError) throw new Error(dataError.message);

  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / WORD_CATALOG_PAGE_SIZE));

  return {
    items: ((data ?? []) as WordRow[]).map(mapWordRow),
    total,
    totalPages,
  };
}
