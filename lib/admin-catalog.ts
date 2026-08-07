"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { createSupabaseServiceServerClient } from "@/lib/supabase-service-server";
import type { WordListItem } from "@/lib/types";
import {
  findWordReferenceConflict,
  formatWordReferenceConflictMessage,
  isEmptyWordReferenceCode,
  normalizeWordReferenceCode,
} from "@/lib/word-reference-validation";

const GLOBAL_LEVEL_CODES = ["brand", "format", "product", "size", "packaging", "extra"] as const;

export interface FieldTypeOption {
  id: string;
  code: string;
  name: string;
}

export interface FamilyOption {
  id: string;
  name: string;
}

export interface WordDependencyOption {
  id: string;
  label: string;
  referenceCode: string;
  fieldTypeId: string;
  fieldTypeLabel: string;
  familyIds: string[];
}

export interface FamilyBuilderDetail {
  id: string;
  name: string;
  slug: string;
  description: string;
  status: string;
  draftTreeVersionId: string | null;
  publishedTreeVersionId: string | null;
  levels: Array<{
    id: string;
    order: number;
    label: string;
    fieldTypeId: string;
    fieldTypeName: string;
    words: Array<{
      id: string;
      label: string;
      referenceCode: string;
    }>;
  }>;
}

export interface FamilyCatalogItem {
  id: string;
  name: string;
  namePt: string;
  nameEs: string;
  nameEn: string;
  slug: string;
  description: string;
  status: "draft" | "active" | "archived";
  activeTreeVersionId: string | null;
  levelLabels: string[];
  flowLabels: string[];
}

type FieldTypeRow = FieldTypeOption & {
  sort_order?: number | null;
};

type FieldTypeRelation =
  | { id?: string | null; code?: string | null; name?: string | null }
  | Array<{ id?: string | null; code?: string | null; name?: string | null }>
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
  is_active?: boolean | null;
  skus_field_types?: FieldTypeRelation;
};

const deleteWordSchema = z.object({
  wordId: z.string().uuid(),
});

const createWordSchema = z.object({
  label: z.string().trim().min(1),
  referenceCode: z.string().trim().toUpperCase().regex(/^[A-Z0-9&.]{1,3}$/),
  /** Preferido: pertenencia canónica al nivel */
  categoryLevelId: z.string().uuid().optional(),
  /** Compat legacy; opcional si el nivel aporta legacy_field_type_id */
  fieldTypeId: z.string().uuid().optional(),
  designationPt: z.string().trim().min(1),
  designationEs: z.string().trim().min(1),
  designationEn: z.string().trim().min(1),
  includeInDesignation: z.boolean(),
});

const updateWordSchema = createWordSchema.extend({
  wordId: z.string().uuid(),
});

function normalizeLabel(value: string) {
  return value.trim().toLowerCase();
}

function getFieldTypeRelation(relation: FieldTypeRelation | undefined) {
  if (!relation) return null;
  return Array.isArray(relation) ? relation[0] ?? null : relation;
}

function getFallbackFieldTypes(): FieldTypeOption[] {
  return [
    { id: "00000000-0000-0000-0000-000000000001", code: "brand", name: "Familia/Marca" },
    { id: "00000000-0000-0000-0000-000000000002", code: "format", name: "Formato" },
    { id: "00000000-0000-0000-0000-000000000003", code: "product", name: "Produto" },
    { id: "00000000-0000-0000-0000-000000000004", code: "size", name: "Tamanho/Gramaje" },
    { id: "00000000-0000-0000-0000-000000000005", code: "packaging", name: "Embalagem" },
    { id: "00000000-0000-0000-0000-000000000006", code: "extra", name: "Extra" },
  ];
}

function sortFieldTypes(rows: FieldTypeRow[]) {
  return rows
    .filter((row) => GLOBAL_LEVEL_CODES.includes(row.code as (typeof GLOBAL_LEVEL_CODES)[number]))
    .sort((left, right) => GLOBAL_LEVEL_CODES.indexOf(left.code as (typeof GLOBAL_LEVEL_CODES)[number]) - GLOBAL_LEVEL_CODES.indexOf(right.code as (typeof GLOBAL_LEVEL_CODES)[number]));
}

function mapWord(row: WordRow): WordListItem {
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
  };
}

