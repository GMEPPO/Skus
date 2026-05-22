import { createSupabaseServiceServerClient } from "@/lib/supabase-service-server";
import type {
  AppUser,
  DashboardSummary,
  GeneratorCatalog,
  GeneratorWord,
  RecentSkuGeneration,
  WordListItem,
} from "@/lib/types";

type SupabaseRoleRelation = { code?: string | null } | Array<{ code?: string | null }> | null;
type SupabaseProfileRelation = { name?: string | null } | Array<{ name?: string | null }> | null;

type SupabaseProfileListRow = {
  id: string;
  name: string | null;
  email: string | null;
  department: string | null;
  is_active: boolean | null;
  skus_roles?: SupabaseRoleRelation;
};

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
  skus_profiles?: SupabaseProfileRelation;
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
  { id: "w-alg", label: "ALG OCEAN SPA", referenceCode: "ALG", fieldTypeId: "ft-brand", fieldTypeLabel: "Familia/Marca", designation: "ALG OCEAN SPA", designationPt: "ALG OCEAN SPA", designationEs: "ALG Ocean Spa", designationEn: "ALG Ocean Spa", includeInDesignation: true },
  { id: "w-sol", label: "Solido", referenceCode: "SOL", fieldTypeId: "ft-format", fieldTypeLabel: "Formato", designation: "Solido", designationPt: "Solido", designationEs: "Solido", designationEn: "Solid", includeInDesignation: false },
  { id: "w-sab", label: "Sabonete", referenceCode: "SAB", fieldTypeId: "ft-product", fieldTypeLabel: "Produto", designation: "Sabonete", designationPt: "Sabonete", designationEs: "Jabon", designationEn: "Soap", includeInDesignation: true },
  { id: "w-020", label: "20g", referenceCode: "020", fieldTypeId: "ft-size", fieldTypeLabel: "Tamanho/Gramaje", designation: "20g", designationPt: "20g", designationEs: "20g", designationEn: "20g", includeInDesignation: true },
  { id: "w-cxa", label: "Caixa Cartao", referenceCode: "CXA", fieldTypeId: "ft-packaging", fieldTypeLabel: "Embalagem", designation: "Caixa Cartao", designationPt: "Caixa Cartao", designationEs: "Caja Carton", designationEn: "Card Box", includeInDesignation: true },
];

function toGeneratorWord(word: WordListItem): GeneratorWord {
  return {
    id: word.id,
    label: word.label,
    referenceCode: word.referenceCode,
    designation: word.designation,
    designationPt: word.designationPt,
    designationEs: word.designationEs,
    designationEn: word.designationEn,
    includeInDesignation: word.includeInDesignation,
  };
}

const generatorCatalog: GeneratorCatalog = {
  levels: [
    { id: "ft-brand", order: 1, fieldType: "brand", label: "Familia/Marca", options: words.filter((word) => word.fieldTypeId === "ft-brand").map(toGeneratorWord) },
    { id: "ft-format", order: 2, fieldType: "format", label: "Formato", options: words.filter((word) => word.fieldTypeId === "ft-format").map(toGeneratorWord) },
    { id: "ft-product", order: 3, fieldType: "product", label: "Produto", options: words.filter((word) => word.fieldTypeId === "ft-product").map(toGeneratorWord) },
    { id: "ft-size", order: 4, fieldType: "size", label: "Tamanho/Gramaje", options: words.filter((word) => word.fieldTypeId === "ft-size").map(toGeneratorWord) },
    { id: "ft-packaging", order: 5, fieldType: "packaging", label: "Embalagem", options: words.filter((word) => word.fieldTypeId === "ft-packaging").map(toGeneratorWord) },
    { id: "ft-extra", order: 6, fieldType: "extra", label: "Extra", options: [] },
  ],
};

const recentSkuGenerations: RecentSkuGeneration[] = [
  { id: "sku-1", generatedCode: "ALG-SOL-SAB-020-CXA-000", designation: "ALG OCEAN SPA Sabonete 20g Caixa Cartao", createdAtLabel: "ha 12 min", unitsPerBox: 24, unitsPerBoxStatus: "real", multiples: 6, multiplesStatus: "real", weight: 12.5, weightStatus: "estimated" },
];

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const supabase = createSupabaseServiceServerClient();
  if (supabase) {
    const [brandsResult, wordsResult, skusResult, usersResult] = await Promise.all([
      supabase
        .from("skus_words")
        .select("id, skus_field_types!inner(code)", { count: "exact", head: true })
        .eq("is_active", true)
        .eq("skus_field_types.code", "brand"),
      supabase.from("skus_words").select("id", { count: "exact", head: true }).eq("is_active", true),
      supabase.from("skus_sku_generations").select("id", { count: "exact", head: true }),
      supabase.from("skus_profiles").select("id", { count: "exact", head: true }).eq("is_active", true),
    ]);

    return {
      activeBrands: brandsResult.count ?? 0,
      words: wordsResult.count ?? 0,
      generatedSkus: skusResult.count ?? 0,
      activeUsers: usersResult.count ?? 0,
    };
  }

  return {
    activeBrands: words.filter((word) => word.fieldTypeId === "ft-brand").length,
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

export async function getFamilies(): Promise<
  Array<{
    id: string;
    name: string;
    description: string;
    status: "draft" | "active" | "archived";
  }>
> {
  return [];
}

export async function getGeneratorCatalog(): Promise<GeneratorCatalog> {
  return generatorCatalog;
}

export async function getRecentSkuGenerations(): Promise<RecentSkuGeneration[]> {
  const supabase = createSupabaseServiceServerClient();
  if (supabase) {
    const result = await supabase
      .from("skus_sku_generations")
      .select("id, generated_code, designation, product_image_url, created_at, units_per_box, units_per_box_status, multiples, multiples_status, weight, weight_status, skus_profiles(name)")
      .order("created_at", { ascending: false })
      .limit(10);

    return ((result.data ?? []) as SupabaseSkuHistoryRow[]).map((row) => {
      const profileRelation = Array.isArray(row.skus_profiles) ? row.skus_profiles[0] : row.skus_profiles;
      return {
        id: String(row.id),
        generatedCode: String(row.generated_code ?? ""),
        designation: String(row.designation ?? ""),
        productImageUrl: row.product_image_url ?? undefined,
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
