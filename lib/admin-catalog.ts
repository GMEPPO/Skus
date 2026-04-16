"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { MAX_FAMILY_LEVELS } from "@/lib/family-builder";
import { createSupabaseServiceServerClient } from "@/lib/supabase-service-server";
import type { FamilyListItem, WordListItem } from "@/lib/types";

export interface FieldTypeOption {
  id: string;
  code: string;
  name: string;
}

export interface FamilyOption {
  id: string;
  name: string;
}

export interface FamilyBuilderLevelWord {
  id: string;
  label: string;
  referenceCode: string;
}

export interface FamilyBuilderLevel {
  id: string;
  order: number;
  label: string;
  fieldTypeName: string;
  words: FamilyBuilderLevelWord[];
}

export interface FamilyBuilderDetail {
  id: string;
  name: string;
  slug: string;
  description: string;
  status: string;
  draftTreeVersionId: string | null;
  publishedTreeVersionId: string | null;
  levels: FamilyBuilderLevel[];
}

type SupabaseFieldTypeRelation = { name?: string | null } | Array<{ name?: string | null }> | null;

type SupabaseWordRow = {
  id: string;
  label: string;
  reference_code: string;
  designation: string | null;
  include_in_designation: boolean | null;
  skus_field_types?: SupabaseFieldTypeRelation;
};

type SupabaseWordFamilyRow = {
  word_id: string;
  skus_families:
    | { id?: string; name?: string }
    | Array<{ id?: string; name?: string }>
    | null;
};

type SupabaseFamilyRow = {
  id: string;
  name: string;
  slug?: string;
  description: string | null;
  status: string;
  active_tree_version_id: string | null;
};

type SupabaseFamilyLevelRow = {
  id?: string;
  tree_version_id: string;
  level_order?: number;
  label_override: string | null;
  skus_field_types?: SupabaseFieldTypeRelation;
};

type SupabaseTreeVersionRow = {
  id: string;
  family_id: string;
  status: string;
  version_number: number;
};

const createDraftTreeSchema = z.object({
  familyId: z.string().uuid(),
});

const createLevelSchema = z.object({
  familyId: z.string().uuid(),
  treeVersionId: z.string().uuid(),
  fieldTypeId: z.string().uuid(),
  labelOverride: z.string().trim().optional().transform((value) => value || ""),
});

const attachWordSchema = z.object({
  familyId: z.string().uuid(),
  treeLevelId: z.string().uuid(),
  wordId: z.string().uuid(),
});

const deleteLevelSchema = z.object({
  familyId: z.string().uuid(),
  treeLevelId: z.string().uuid(),
});

const createWordSchema = z.object({
  label: z.string().trim().min(2),
  referenceCode: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{3}$/),
  fieldTypeId: z.string().uuid(),
  designation: z.string().trim().min(1),
  includeInDesignation: z.boolean(),
  familyIds: z.array(z.string().uuid()).default([]),
});

const createFamilySchema = z.object({
  name: z.string().trim().min(2),
  slug: z
    .string()
    .trim()
    .min(2)
    .transform((value) => value.toLowerCase())
    .pipe(z.string().regex(/^[a-z0-9-]+$/)),
  description: z.string().trim().optional().transform((value) => value || ""),
  status: z.enum(["draft", "active", "archived"]),
});

function normalizeLabel(value: string) {
  return value.trim().toLowerCase();
}

