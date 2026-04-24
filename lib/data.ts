import { createSupabaseServiceServerClient } from "@/lib/supabase-service-server";
import type {
  AppUser,
  DashboardSummary,
  FamilyListItem,
  GeneratorFamily,
  GeneratorWord,
  RecentSkuGeneration,
  WordListItem,
} from "@/lib/types";

type SupabaseRoleRelation = { code?: string | null } | Array<{ code?: string | null }> | null;
type SupabaseProfileListRow = {
  id: string;
  name: string | null;
  email: string | null;
  department: string | null;
  is_active: boolean | null;
  skus_roles?: SupabaseRoleRelation;
};

type SupabaseSkuHistoryRelation = { name?: string | null } | Array<{ name?: string | null }> | null;
type SupabaseSkuHistoryRow = {
  id: string;
  generated_code: string | null;
  designation: string | null;
  product_image_url: string | null;
  created_at: string | null;
  units_per_box: number | string | null;
  units_per_box_status: "real" | "estimated" | null;
  multiples: number | string | null;
  multiples_status: "real" | "estimated" | null;
  weight: number | string | null;
  weight_status: "real" | "estimated" | null;
  skus_families?: SupabaseSkuHistoryRelation;
  skus_profiles?: SupabaseSkuHistoryRelation;
};

export const demoCurrentUser: AppUser = {
  id: "user-admin",
  name: "Miguel Vieira",
  email: "miguel@groupegm.local",
  role: "admin",
  department: "Operations",
  isActive: true,
};

const users: AppUser[] = [
  demoCurrentUser,
  { id: "user-2", name: "Claudia Lopes", email: "claudia@groupegm.local", role: "manager", department: "Sales", isActive: true },
  { id: "user-3", name: "Daniel Costa", email: "daniel@groupegm.local", role: "editor", department: "Product", isActive: true },
  { id: "user-4", name: "Marta Silva", email: "marta@groupegm.local", role: "viewer", department: "Backoffice", isActive: false },
];

const words: WordListItem[] = [
  { id: "w-gue", label: "Guerla", referenceCode: "GUE", fieldTypeId: "ft-family", fieldTypeLabel: "Familia", designation: "Guerla", designationPt: "Guerla", designationEs: "Guerla", designationEn: "Guerla", includeInDesignation: true, familyIds: ["family-guerla"], familyLabels: ["Guerla"], parentWordIds: [], parentWordLabels: [] },
  { id: "w-sav", label: "Savoy", referenceCode: "SAV", fieldTypeId: "ft-family", fieldTypeLabel: "Familia", designation: "Savoy", designationPt: "Savoy", designationEs: "Savoy", designationEn: "Savoy", includeInDesignation: true, familyIds: ["family-savoy"], familyLabels: ["Savoy"], parentWordIds: [], parentWordLabels: [] },
  { id: "w-fra", label: "Frasco", referenceCode: "FRA", fieldTypeId: "ft-format", fieldTypeLabel: "Formato", designation: "Frasco", designationPt: "Frasco", designationEs: "Frasco", designationEn: "Bottle", includeInDesignation: true, familyIds: ["family-guerla", "family-savoy"], familyLabels: ["Guerla", "Savoy"], parentWordIds: [], parentWordLabels: [] },
  { id: "w-bis", label: "Bisnaga", referenceCode: "BIS", fieldTypeId: "ft-format", fieldTypeLabel: "Formato", designation: "Bisnaga", designationPt: "Bisnaga", designationEs: "Tubo", designationEn: "Tube", includeInDesignation: true, familyIds: ["family-guerla"], familyLabels: ["Guerla"], parentWordIds: [], parentWordLabels: [] },
  { id: "w-sha", label: "Shampoo", referenceCode: "SHA", fieldTypeId: "ft-product", fieldTypeLabel: "Produto", designation: "Shampoo", designationPt: "Shampoo", designationEs: "Champu", designationEn: "Shampoo", includeInDesignation: true, familyIds: ["family-guerla"], familyLabels: ["Guerla"], parentWordIds: ["w-fra", "w-bis"], parentWordLabels: ["Frasco - FRA", "Bisnaga - BIS"] },
  { id: "w-gel", label: "Gel", referenceCode: "GEL", fieldTypeId: "ft-product", fieldTypeLabel: "Produto", designation: "Gel", designationPt: "Gel", designationEs: "Gel", designationEn: "Gel", includeInDesignation: true, familyIds: ["family-guerla", "family-savoy"], familyLabels: ["Guerla", "Savoy"], parentWordIds: ["w-fra"], parentWordLabels: ["Frasco - FRA"] },
  { id: "w-300", label: "300ml", referenceCode: "300", fieldTypeId: "ft-size", fieldTypeLabel: "Tamanho", designation: "300ml", designationPt: "300ml", designationEs: "300ml", designationEn: "300ml", includeInDesignation: true, familyIds: ["family-guerla"], familyLabels: ["Guerla"], parentWordIds: ["w-sha", "w-gel"], parentWordLabels: ["Shampoo - SHA", "Gel - GEL"] },
  { id: "w-500", label: "500ml", referenceCode: "500", fieldTypeId: "ft-size", fieldTypeLabel: "Tamanho", designation: "500ml", designationPt: "500ml", designationEs: "500ml", designationEn: "500ml", includeInDesignation: true, familyIds: ["family-guerla", "family-savoy"], familyLabels: ["Guerla", "Savoy"], parentWordIds: ["w-sha", "w-gel"], parentWordLabels: ["Shampoo - SHA", "Gel - GEL"] },
  { id: "w-cai", label: "Caixa", referenceCode: "CAI", fieldTypeId: "ft-packaging", fieldTypeLabel: "Embalagem", designation: "Caixa", designationPt: "Caixa", designationEs: "Caja", designationEn: "Box", includeInDesignation: true, familyIds: ["family-guerla", "family-savoy"], familyLabels: ["Guerla", "Savoy"], parentWordIds: ["w-300", "w-500"], parentWordLabels: ["300ml - 300", "500ml - 500"] },
  { id: "w-kit", label: "Kit", referenceCode: "KIT", fieldTypeId: "ft-extra", fieldTypeLabel: "Dados extra", designation: "Kit", designationPt: "Kit", designationEs: "Kit", designationEn: "Kit", includeInDesignation: false, familyIds: ["family-guerla"], familyLabels: ["Guerla"], parentWordIds: ["w-cai"], parentWordLabels: ["Caixa - CAI"] },
];

