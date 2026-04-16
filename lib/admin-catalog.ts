"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServiceServerClient } from "@/lib/supabase-service-server";
import type { FamilyListItem, WordListItem } from "@/lib/types";

export interface FieldTypeOption {
  id: string;
  code: string;
  name: string;
}

const createWordSchema = z.object({
  label: z.string().trim().min(2),
  referenceCode: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{3}$/),
  fieldTypeId: z.string().uuid(),
  description: z.string().trim().optional().transform((value) => value || ""),
  contextType: z.string().trim().optional().transform((value) => value || ""),
  contextValue: z.string().trim().optional().transform((value) => value || ""),
});

const createFamilySchema = z.object({
  name: z.string().trim().min(2),
  slug: z.string().trim().min(2).regex(/^[a-z0-9-]+$/),
  description: z.string().trim().optional().transform((value) => value || ""),
  status: z.enum(["draft", "active", "archived"]),
});

function normalizeLabel(value: string) {
  return value.trim().toLowerCase();
}

export async function getFieldTypeOptions(): Promise<FieldTypeOption[]> {
  const supabase = createSupabaseServiceServerClient();
  if (!supabase) {
    return [
      { id: "00000000-0000-0000-0000-000000000001", code: "family", name: "Familia" },
      { id: "00000000-0000-0000-0000-000000000002", code: "format", name: "Formato" },
      { id: "00000000-0000-0000-0000-000000000003", code: "product", name: "Produto" },
      { id: "00000000-0000-0000-0000-000000000004", code: "size", name: "Tamanho" },
      { id: "00000000-0000-0000-0000-000000000005", code: "packaging", name: "Embalagem" },
      { id: "00000000-0000-0000-0000-000000000006", code: "extra", name: "Extra" },
    ];
  }

  const result = await supabase
    .from("skus_field_types")
    .select("id, code, name")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  return (result.data ?? []) as FieldTypeOption[];
}

export async function getWordsCatalog(): Promise<WordListItem[]> {
  const supabase = createSupabaseServiceServerClient();
  if (!supabase) {
    const { getWords } = await import("@/lib/data");
    return getWords();
  }

  const wordsResult = await supabase
    .from("skus_words")
    .select("id, label, reference_code, description, skus_field_types(name)")
    .order("label", { ascending: true });

  const contextsResult = await supabase
    .from("skus_word_contexts")
    .select("word_id, context_type, context_value");

  const contextMap = new Map<string, string>();
  for (const row of contextsResult.data ?? []) {
    const label = row.context_value
      ? `${row.context_type}: ${row.context_value}`
      : row.context_type;
    if (!contextMap.has(row.word_id)) {
      contextMap.set(row.word_id, label);
    }
  }

  return (wordsResult.data ?? []).map((row) => ({
    id: row.id,
    label: row.label,
    referenceCode: row.reference_code,
    fieldTypeLabel: Array.isArray(row.skus_field_types)
      ? row.skus_field_types[0]?.name ?? "Sem tipo"
      : row.skus_field_types?.name ?? "Sem tipo",
    contextLabel: contextMap.get(row.id) ?? "Sem contexto",
    description: row.description ?? "",
  }));
}

export async function getFamiliesCatalog(): Promise<FamilyListItem[]> {
  const supabase = createSupabaseServiceServerClient();
  if (!supabase) {
    const { getFamilies } = await import("@/lib/data");
    return getFamilies();
  }

  const familiesResult = await supabase
    .from("skus_families")
    .select("id, name, description, status, active_tree_version_id")
    .order("name", { ascending: true });

  const rows = familiesResult.data ?? [];
  const treeIds = rows
    .map((row) => row.active_tree_version_id)
    .filter((value): value is string => Boolean(value));

  const levelsResult = treeIds.length
    ? await supabase
        .from("skus_family_tree_levels")
        .select("tree_version_id, level_order, label_override, skus_field_types(name)")
        .in("tree_version_id", treeIds)
        .order("level_order", { ascending: true })
    : { data: [] as Array<Record<string, unknown>> };

  const levelsMap = new Map<string, string[]>();
  for (const row of levelsResult.data ?? []) {
    const name = row.label_override
      ? String(row.label_override)
      : Array.isArray(row.skus_field_types)
        ? String(row.skus_field_types[0]?.name ?? "Nivel")
        : String((row.skus_field_types as { name?: string } | null)?.name ?? "Nivel");

    const items = levelsMap.get(String(row.tree_version_id)) ?? [];
    items.push(name);
    levelsMap.set(String(row.tree_version_id), items);
  }

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description ?? "",
    status: row.status as FamilyListItem["status"],
    levelLabels: row.active_tree_version_id
      ? levelsMap.get(row.active_tree_version_id) ?? []
      : [],
  }));
}

export async function createWordAction(formData: FormData) {
  "use server";

  const parsed = createWordSchema.safeParse({
    label: formData.get("label"),
    referenceCode: formData.get("referenceCode"),
    fieldTypeId: formData.get("fieldTypeId"),
    description: formData.get("description"),
    contextType: formData.get("contextType"),
    contextValue: formData.get("contextValue"),
  });

  if (!parsed.success) {
    redirect("/catalog/words-manage?status=error&message=Dados+invalidos+na+nova+palavra");
  }

  const supabase = createSupabaseServiceServerClient();
  if (!supabase) {
    redirect("/catalog/words-manage?status=error&message=Supabase+service+role+nao+configurada");
  }

  const { label, referenceCode, fieldTypeId, description, contextType, contextValue } = parsed.data;

  const insertResult = await supabase
    .from("skus_words")
    .insert({
      label,
      normalized_label: normalizeLabel(label),
      reference_code: referenceCode,
      default_field_type_id: fieldTypeId,
      description: description || null,
      is_active: true,
    })
    .select("id")
    .single();

  if (insertResult.error || !insertResult.data) {
    redirect("/catalog/words-manage?status=error&message=Nao+foi+possivel+criar+a+palavra");
  }

  if (contextType) {
    await supabase.from("skus_word_contexts").insert({
      word_id: insertResult.data.id,
      context_type: contextType,
      context_value: contextValue || null,
    });
  }

  revalidatePath("/catalog/words");
  revalidatePath("/catalog/words-manage");
  revalidatePath("/families");
  revalidatePath("/families-manage");
  redirect("/catalog/words-manage?status=success&message=Palavra+criada+com+sucesso");
}

export async function createFamilyAction(formData: FormData) {
  "use server";

  const parsed = createFamilySchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    description: formData.get("description"),
    status: formData.get("status"),
  });

  if (!parsed.success) {
    redirect("/families-manage?status=error&message=Dados+invalidos+na+nova+familia");
  }

  const supabase = createSupabaseServiceServerClient();
  if (!supabase) {
    redirect("/families-manage?status=error&message=Supabase+service+role+nao+configurada");
  }

  const insertResult = await supabase.from("skus_families").insert({
    name: parsed.data.name,
    slug: parsed.data.slug,
    description: parsed.data.description || null,
    status: parsed.data.status,
  });

  if (insertResult.error) {
    redirect("/families-manage?status=error&message=Nao+foi+possivel+criar+a+familia");
  }

  revalidatePath("/families");
  revalidatePath("/families-manage");
  redirect("/families-manage?status=success&message=Familia+criada+com+sucesso");
}