export async function getFieldTypeOptions(): Promise<FieldTypeOption[]> {
  const supabase = createSupabaseServiceServerClient();
  if (!supabase) return getFallbackFieldTypes();

  const result = await supabase
    .from("skus_field_types")
    .select("id, code, name, sort_order")
    .in("code", [...GLOBAL_LEVEL_CODES])
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  return sortFieldTypes((result.data ?? []) as FieldTypeRow[]);
}

export async function getWordsCatalog(): Promise<WordListItem[]> {
  const supabase = createSupabaseServiceServerClient();
  if (!supabase) {
    const { getWords } = await import("@/lib/data");
    return getWords();
  }

  const wordsResult = await supabase
    .from("skus_words")
    .select("id, label, reference_code, default_field_type_id, designation, designation_pt, designation_es, designation_en, include_in_designation, skus_field_types(id, code, name)")
    .order("label", { ascending: true });

  const words = ((wordsResult.data ?? []) as WordRow[]).map(mapWord);
  const fieldTypes = await getFieldTypeOptions();
  const levelOrder = new Map(fieldTypes.map((fieldType, index) => [fieldType.id, index]));

  return words.sort((left, right) => {
    const levelDiff = (levelOrder.get(left.fieldTypeId) ?? 99) - (levelOrder.get(right.fieldTypeId) ?? 99);
    if (levelDiff !== 0) return levelDiff;
    return left.label.localeCompare(right.label);
  });
}

function revalidateCatalog() {
  revalidatePath("/catalog/words");
  revalidatePath("/catalog/words-manage");
  revalidatePath("/generator");
  revalidatePath("/dashboard");
}

export async function createWordAction(formData: FormData) {
  "use server";
  await requireRole("editor");

  const parsed = createWordSchema.safeParse({
    label: formData.get("label"),
    referenceCode: formData.get("referenceCode"),
    categoryLevelId: formData.get("categoryLevelId") || undefined,
    fieldTypeId: formData.get("fieldTypeId") || undefined,
    designationPt: formData.get("designationPt"),
    designationEs: formData.get("designationEs"),
    designationEn: formData.get("designationEn"),
    includeInDesignation: formData.get("includeInDesignation") === "on",
  });

  if (!parsed.success) {
    redirect("/catalog/words-manage?status=error&message=Dados+invalidos+na+nova+palavra");
  }

  const supabase = createSupabaseServiceServerClient();
  if (!supabase) {
    redirect("/catalog/words-manage?status=error&message=Supabase+service+role+nao+configurada");
  }

  const { label, referenceCode, designationPt, designationEs, designationEn, includeInDesignation } =
    parsed.data;

  let categoryLevelId = parsed.data.categoryLevelId ?? null;
  let defaultFieldTypeId = parsed.data.fieldTypeId ?? null;

  if (categoryLevelId) {
    const { data: level, error: levelErr } = await supabase
      .from("skus_category_levels")
      .select("id, legacy_field_type_id, is_enabled")
      .eq("id", categoryLevelId)
      .maybeSingle();
    if (levelErr || !level) {
      redirect("/catalog/words-manage?status=error&message=Nivel+invalido");
    }
    if (!defaultFieldTypeId) {
      defaultFieldTypeId = level.legacy_field_type_id ? String(level.legacy_field_type_id) : null;
    }
  } else if (defaultFieldTypeId) {
    // Compat UI legacy: resolver nivel Cosmética por legacy_field_type_id
    const { data: level } = await supabase
      .from("skus_category_levels")
      .select("id")
      .eq("legacy_field_type_id", defaultFieldTypeId)
      .limit(1)
      .maybeSingle();
    categoryLevelId = level?.id ? String(level.id) : null;
  }

  if (!categoryLevelId && !defaultFieldTypeId) {
    redirect("/catalog/words-manage?status=error&message=Falta+nivel+ou+field+type");
  }

  const normalizedReferenceCode = normalizeWordReferenceCode(referenceCode);
  if (!isEmptyWordReferenceCode(normalizedReferenceCode)) {
    try {
      const conflict = await findWordReferenceConflict(supabase, normalizedReferenceCode, {
        fieldTypeId: defaultFieldTypeId,
        categoryLevelId,
        wordLabel: label,
      });
      if (conflict) {
        redirect(
          `/catalog/words-manage?status=error&message=${encodeURIComponent(formatWordReferenceConflictMessage(conflict))}`,
        );
      }
    } catch {
      redirect("/catalog/words-manage?status=error&message=Nao+foi+possivel+validar+a+referencia");
    }
  }

  const insertResult = await supabase.from("skus_words").insert({
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
    is_active: true,
  });

  if (insertResult.error) {
    const message =
      insertResult.error.code === "23505"
        ? encodeURIComponent("Referencia ja existente noutra palavra do mesmo nivel.")
        : "Nao+foi+possivel+criar+a+palavra";
    redirect(`/catalog/words-manage?status=error&message=${message}`);
  }

  revalidateCatalog();
  redirect("/catalog/words-manage?status=success&message=Palavra+criada+com+sucesso");
}