function findWord(id: string): GeneratorWord {
  const item = words.find((word) => word.id === id);
  if (!item) throw new Error(`Word not found: ${id}`);

  return {
    id: item.id,
    label: item.label,
    referenceCode: item.referenceCode,
    designation: item.designation,
    designationPt: item.designationPt,
    designationEs: item.designationEs,
    designationEn: item.designationEn,
    includeInDesignation: item.includeInDesignation,
    parentWordIds: item.parentWordIds,
  };
}

const generatorFamilies: GeneratorFamily[] = [
  {
    id: "family-guerla",
    name: "Guerla",
    namePt: "Guerla",
    nameEs: "Guerla",
    nameEn: "Guerla",
    description: "Familia com 5 passos fixos e dependencias entre niveis.",
    treeVersionId: "tree-guerla",
    levels: [
      { id: "level-format", order: 1, fieldType: "format", label: "Formato", options: [findWord("w-fra"), findWord("w-bis")] },
      { id: "level-product", order: 2, fieldType: "product", label: "Produto", options: [findWord("w-sha"), findWord("w-gel")] },
      { id: "level-size", order: 3, fieldType: "size", label: "Tamanho", options: [findWord("w-300"), findWord("w-500")] },
      { id: "level-packaging", order: 4, fieldType: "packaging", label: "Embalagem", options: [findWord("w-cai")] },
      { id: "level-extra", order: 5, fieldType: "extra", label: "Extra", options: [findWord("w-kit")] },
    ],
    edges: [],
  },
  {
    id: "family-savoy",
    name: "Savoy",
    namePt: "Savoy",
    nameEs: "Savoy",
    nameEn: "Savoy",
    description: "Fluxo alternativo com menos combinacoes validas.",
    treeVersionId: "tree-savoy",
    levels: [
      { id: "sav-format", order: 1, fieldType: "format", label: "Formato", options: [findWord("w-fra")] },
      { id: "sav-product", order: 2, fieldType: "product", label: "Produto", options: [findWord("w-gel")] },
      { id: "sav-size", order: 3, fieldType: "size", label: "Tamanho", options: [findWord("w-500")] },
      { id: "sav-packaging", order: 4, fieldType: "packaging", label: "Embalagem", options: [findWord("w-cai")] },
      { id: "sav-extra", order: 5, fieldType: "extra", label: "Extra", options: [] },
    ],
    edges: [],
  },
];

const families: FamilyListItem[] = [
  { id: "family-guerla", name: "Guerla", namePt: "Guerla", nameEs: "Guerla", nameEn: "Guerla", description: "Arvore publicada para amenities standard.", status: "active", levelLabels: ["Formato", "Produto", "Tamanho", "Embalagem", "Extra"] },
  { id: "family-savoy", name: "Savoy", namePt: "Savoy", nameEs: "Savoy", nameEn: "Savoy", description: "Composicao simplificada para catalogo dedicado.", status: "active", levelLabels: ["Formato", "Produto", "Tamanho", "Embalagem", "Extra"] },
];

