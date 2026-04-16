import { unstable_noStore as noStore } from "next/cache";
import { createSupabaseServiceServerClient } from "@/lib/supabase-service-server";
import type { GeneratorEdge, GeneratorFamily, GeneratorLevel, GeneratorWord } from "@/lib/types";

type FamilyRow = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  active_tree_version_id: string | null;
};

type TreeVersionRow = {
  id: string;
  family_id: string;
  status: string;
  version_number: number;
};

type FieldTypeRelation = { code?: string | null; name?: string | null } | Array<{ code?: string | null; name?: string | null }> | null;

type LevelRow = {
  id: string;
  tree_version_id: string;
  level_order: number;
  field_type_id?: string;
  label_override: string | null;
  skus_field_types?: FieldTypeRelation;
};

type WordRow = {
  id: string;
  label: string;
  reference_code: string;
  default_field_type_id: string;
  designation?: string | null;
  include_in_designation?: boolean | null;
};

type WordDependencyRow = {
  child_word_id: string;
  parent_word_id: string;
};

type WordFamilyRow = {
  word_id: string;
  family_id: string;
};

type EdgeRow = {
  from_level_id: string;
  from_word_id: string;
  to_level_id: string;
  to_word_id: string;
};

function getFieldTypeRelation(
  relation: FieldTypeRelation | undefined,
  fallbackCode: string,
  fallbackName: string,
) {
  if (!relation) {
    return { code: fallbackCode, name: fallbackName };
  }

  if (Array.isArray(relation)) {
    return {
      code: relation[0]?.code ?? fallbackCode,
      name: relation[0]?.name ?? fallbackName,
    };
  }

  return {
    code: relation.code ?? fallbackCode,
    name: relation.name ?? fallbackName,
  };
}

function getWordRelation(relation: WordRow, parentWordIds: string[]): GeneratorWord {
  return {
    id: relation.id,
    label: relation.label,
    referenceCode: relation.reference_code,
    designation: String(relation.designation ?? relation.label ?? ""),
    includeInDesignation: Boolean(relation.include_in_designation ?? true),
    parentWordIds,
  };
}

export async function getGeneratorFamilies(): Promise<GeneratorFamily[]> {
  noStore();

  const supabase = createSupabaseServiceServerClient();
  if (!supabase) {
    const { getGeneratorFamilies: getDemoGeneratorFamilies } = await import("@/lib/data");
    return getDemoGeneratorFamilies();
  }

  const familiesResult = await supabase
    .from("skus_families")
    .select("id, name, description, status, active_tree_version_id")
    .neq("status", "archived")
    .order("name", { ascending: true });

  const families = (familiesResult.data ?? []) as FamilyRow[];
  if (!families.length) return [];

  const familyIds = families.map((family) => family.id);
  const versionsResult = await supabase
    .from("skus_family_tree_versions")
    .select("id, family_id, status, version_number")
    .in("family_id", familyIds)
    .order("version_number", { ascending: false });

  const versions = (versionsResult.data ?? []) as TreeVersionRow[];
  const treeVersionIdByFamily = new Map<string, string | null>();

  for (const family of families) {
    if (family.active_tree_version_id) {
      treeVersionIdByFamily.set(family.id, family.active_tree_version_id);
      continue;
    }

    const draftVersion = versions.find((item) => item.family_id === family.id && item.status === "draft");
    treeVersionIdByFamily.set(family.id, draftVersion?.id ?? null);
  }

  const treeVersionIds = Array.from(new Set(Array.from(treeVersionIdByFamily.values()).filter((value): value is string => Boolean(value))));

  const levelsResult = treeVersionIds.length
    ? await supabase
        .from("skus_family_tree_levels")
        .select("id, tree_version_id, field_type_id, level_order, label_override, skus_field_types(code, name)")
        .in("tree_version_id", treeVersionIds)
        .order("level_order", { ascending: true })
    : { data: [] as Array<Record<string, unknown>> };

  const levels = (levelsResult.data ?? []) as LevelRow[];

  const edgesResult = treeVersionIds.length
    ? await supabase
        .from("skus_family_tree_edges")
        .select("from_level_id, from_word_id, to_level_id, to_word_id")
        .in("tree_version_id", treeVersionIds)
        .eq("is_active", true)
    : { data: [] as Array<Record<string, unknown>> };

  const wordDependenciesResult = await supabase
    .from("skus_word_dependencies")
    .select("child_word_id, parent_word_id");

  const [wordsResult, wordFamiliesResult] = await Promise.all([
    supabase
      .from("skus_words")
      .select("id, label, reference_code, default_field_type_id, designation, include_in_designation")
      .eq("is_active", true)
      .order("label", { ascending: true }),
    supabase
      .from("skus_word_families")
      .select("word_id, family_id"),
  ]);

  const parentWordIdsByWord = new Map<string, string[]>();
  for (const row of (wordDependenciesResult.data ?? []) as WordDependencyRow[]) {
    const items = parentWordIdsByWord.get(row.child_word_id) ?? [];
    items.push(row.parent_word_id);
    parentWordIdsByWord.set(row.child_word_id, items);
  }

  const familyIdsByWord = new Map<string, string[]>();
  for (const row of (wordFamiliesResult.data ?? []) as WordFamilyRow[]) {
    const items = familyIdsByWord.get(row.word_id) ?? [];
    items.push(row.family_id);
    familyIdsByWord.set(row.word_id, items);
  }

  const words = (wordsResult.data ?? []) as WordRow[];

  const levelsByTreeVersion = new Map<string, GeneratorLevel[]>();
  for (const level of levels) {
    const fieldType = getFieldTypeRelation(level.skus_field_types, "custom", "Campo");
    const items = levelsByTreeVersion.get(level.tree_version_id) ?? [];
    const familyId = versions.find((version) => version.id === level.tree_version_id)?.family_id;
    const levelWords = words
      .filter((word) => {
        if (!familyId) return false;
        return word.default_field_type_id === level.field_type_id && (familyIdsByWord.get(word.id) ?? []).includes(familyId);
      })
      .map((word) => getWordRelation(word, parentWordIdsByWord.get(word.id) ?? []));
    items.push({
      id: level.id,
      order: level.level_order,
      fieldType: fieldType.code,
      label: level.label_override || fieldType.name,
      options: levelWords,
    });
    levelsByTreeVersion.set(level.tree_version_id, items);
  }

  const edgesByTreeVersion = new Map<string, GeneratorEdge[]>();
  for (const row of edgesResult.data ?? []) {
    const edge = row as EdgeRow;
    const treeVersionId = levels.find((level) => level.id === edge.from_level_id)?.tree_version_id;
    if (!treeVersionId) continue;

    const items = edgesByTreeVersion.get(treeVersionId) ?? [];
    items.push({
      fromLevelId: edge.from_level_id,
      fromWordId: edge.from_word_id,
      toLevelId: edge.to_level_id,
      toWordId: edge.to_word_id,
    });
    edgesByTreeVersion.set(treeVersionId, items);
  }

  return families.map((family) => {
    const treeVersionId = treeVersionIdByFamily.get(family.id) ?? null;

    return {
      id: family.id,
      name: family.name,
      description: family.description ?? "Sem descricao",
      levels: treeVersionId ? levelsByTreeVersion.get(treeVersionId) ?? [] : [],
      edges: treeVersionId ? edgesByTreeVersion.get(treeVersionId) ?? [] : [],
    };
  });
}
