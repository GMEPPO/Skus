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
  label_override: string | null;
  skus_field_types?: FieldTypeRelation;
};

type LevelWordRow = {
  tree_level_id: string;
  skus_words:
    | { id?: string; label?: string; reference_code?: string; designation?: string | null; include_in_designation?: boolean | null }
    | Array<{ id?: string; label?: string; reference_code?: string; designation?: string | null; include_in_designation?: boolean | null }>
    | null;
};

type WordDependencyRow = {
  child_word_id: string;
  parent_word_id: string;
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

function getWordRelation(row: LevelWordRow, parentWordIds: string[]): GeneratorWord | null {
  const relation = Array.isArray(row.skus_words) ? row.skus_words[0] : row.skus_words;
  if (!relation?.id) return null;

  return {
    id: String(relation.id),
    label: String(relation.label ?? ""),
    referenceCode: String(relation.reference_code ?? ""),
    designation: String(relation.designation ?? relation.label ?? ""),
    includeInDesignation: Boolean(relation.include_in_designation ?? true),
    parentWordIds,
  };
}

export async function getGeneratorFamilies(): Promise<GeneratorFamily[]> {
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
        .select("id, tree_version_id, level_order, label_override, skus_field_types(code, name)")
        .in("tree_version_id", treeVersionIds)
        .order("level_order", { ascending: true })
    : { data: [] as Array<Record<string, unknown>> };

  const levels = (levelsResult.data ?? []) as LevelRow[];
  const levelIds = levels.map((level) => level.id);

  const levelWordsResult = levelIds.length
    ? await supabase
        .from("skus_family_tree_level_words")
        .select("tree_level_id, skus_words(id, label, reference_code, designation, include_in_designation)")
        .in("tree_level_id", levelIds)
        .order("sort_order", { ascending: true })
    : { data: [] as Array<Record<string, unknown>> };

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

  const parentWordIdsByWord = new Map<string, string[]>();
  for (const row of (wordDependenciesResult.data ?? []) as WordDependencyRow[]) {
    const items = parentWordIdsByWord.get(row.child_word_id) ?? [];
    items.push(row.parent_word_id);
    parentWordIdsByWord.set(row.child_word_id, items);
  }

  const wordsByLevelId = new Map<string, GeneratorWord[]>();
  for (const row of (levelWordsResult.data ?? []) as LevelWordRow[]) {
    const relation = Array.isArray(row.skus_words) ? row.skus_words[0] : row.skus_words;
    const parentWordIds = relation?.id ? parentWordIdsByWord.get(String(relation.id)) ?? [] : [];
    const word = getWordRelation(row, parentWordIds);
    if (!word) continue;

    const items = wordsByLevelId.get(row.tree_level_id) ?? [];
    items.push(word);
    wordsByLevelId.set(row.tree_level_id, items);
  }

  const levelsByTreeVersion = new Map<string, GeneratorLevel[]>();
  for (const level of levels) {
    const fieldType = getFieldTypeRelation(level.skus_field_types, "custom", "Campo");
    const items = levelsByTreeVersion.get(level.tree_version_id) ?? [];
    items.push({
      id: level.id,
      order: level.level_order,
      fieldType: fieldType.code,
      label: level.label_override || fieldType.name,
      options: wordsByLevelId.get(level.id) ?? [],
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