function getFieldTypeRelationName(relation: SupabaseFieldTypeRelation | undefined, fallback: string) {
  if (!relation) return fallback;
  if (Array.isArray(relation)) {
    return relation[0]?.name ?? fallback;
  }
  return relation.name ?? fallback;
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

export async function getFamilyOptions(): Promise<FamilyOption[]> {
  const supabase = createSupabaseServiceServerClient();
  if (!supabase) {
    const { getFamilies } = await import("@/lib/data");
    return (await getFamilies()).map((family) => ({ id: family.id, name: family.name }));
  }

  const result = await supabase
    .from("skus_families")
    .select("id, name")
    .neq("status", "archived")
    .order("name", { ascending: true });

  return (result.data ?? []) as FamilyOption[];
}

export async function getWordsCatalog(): Promise<WordListItem[]> {
  const supabase = createSupabaseServiceServerClient();
  if (!supabase) {
    const { getWords } = await import("@/lib/data");
    return getWords();
  }

  const wordsResult = await supabase
    .from("skus_words")
    .select("id, label, reference_code, designation, include_in_designation, skus_field_types(name)")
    .order("label", { ascending: true });

  const familiesResult = await supabase
    .from("skus_word_families")
    .select("word_id, skus_families(id, name)");

  const familyLabelsByWord = new Map<string, string[]>();
  for (const row of (familiesResult.data ?? []) as SupabaseWordFamilyRow[]) {
    const relation = Array.isArray(row.skus_families) ? row.skus_families[0] : row.skus_families;
    if (!relation?.name) continue;

    const items = familyLabelsByWord.get(row.word_id) ?? [];
    items.push(String(relation.name));
    familyLabelsByWord.set(row.word_id, items);
  }

  return ((wordsResult.data ?? []) as SupabaseWordRow[]).map((row) => ({
    id: row.id,
    label: row.label,
    referenceCode: row.reference_code,
    fieldTypeLabel: getFieldTypeRelationName(row.skus_field_types, "Sem tipo"),
    designation: row.designation ?? row.label,
    includeInDesignation: row.include_in_designation ?? true,
    familyLabels: familyLabelsByWord.get(row.id) ?? [],
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

  const rows = (familiesResult.data ?? []) as SupabaseFamilyRow[];
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
  for (const row of (levelsResult.data ?? []) as SupabaseFamilyLevelRow[]) {
    const name = row.label_override
      ? String(row.label_override)
      : String(getFieldTypeRelationName(row.skus_field_types, "Nivel"));

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

export async function getFamilyBuilderDetail(familyId: string): Promise<FamilyBuilderDetail | null> {
  const supabase = createSupabaseServiceServerClient();
  if (!supabase) return null;

  const familyResult = await supabase
    .from("skus_families")
    .select("id, name, slug, description, status, active_tree_version_id")
    .eq("id", familyId)
    .maybeSingle();

  const family = familyResult.data as SupabaseFamilyRow | null;
  if (!family) return null;

  const versionsResult = await supabase
    .from("skus_family_tree_versions")
    .select("id, family_id, status, version_number")
    .eq("family_id", familyId)
    .order("version_number", { ascending: false });

  const versions = (versionsResult.data ?? []) as SupabaseTreeVersionRow[];
  const draftTree = versions.find((item) => item.status === "draft") ?? null;

  const levelsResult = draftTree
    ? await supabase
        .from("skus_family_tree_levels")
        .select("id, tree_version_id, level_order, label_override, skus_field_types(name)")
        .eq("tree_version_id", draftTree.id)
        .order("level_order", { ascending: true })
    : { data: [] as Array<Record<string, unknown>> };

  const levels = (levelsResult.data ?? []) as SupabaseFamilyLevelRow[];
  const levelIds = levels
    .map((row) => row.id)
    .filter((value): value is string => Boolean(value));

  const levelWordsResult = levelIds.length
    ? await supabase
        .from("skus_family_tree_level_words")
        .select("tree_level_id, skus_words(id, label, reference_code)")
        .in("tree_level_id", levelIds)
        .order("sort_order", { ascending: true })
    : { data: [] as Array<Record<string, unknown>> };

  const wordsByLevel = new Map<string, FamilyBuilderLevelWord[]>();
  for (const row of levelWordsResult.data ?? []) {
    const relation = row.skus_words as
      | { id?: string; label?: string; reference_code?: string }
      | Array<{ id?: string; label?: string; reference_code?: string }>
      | null;

    const word = Array.isArray(relation) ? relation[0] : relation;
    if (!word?.id) continue;

    const items = wordsByLevel.get(String(row.tree_level_id)) ?? [];
    items.push({
      id: String(word.id),
      label: String(word.label ?? ""),
      referenceCode: String(word.reference_code ?? ""),
    });
    wordsByLevel.set(String(row.tree_level_id), items);
  }

  return {
    id: family.id,
    name: family.name,
    slug: String(family.slug ?? ""),
    description: family.description ?? "",
    status: family.status,
    draftTreeVersionId: draftTree?.id ?? null,
    publishedTreeVersionId: family.active_tree_version_id ?? null,
    levels: levels.map((row) => ({
      id: String(row.id),
      order: Number(row.level_order ?? 0),
      label: row.label_override || getFieldTypeRelationName(row.skus_field_types, "Nivel"),
      fieldTypeName: getFieldTypeRelationName(row.skus_field_types, "Sem tipo"),
      words: wordsByLevel.get(String(row.id)) ?? [],
    })),
  };
}

export async function createWordAction(formData: FormData) {
  "use server";

  const parsed = createWordSchema.safeParse({
    label: formData.get("label"),
    referenceCode: formData.get("referenceCode"),
    fieldTypeId: formData.get("fieldTypeId"),
    designation: formData.get("designation"),
    includeInDesignation: formData.get("includeInDesignation") === "on",
    familyIds: formData.getAll("familyIds"),
  });

  if (!parsed.success) {
    redirect("/catalog/words-manage?status=error&message=Dados+invalidos+na+nova+palavra");
  }

  const supabase = createSupabaseServiceServerClient();
  if (!supabase) {
    redirect("/catalog/words-manage?status=error&message=Supabase+service+role+nao+configurada");
  }

  const { label, referenceCode, fieldTypeId, designation, includeInDesignation, familyIds } = parsed.data;

  const insertResult = await supabase
    .from("skus_words")
    .insert({
      label,
      normalized_label: normalizeLabel(label),
      reference_code: referenceCode,
      default_field_type_id: fieldTypeId,
      designation: designation || label,
      include_in_designation: includeInDesignation,
      is_active: true,
    })
    .select("id")
    .single();

  if (insertResult.error || !insertResult.data) {
    redirect("/catalog/words-manage?status=error&message=Nao+foi+possivel+criar+a+palavra");
  }

  if (familyIds.length > 0) {
    await supabase.from("skus_word_families").insert(
      familyIds.map((familyId) => ({
        word_id: insertResult.data.id,
        family_id: familyId,
      })),
    );
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

export async function createFamilyDraftTreeAction(formData: FormData) {
  "use server";

  const parsed = createDraftTreeSchema.safeParse({
    familyId: formData.get("familyId"),
  });

  if (!parsed.success) {
    redirect("/families-manage?status=error&message=Familia+invalida+para+novo+draft");
  }

  const supabase = createSupabaseServiceServerClient();
  if (!supabase) {
    redirect("/families-manage?status=error&message=Supabase+service+role+nao+configurada");
  }

  const versionsResult = await supabase
    .from("skus_family_tree_versions")
    .select("version_number, status")
    .eq("family_id", parsed.data.familyId)
    .order("version_number", { ascending: false });

  const existingDraft = (versionsResult.data ?? []).find((item) => item.status === "draft");
  if (existingDraft) {
    redirect(`/families-manage/${parsed.data.familyId}?status=success&message=Ja+existe+um+draft+aberto`);
  }

  const nextVersion = ((versionsResult.data ?? [])[0]?.version_number ?? 0) + 1;
  const inserted = await supabase
    .from("skus_family_tree_versions")
    .insert({
      family_id: parsed.data.familyId,
      version_number: nextVersion,
      status: "draft",
    })
    .select("id")
    .single();

  if (inserted.error) {
    redirect(`/families-manage/${parsed.data.familyId}?status=error&message=Nao+foi+possivel+criar+o+draft`);
  }

  revalidatePath(`/families-manage/${parsed.data.familyId}`);
  redirect(`/families-manage/${parsed.data.familyId}?status=success&message=Draft+criado+com+sucesso`);
}

export async function createFamilyLevelAction(formData: FormData) {
  "use server";

  const parsed = createLevelSchema.safeParse({
    familyId: formData.get("familyId"),
    treeVersionId: formData.get("treeVersionId"),
    fieldTypeId: formData.get("fieldTypeId"),
    labelOverride: formData.get("labelOverride"),
  });

  if (!parsed.success) {
    redirect(`/families-manage/${String(formData.get("familyId") ?? "")}?status=error&message=Dados+invalidos+no+nivel`);
  }

  const supabase = createSupabaseServiceServerClient();
  if (!supabase) {
    redirect(`/families-manage/${parsed.data.familyId}?status=error&message=Supabase+service+role+nao+configurada`);
  }

  const levelsResult = await supabase
    .from("skus_family_tree_levels")
    .select("level_order")
    .eq("tree_version_id", parsed.data.treeVersionId)
    .order("level_order", { ascending: false })
    .limit(1);

  const nextOrder = ((levelsResult.data ?? [])[0]?.level_order ?? 0) + 1;

  if (nextOrder > MAX_FAMILY_LEVELS) {
    redirect(`/families-manage/${parsed.data.familyId}?status=error&message=Esta+familia+so+pode+ter+ate+6+niveis`);
  }

  const insertResult = await supabase.from("skus_family_tree_levels").insert({
    tree_version_id: parsed.data.treeVersionId,
    field_type_id: parsed.data.fieldTypeId,
    level_order: nextOrder,
    label_override: parsed.data.labelOverride || null,
    is_required: true,
    designation_included: true,
  });

  if (insertResult.error) {
    redirect(`/families-manage/${parsed.data.familyId}?status=error&message=Nao+foi+possivel+criar+o+nivel`);
  }

  revalidatePath(`/families-manage/${parsed.data.familyId}`);
  redirect(`/families-manage/${parsed.data.familyId}?status=success&message=Nivel+adicionado+com+sucesso`);
}

export async function attachWordToFamilyLevelAction(formData: FormData) {
  "use server";

  const parsed = attachWordSchema.safeParse({
    familyId: formData.get("familyId"),
    treeLevelId: formData.get("treeLevelId"),
    wordId: formData.get("wordId"),
  });

  if (!parsed.success) {
    redirect(`/families-manage/${String(formData.get("familyId") ?? "")}?status=error&message=Dados+invalidos+na+associacao`);
  }

  const supabase = createSupabaseServiceServerClient();
  if (!supabase) {
    redirect(`/families-manage/${parsed.data.familyId}?status=error&message=Supabase+service+role+nao+configurada`);
  }

  const existingResult = await supabase
    .from("skus_family_tree_level_words")
    .select("sort_order")
    .eq("tree_level_id", parsed.data.treeLevelId)
    .order("sort_order", { ascending: false })
    .limit(1);

  const nextSortOrder = ((existingResult.data ?? [])[0]?.sort_order ?? 0) + 1;

  const insertResult = await supabase
    .from("skus_family_tree_level_words")
    .insert({
      tree_level_id: parsed.data.treeLevelId,
      word_id: parsed.data.wordId,
      sort_order: nextSortOrder,
    });

  if (insertResult.error) {
    redirect(`/families-manage/${parsed.data.familyId}?status=error&message=Nao+foi+possivel+ligar+a+palavra+ao+nivel`);
  }

  revalidatePath(`/families-manage/${parsed.data.familyId}`);
  redirect(`/families-manage/${parsed.data.familyId}?status=success&message=Palavra+associada+ao+nivel`);
}

export async function deleteFamilyLevelAction(formData: FormData) {
  "use server";

  const parsed = deleteLevelSchema.safeParse({
    familyId: formData.get("familyId"),
    treeLevelId: formData.get("treeLevelId"),
  });

  if (!parsed.success) {
    redirect(`/families-manage/${String(formData.get("familyId") ?? "")}?status=error&message=Nivel+invalido+para+remover`);
  }

  const supabase = createSupabaseServiceServerClient();
  if (!supabase) {
    redirect(`/families-manage/${parsed.data.familyId}?status=error&message=Supabase+service+role+nao+configurada`);
  }

  const levelResult = await supabase
    .from("skus_family_tree_levels")
    .select("id, tree_version_id")
    .eq("id", parsed.data.treeLevelId)
    .maybeSingle();

  if (levelResult.error || !levelResult.data) {
    redirect(`/families-manage/${parsed.data.familyId}?status=error&message=Nao+foi+possivel+encontrar+o+nivel`);
  }

  const treeVersionId = String(levelResult.data.tree_version_id);

  const deleteResult = await supabase
    .from("skus_family_tree_levels")
    .delete()
    .eq("id", parsed.data.treeLevelId);

  if (deleteResult.error) {
    redirect(`/families-manage/${parsed.data.familyId}?status=error&message=Nao+foi+possivel+remover+o+nivel`);
  }

  const remainingLevelsResult = await supabase
    .from("skus_family_tree_levels")
    .select("id, level_order")
    .eq("tree_version_id", treeVersionId)
    .order("level_order", { ascending: true });

  const remainingLevels = remainingLevelsResult.data ?? [];
  for (const [index, level] of remainingLevels.entries()) {
    const expectedOrder = index + 1;
    if (level.level_order !== expectedOrder) {
      await supabase
        .from("skus_family_tree_levels")
        .update({ level_order: expectedOrder })
        .eq("id", level.id);
    }
  }

  revalidatePath(`/families-manage/${parsed.data.familyId}`);
  revalidatePath("/families-manage");
  revalidatePath("/generator");
  redirect(`/families-manage/${parsed.data.familyId}?status=success&message=Nivel+removido+com+sucesso`);
}
