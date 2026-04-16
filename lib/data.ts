import type {
  AppUser,
  DashboardSummary,
  FamilyListItem,
  GeneratorFamily,
  GeneratorWord,
  RecentSkuGeneration,
  WordListItem,
} from "@/lib/types";

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
    includeInDesignation: item.includeInDesignation,
    parentWordIds: item.parentWordIds,
  };
}

const generatorFamilies: GeneratorFamily[] = [
  {
    id: "family-guerla",
    name: "Guerla",
    description: "Familia com 5 passos fixos e dependencias entre niveis.",
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
    description: "Fluxo alternativo com menos combinacoes validas.",
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
  { id: "sku-1", generatedCode: "GUE-FRA-SHA-300-CAI-000124", designation: "Guerla Frasco Shampoo 300ml Caixa", familyName: "Guerla", createdAtLabel: "ha 12 min" },
  { id: "sku-2", generatedCode: "GUE-BIS-SHA-500-KIT-000125", designation: "Guerla Bisnaga Shampoo 500ml Kit", familyName: "Guerla", createdAtLabel: "ha 32 min" },
  { id: "sku-3", generatedCode: "SAV-FRA-GEL-500-CAI-000126", designation: "Savoy Frasco Gel 500ml Caixa", familyName: "Savoy", createdAtLabel: "ha 1 h" },
];

export async function getDashboardSummary(): Promise<DashboardSummary> {
  return {
    activeFamilies: families.filter((family) => family.status === "active").length,
    words: words.length,
    generatedSkus: recentSkuGenerations.length,
    activeUsers: users.filter((user) => user.isActive).length,
  };
}

export async function getUsers(): Promise<AppUser[]> {
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
  return recentSkuGenerations;
}
