"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { createSupabaseServiceServerClient } from "@/lib/supabase-service-server";

export interface SkuCategoryRow {
  id: string;
  slug: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
}

export interface CategoryLevelRow {
  id: string;
  categoryId: string;
  key: string;
  label: string;
  sortOrder: number;
  isEnabled: boolean;
  isRequired: boolean;
  participatesInCode: boolean;
  legacyFieldTypeId: string | null;
}

export interface CatalogWordRow {
  id: string;
  categoryLevelId: string;
  defaultFieldTypeId: string | null;
  label: string;
  referenceCode: string;
  designationPt: string;
  designationEs: string;
  designationEn: string;
  includeInDesignation: boolean;
  isActive: boolean;
}

export interface GeneratorCatalogForCategory {
  category: SkuCategoryRow;
  levels: Array<
    CategoryLevelRow & {
      options: CatalogWordRow[];
    }
  >;
}

export interface CategoryConfigurationForAdmin {
  category: SkuCategoryRow;
  levels: Array<
    CategoryLevelRow & {
      words: CatalogWordRow[];
    }
  >;
}

const levelKeySchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z][a-z0-9-]{0,49}$/, "invalid_level_key");

const createLevelSchema = z.object({
  categoryId: z.string().uuid(),
  key: levelKeySchema,
  label: z.string().trim().min(1),
  sortOrder: z.coerce.number().int().min(0),
  isEnabled: z.boolean().default(true),
  isRequired: z.boolean().default(false),
  participatesInCode: z.boolean().default(true),
});

const updateLevelSchema = z.object({
  levelId: z.string().uuid(),
  label: z.string().trim().min(1),
  sortOrder: z.coerce.number().int().min(0),
  isEnabled: z.boolean(),
  isRequired: z.boolean(),
  participatesInCode: z.boolean(),
});

const levelIdSchema = z.object({
  levelId: z.string().uuid(),
});

function mapCategory(row: Record<string, unknown>): SkuCategoryRow {
  return {
    id: String(row.id),
    slug: String(row.slug),
    name: String(row.name),
    sortOrder: Number(row.sort_order ?? 0),
    isActive: Boolean(row.is_active ?? true),
  };
}

function mapLevel(row: Record<string, unknown>): CategoryLevelRow {
  return {
    id: String(row.id),
    categoryId: String(row.category_id),
    key: String(row.key),
    label: String(row.label),
    sortOrder: Number(row.sort_order ?? 0),
    isEnabled: Boolean(row.is_enabled ?? true),
    isRequired: Boolean(row.is_required ?? false),
    participatesInCode: Boolean(row.participates_in_code ?? true),
    legacyFieldTypeId: row.legacy_field_type_id ? String(row.legacy_field_type_id) : null,
  };
}

function mapWord(row: Record<string, unknown>): CatalogWordRow {
  return {
    id: String(row.id),
    categoryLevelId: String(row.category_level_id),
    defaultFieldTypeId: row.default_field_type_id ? String(row.default_field_type_id) : null,
    label: String(row.label ?? ""),
    referenceCode: String(row.reference_code ?? ""),
    designationPt: String(row.designation_pt ?? row.designation ?? row.label ?? ""),
    designationEs: String(row.designation_es ?? row.designation ?? row.label ?? ""),
    designationEn: String(row.designation_en ?? row.designation ?? row.label ?? ""),
    includeInDesignation: Boolean(row.include_in_designation ?? true),
    isActive: Boolean(row.is_active ?? true),
  };
}

export async function getCategories(options?: { includeInactive?: boolean }): Promise<SkuCategoryRow[]> {
  const supabase = createSupabaseServiceServerClient();
  if (!supabase) return [];

  let query = supabase
    .from("skus_categories")
    .select("id, slug, name, sort_order, is_active")
    .order("sort_order", { ascending: true });

  if (!options?.includeInactive) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map(mapCategory);
}

