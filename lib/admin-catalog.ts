"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServiceServerClient } from "@/lib/supabase-service-server";
import type { WordListItem } from "@/lib/types";

const GLOBAL_LEVEL_CODES = ["brand", "format", "product", "size", "packaging", "extra"] as const;

export interface FieldTypeOption {
  id: string;
  code: string;
  name: string;
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
  default_field_type_id: string;
  designation: string | null;
  designation_pt: string | null;
  designation_es: string | null;
  designation_en: string | null;
  include_in_designation: boolean | null;
  skus_field_types?: FieldTypeRelation;
};

const deleteWordSchema = z.object({
  wordId: z.string().uuid(),
});

const createWordSchema = z.object({
  label: z.string().trim().min(1),
  referenceCode: z.string().trim().toUpperCase().regex(/^[A-Z0-9&.]{1,3}$/),
  fieldTypeId: z.string().uuid(),
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

  const parsed = createWordSchema.safeParse({
    label: formData.get("label"),
    referenceCode: formData.get("referenceCode"),
    fieldTypeId: formData.get("fieldTypeId"),
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

  const { label, referenceCode, fieldTypeId, designationPt, designationEs, designationEn, includeInDesignation } = parsed.data;
  const insertResult = await supabase.from("skus_words").insert({
    label,
    normalized_label: normalizeLabel(label),
    reference_code: referenceCode,
    default_field_type_id: fieldTypeId,
    designation: designationPt,
    designation_pt: designationPt,
    designation_es: designationEs,
    designation_en: designationEn,
    include_in_designation: includeInDesignation,
    is_active: true,
  });

  if (insertResult.error) {
    redirect("/catalog/words-manage?status=error&message=Nao+foi+possivel+criar+a+palavra");
  }

  revalidateCatalog();
  redirect("/catalog/words-manage?status=success&message=Palavra+criada+com+sucesso");
}

export async function updateWordAction(formData: FormData) {
  "use server";

  const parsed = updateWordSchema.safeParse({
    wordId: formData.get("wordId"),
    label: formData.get("label"),
    referenceCode: formData.get("referenceCode"),
    fieldTypeId: formData.get("fieldTypeId"),
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

  const { wordId, label, referenceCode, fieldTypeId, designationPt, designationEs, designationEn, includeInDesignation } = parsed.data;
  const updateResult = await supabase
    .from("skus_words")
    .update({
      label,
      normalized_label: normalizeLabel(label),
      reference_code: referenceCode,
      default_field_type_id: fieldTypeId,
      designation: designationPt,
      designation_pt: designationPt,
      designation_es: designationEs,
      designation_en: designationEn,
      include_in_designation: includeInDesignation,
    })
    .eq("id", wordId);

  if (updateResult.error) {
    redirect(`/catalog/words-manage/${wordId}?status=error&message=Nao+foi+possivel+editar+a+palavra`);
  }

  revalidateCatalog();
  revalidatePath(`/catalog/words-manage/${wordId}`);
  redirect("/catalog/words-manage?status=success&message=Palavra+editada+com+sucesso");
}

export async function deleteWordAction(formData: FormData) {
  "use server";

  const parsed = deleteWordSchema.safeParse({
    wordId: formData.get("wordId"),
  });

  if (!parsed.success) {
    redirect("/catalog/words-manage?status=error&message=Palavra+invalida+para+eliminar");
  }

  const supabase = createSupabaseServiceServerClient();
  if (!supabase) {
    redirect("/catalog/words-manage?status=error&message=Supabase+service+role+nao+configurada");
  }

  const deleteResult = await supabase.from("skus_words").delete().eq("id", parsed.data.wordId);
  if (deleteResult.error) {
    redirect("/catalog/words-manage?status=error&message=Nao+foi+possivel+eliminar+a+palavra");
  }

  revalidateCatalog();
  redirect("/catalog/words-manage?status=success&message=Palavra+eliminada+com+sucesso");
}