const recentSkuGenerations: RecentSkuGeneration[] = [
  { id: "sku-1", generatedCode: "GUE-FRA-SHA-300-CAI", designation: "Guerla Frasco Shampoo 300ml Caixa", familyName: "Guerla", createdAtLabel: "ha 12 min", unitsPerBox: 24, unitsPerBoxStatus: "real", multiples: 6, multiplesStatus: "real", weight: 12.5, weightStatus: "estimated" },
  { id: "sku-2", generatedCode: "GUE-BIS-SHA-500-KIT", designation: "Guerla Bisnaga Shampoo 500ml Kit", familyName: "Guerla", createdAtLabel: "ha 32 min", unitsPerBox: 12, unitsPerBoxStatus: "estimated", multiples: 3, multiplesStatus: "estimated", weight: 8.2, weightStatus: "estimated" },
  { id: "sku-3", generatedCode: "SAV-FRA-GEL-500-CAI", designation: "Savoy Frasco Gel 500ml Caixa", familyName: "Savoy", createdAtLabel: "ha 1 h", unitsPerBox: 20, unitsPerBoxStatus: "real", multiples: 4, multiplesStatus: "real", weight: 10.1, weightStatus: "real" },
];

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const supabase = createSupabaseServiceServerClient();
  if (supabase) {
    const [familiesResult, wordsResult, skusResult, usersResult] = await Promise.all([
      supabase.from("skus_families").select("id", { count: "exact", head: true }).eq("status", "active"),
      supabase.from("skus_words").select("id", { count: "exact", head: true }).eq("is_active", true),
      supabase.from("skus_sku_generations").select("id", { count: "exact", head: true }),
      supabase.from("skus_profiles").select("id", { count: "exact", head: true }).eq("is_active", true),
    ]);

    return {
      activeFamilies: familiesResult.count ?? 0,
      words: wordsResult.count ?? 0,
      generatedSkus: skusResult.count ?? 0,
      activeUsers: usersResult.count ?? 0,
    };
  }

  return {
    activeFamilies: families.filter((family) => family.status === "active").length,
    words: words.length,
    generatedSkus: recentSkuGenerations.length,
    activeUsers: users.filter((user) => user.isActive).length,
  };
}

export async function getUsers(): Promise<AppUser[]> {
  const supabase = createSupabaseServiceServerClient();
  if (supabase) {
    const result = await supabase
      .from("skus_profiles")
      .select("id, name, email, department, is_active, skus_roles(code)")
      .order("name", { ascending: true });

    return ((result.data ?? []) as SupabaseProfileListRow[]).map((row) => {
      const roleRelation = Array.isArray(row.skus_roles) ? row.skus_roles[0] : row.skus_roles;
      return {
        id: String(row.id),
        name: String(row.name ?? ""),
        email: String(row.email ?? ""),
        department: String(row.department ?? "General"),
        isActive: Boolean(row.is_active ?? true),
        role: String(roleRelation?.code ?? "viewer") as AppUser["role"],
      };
    });
  }

  return users;
}

export async function getWords(): Promise<WordListItem[]> {
  return words;
}

export async function getFamilies(): Promise<FamilyListItem[]> {
  return families;
}

export async function getGeneratorFamilies(): Promise<GeneratorFamily[]> {
  return generatorFamilies;
}

export async function getRecentSkuGenerations(): Promise<RecentSkuGeneration[]> {
  const supabase = createSupabaseServiceServerClient();
  if (supabase) {
    const result = await supabase
      .from("skus_sku_generations")
      .select("id, generated_code, designation, product_image_url, created_at, units_per_box, units_per_box_status, multiples, multiples_status, weight, weight_status, skus_families(name), skus_profiles(name)")
      .order("created_at", { ascending: false })
      .limit(10);

    return ((result.data ?? []) as SupabaseSkuHistoryRow[]).map((row) => {
      const familyRelation = Array.isArray(row.skus_families) ? row.skus_families[0] : row.skus_families;
      const profileRelation = Array.isArray(row.skus_profiles) ? row.skus_profiles[0] : row.skus_profiles;
      return {
        id: String(row.id),
        generatedCode: String(row.generated_code ?? ""),
        designation: String(row.designation ?? ""),
        productImageUrl: row.product_image_url ?? undefined,
        familyName: String(familyRelation?.name ?? "Sem familia"),
        createdByName: String(profileRelation?.name ?? "Sem utilizador"),
        createdAtLabel: row.created_at ? new Date(String(row.created_at)).toLocaleString("es-ES") : "",
        unitsPerBox: Number(row.units_per_box ?? 0),
        unitsPerBoxStatus: (row.units_per_box_status as "real" | "estimated" | null) ?? undefined,
        multiples: Number(row.multiples ?? 0),
        multiplesStatus: (row.multiples_status as "real" | "estimated" | null) ?? undefined,
        weight: Number(row.weight ?? 0),
        weightStatus: (row.weight_status as "real" | "estimated" | null) ?? undefined,
      };
    });
  }

  return recentSkuGenerations;
}