export async function updateWordAction(formData: FormData) {
  "use server";
  await requireRole("editor");

  const parsed = updateWordSchema.safeParse({
    wordId: formData.get("wordId"),
    label: formData.get("label"),
    referenceCode: formData.get("referenceCode"),
    categoryLevelId: formData.get("categoryLevelId") || undefined,
    fieldTypeId: formData.get("fieldTypeId") || undefined,
    designationPt: formData.get("designationPt"),
    designationEs: formData.get("designationEs"),
    designationEn: formData.get("designationEn"),
    includeInDesignation: formData.get("includeInDesignation") === "on",
  });

  if (!parsed.success) {
    redirect(`/catalog/words-manage/${String(formData.get("wordId") ?? "")}?status=error&message=Dados+invalidos+na+edicao`);
  }

  const supabase = createSupabaseServiceServerClient();
  if (!supabase) {
    redirect(`/catalog/words-manage/${parsed.data.wordId}?status=error&message=Supabase+service+role+nao+configurada`);
  }

  const { wordId, label, referenceCode, designationPt, designationEs, designationEn, includeInDesignation } =
    parsed.data;

  let categoryLevelId = parsed.data.categoryLevelId ?? null;
  let defaultFieldTypeId = parsed.data.fieldTypeId ?? null;

  if (categoryLevelId) {
    const { data: level } = await supabase
      .from("skus_category_levels")
      .select("id, legacy_field_type_id")
      .eq("id", categoryLevelId)
      .maybeSingle();
    if (!level) {
      redirect(`/catalog/words-manage/${wordId}?status=error&message=Nivel+invalido`);
    }
    if (!defaultFieldTypeId) {
      defaultFieldTypeId = level.legacy_field_type_id ? String(level.legacy_field_type_id) : null;
    }
  }

  const normalizedReferenceCode = normalizeWordReferenceCode(referenceCode);
  if (!isEmptyWordReferenceCode(normalizedReferenceCode)) {
    try {
      const conflict = await findWordReferenceConflict(supabase, normalizedReferenceCode, {
        excludeWordId: wordId,
        fieldTypeId: defaultFieldTypeId,
        categoryLevelId,
        wordLabel: label,
      });
      if (conflict) {
        redirect(
          `/catalog/words-manage/${wordId}?status=error&message=${encodeURIComponent(formatWordReferenceConflictMessage(conflict))}`,
        );
      }
    } catch {
      redirect(`/catalog/words-manage/${wordId}?status=error&message=Nao+foi+possivel+validar+a+referencia`);
    }
  }

  const updateResult = await supabase
    .from("skus_words")
    .update({
      label,
      normalized_label: normalizeLabel(label),
      reference_code: normalizedReferenceCode,
      default_field_type_id: defaultFieldTypeId,
      ...(categoryLevelId ? { category_level_id: categoryLevelId } : {}),
      designation: designationPt,
      designation_pt: designationPt,
      designation_es: designationEs,
      designation_en: designationEn,
      include_in_designation: includeInDesignation,
      updated_at: new Date().toISOString(),
    })
    .eq("id", wordId);

  if (updateResult.error) {
    const message =
      updateResult.error.code === "23505"
        ? encodeURIComponent("Referencia ja existente noutra palavra do mesmo nivel.")
        : "Nao+foi+possivel+editar+a+palavra";
    redirect(`/catalog/words-manage/${wordId}?status=error&message=${message}`);
  }

  revalidateCatalog();
  revalidatePath(`/catalog/words-manage/${wordId}`);
  redirect("/catalog/words-manage?status=success&message=Palavra+editada+com+sucesso");
}