/** Catálogo del generador: solo niveles/palabras activos. Accesible viewer+. */
export async function getGeneratorCatalogForCategory(categoryId: string): Promise<GeneratorCatalogForCategory | null> {
  const supabase = createSupabaseServiceServerClient();
  if (!supabase) return null;

  const { data: category, error: catErr } = await supabase
    .from("skus_categories")
    .select("id, slug, name, sort_order, is_active")
    .eq("id", categoryId)
    .eq("is_active", true)
    .maybeSingle();
  if (catErr) throw new Error(catErr.message);
  if (!category) return null;

  const { data: levels, error: levelErr } = await supabase
    .from("skus_category_levels")
    .select(
      "id, category_id, key, label, sort_order, is_enabled, is_required, participates_in_code, legacy_field_type_id",
    )
    .eq("category_id", categoryId)
    .eq("is_enabled", true)
    .order("sort_order", { ascending: true });
  if (levelErr) throw new Error(levelErr.message);

  const levelRows = ((levels ?? []) as Record<string, unknown>[]).map(mapLevel);
  const levelIds = levelRows.map((l) => l.id);

  let words: CatalogWordRow[] = [];
  if (levelIds.length > 0) {
    const { data: wordRows, error: wordErr } = await supabase
      .from("skus_words")
      .select(
        "id, category_level_id, default_field_type_id, label, reference_code, designation, designation_pt, designation_es, designation_en, include_in_designation, is_active",
      )
      .in("category_level_id", levelIds)
      .eq("is_active", true)
      .order("label", { ascending: true });
    if (wordErr) throw new Error(wordErr.message);
    words = ((wordRows ?? []) as Record<string, unknown>[]).map(mapWord);
  }

  return {
    category: mapCategory(category as Record<string, unknown>),
    levels: levelRows.map((level) => ({
      ...level,
      options: words.filter((w) => w.categoryLevelId === level.id),
    })),
  };
}

/** Config admin: incluye deshabilitados/inactivos. */
export async function getCategoryConfigurationForAdmin(
  categoryId: string,
): Promise<CategoryConfigurationForAdmin | null> {
  await requireRole("manager");
  const supabase = createSupabaseServiceServerClient();
  if (!supabase) return null;

  const { data: category, error: catErr } = await supabase
    .from("skus_categories")
    .select("id, slug, name, sort_order, is_active")
    .eq("id", categoryId)
    .maybeSingle();
  if (catErr) throw new Error(catErr.message);
  if (!category) return null;

  const { data: levels, error: levelErr } = await supabase
    .from("skus_category_levels")
    .select(
      "id, category_id, key, label, sort_order, is_enabled, is_required, participates_in_code, legacy_field_type_id",
    )
    .eq("category_id", categoryId)
    .order("sort_order", { ascending: true });
  if (levelErr) throw new Error(levelErr.message);

  const levelRows = ((levels ?? []) as Record<string, unknown>[]).map(mapLevel);
  const levelIds = levelRows.map((l) => l.id);

  let words: CatalogWordRow[] = [];
  if (levelIds.length > 0) {
    const { data: wordRows, error: wordErr } = await supabase
      .from("skus_words")
      .select(
        "id, category_level_id, default_field_type_id, label, reference_code, designation, designation_pt, designation_es, designation_en, include_in_designation, is_active",
      )
      .in("category_level_id", levelIds)
      .order("label", { ascending: true });
    if (wordErr) throw new Error(wordErr.message);
    words = ((wordRows ?? []) as Record<string, unknown>[]).map(mapWord);
  }

  return {
    category: mapCategory(category as Record<string, unknown>),
    levels: levelRows.map((level) => ({
      ...level,
      words: words.filter((w) => w.categoryLevelId === level.id),
    })),
  };
}

function revalidateCategoryPaths() {
  revalidatePath("/generator");
  revalidatePath("/catalog/words");
  revalidatePath("/catalog/words-manage");
  revalidatePath("/dashboard");
}