/** Soft-delete: is_active=false. Sin hard delete en 2B. */
export async function deleteWordAction(formData: FormData) {
  "use server";
  await requireRole("editor");

  const parsed = deleteWordSchema.safeParse({
    wordId: formData.get("wordId"),
  });

  if (!parsed.success) {
    redirect("/catalog/words-manage?status=error&message=Palavra+invalida+para+desativar");
  }

  const supabase = createSupabaseServiceServerClient();
  if (!supabase) {
    redirect("/catalog/words-manage?status=error&message=Supabase+service+role+nao+configurada");
  }

  const deactivateResult = await supabase
    .from("skus_words")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", parsed.data.wordId);
  if (deactivateResult.error) {
    redirect("/catalog/words-manage?status=error&message=Nao+foi+possivel+desativar+a+palavra");
  }

  revalidateCatalog();
  redirect("/catalog/words-manage?status=success&message=Palavra+desativada");
}

export async function reactivateWordAction(formData: FormData) {
  "use server";
  await requireRole("editor");

  const parsed = deleteWordSchema.safeParse({
    wordId: formData.get("wordId"),
  });

  if (!parsed.success) {
    redirect("/catalog/words-manage?status=error&message=Palavra+invalida");
  }

  const supabase = createSupabaseServiceServerClient();
  if (!supabase) {
    redirect("/catalog/words-manage?status=error&message=Supabase+service+role+nao+configurada");
  }

  const { data: word, error: wordError } = await supabase
    .from("skus_words")
    .select("reference_code, label, default_field_type_id, category_level_id")
    .eq("id", parsed.data.wordId)
    .maybeSingle();

  if (wordError || !word) {
    redirect("/catalog/words-manage?status=error&message=Palavra+invalida");
  }

  const normalizedReferenceCode = normalizeWordReferenceCode(String(word.reference_code ?? ""));
  if (!isEmptyWordReferenceCode(normalizedReferenceCode)) {
    try {
      const conflict = await findWordReferenceConflict(supabase, normalizedReferenceCode, {
        excludeWordId: parsed.data.wordId,
        fieldTypeId: word.default_field_type_id ? String(word.default_field_type_id) : null,
        categoryLevelId: word.category_level_id ? String(word.category_level_id) : null,
        wordLabel: String(word.label ?? ""),
      });
      if (conflict) {
        redirect(
          `/catalog/words-manage?status=error&message=${encodeURIComponent(formatWordReferenceConflictMessage(conflict))}`,
        );
      }
    } catch {
      redirect("/catalog/words-manage?status=error&message=Nao+foi+possivel+validar+a+referencia");
    }
  }

  const { error } = await supabase
    .from("skus_words")
    .update({ is_active: true, updated_at: new Date().toISOString() })
    .eq("id", parsed.data.wordId);

  if (error) {
    redirect("/catalog/words-manage?status=error&message=Nao+foi+possivel+reativar+a+palavra");
  }

  revalidateCatalog();
  redirect("/catalog/words-manage?status=success&message=Palavra+reativada");
}

// Compatibilidad para despliegues que todavia compilen rutas antiguas de familias.
// El producto actual no usa familias/arboles; estas funciones redirigen a Biblioteca.
export async function getFamilyOptions(): Promise<FamilyOption[]> {
  return [];
}

export async function getWordDependencyOptions(): Promise<WordDependencyOption[]> {
  return [];
}

export async function getFamiliesCatalog(): Promise<FamilyCatalogItem[]> {
  return [];
}

export async function getFamilyBuilderDetail(_familyId?: string): Promise<FamilyBuilderDetail | null> {
  return null;
}

export async function createFamilyAction(_formData?: FormData) {
  "use server";
  redirect("/catalog/words-manage");
}

export async function deleteFamilyAction(_formData?: FormData) {
  "use server";
  redirect("/catalog/words-manage");
}

export async function createFamilyDraftTreeAction(_formData?: FormData) {
  "use server";
  redirect("/catalog/words-manage");
}

export async function updateFamilyLevelLabelAction(_formData?: FormData) {
  "use server";
  redirect("/catalog/words-manage");
}

export async function createFamilyLevelAction(_formData?: FormData) {
  "use server";
  redirect("/catalog/words-manage");
}

export async function attachWordToFamilyLevelAction(_formData?: FormData) {
  "use server";
  redirect("/catalog/words-manage");
}

export async function deleteFamilyLevelAction(_formData?: FormData) {
  "use server";
  redirect("/catalog/words-manage");
}