export async function createCategoryLevelAction(formData: FormData) {
  "use server";
  await requireRole("manager");

  const parsed = createLevelSchema.safeParse({
    categoryId: formData.get("categoryId"),
    key: formData.get("key"),
    label: formData.get("label"),
    sortOrder: formData.get("sortOrder"),
    isEnabled: formData.get("isEnabled") !== "off",
    isRequired: formData.get("isRequired") === "on",
    participatesInCode: formData.get("participatesInCode") !== "off",
  });

  if (!parsed.success) {
    redirect("/catalog/words-manage?status=error&message=Dados+invalidos+no+nivel");
  }

  const supabase = createSupabaseServiceServerClient();
  if (!supabase) {
    redirect("/catalog/words-manage?status=error&message=Supabase+service+role+nao+configurada");
  }

  const { error } = await supabase.from("skus_category_levels").insert({
    category_id: parsed.data.categoryId,
    key: parsed.data.key,
    label: parsed.data.label,
    sort_order: parsed.data.sortOrder,
    is_enabled: parsed.data.isEnabled,
    is_required: parsed.data.isRequired,
    participates_in_code: parsed.data.participatesInCode,
  });

  if (error) {
    redirect("/catalog/words-manage?status=error&message=Nao+foi+possivel+criar+o+nivel");
  }

  revalidateCategoryPaths();
  redirect("/catalog/words-manage?status=success&message=Nivel+criado");
}

export async function updateCategoryLevelAction(formData: FormData) {
  "use server";
  await requireRole("manager");

  const parsed = updateLevelSchema.safeParse({
    levelId: formData.get("levelId"),
    label: formData.get("label"),
    sortOrder: formData.get("sortOrder"),
    isEnabled: formData.get("isEnabled") !== "off",
    isRequired: formData.get("isRequired") === "on",
    participatesInCode: formData.get("participatesInCode") !== "off",
  });

  if (!parsed.success) {
    redirect("/catalog/words-manage?status=error&message=Dados+invalidos+na+edicao+do+nivel");
  }

  const supabase = createSupabaseServiceServerClient();
  if (!supabase) {
    redirect("/catalog/words-manage?status=error&message=Supabase+service+role+nao+configurada");
  }

  // key no editable aquí (contrato: no cambiar key con dependencias)
  const { error } = await supabase
    .from("skus_category_levels")
    .update({
      label: parsed.data.label,
      sort_order: parsed.data.sortOrder,
      is_enabled: parsed.data.isEnabled,
      is_required: parsed.data.isRequired,
      participates_in_code: parsed.data.participatesInCode,
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.levelId);

  if (error) {
    redirect("/catalog/words-manage?status=error&message=Nao+foi+possivel+editar+o+nivel");
  }

  revalidateCategoryPaths();
  redirect("/catalog/words-manage?status=success&message=Nivel+atualizado");
}

export async function deactivateCategoryLevelAction(formData: FormData) {
  "use server";
  await requireRole("manager");

  const parsed = levelIdSchema.safeParse({ levelId: formData.get("levelId") });
  if (!parsed.success) {
    redirect("/catalog/words-manage?status=error&message=Nivel+invalido");
  }

  const supabase = createSupabaseServiceServerClient();
  if (!supabase) {
    redirect("/catalog/words-manage?status=error&message=Supabase+service+role+nao+configurada");
  }

  const { error } = await supabase
    .from("skus_category_levels")
    .update({ is_enabled: false, updated_at: new Date().toISOString() })
    .eq("id", parsed.data.levelId);

  if (error) {
    redirect("/catalog/words-manage?status=error&message=Nao+foi+possivel+desativar+o+nivel");
  }

  revalidateCategoryPaths();
  redirect("/catalog/words-manage?status=success&message=Nivel+desativado");
}

export async function reactivateCategoryLevelAction(formData: FormData) {
  "use server";
  await requireRole("manager");

  const parsed = levelIdSchema.safeParse({ levelId: formData.get("levelId") });
  if (!parsed.success) {
    redirect("/catalog/words-manage?status=error&message=Nivel+invalido");
  }

  const supabase = createSupabaseServiceServerClient();
  if (!supabase) {
    redirect("/catalog/words-manage?status=error&message=Supabase+service+role+nao+configurada");
  }

  const { error } = await supabase
    .from("skus_category_levels")
    .update({ is_enabled: true, updated_at: new Date().toISOString() })
    .eq("id", parsed.data.levelId);

  if (error) {
    redirect("/catalog/words-manage?status=error&message=Nao+foi+possivel+reativar+o+nivel");
  }

  revalidateCategoryPaths();
  redirect("/catalog/words-manage?status=success&message=Nivel+reativado");
}
