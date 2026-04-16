import type {
  AppUser,
  DashboardSummary,
  FamilyListItem,
  GeneratorFamily,
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
  {
    id: "user-2",
    name: "Claudia Lopes",
    email: "claudia@groupegm.local",
    role: "manager",
    department: "Sales",
    isActive: true,
  },
  {
    id: "user-3",
    name: "Daniel Costa",
    email: "daniel@groupegm.local",
    role: "editor",
    department: "Product",
    isActive: true,
  },
  {
    id: "user-4",
    name: "Marta Silva",
    email: "marta@groupegm.local",
    role: "viewer",
    department: "Backoffice",
    isActive: false,
  },
];

const words: WordListItem[] = [
  {
    id: "w-gue",
    label: "Guerla",
    referenceCode: "GUE",
    fieldTypeLabel: "Família",
    contextLabel: "Marca",
    description: "Linha de amenities Guerla.",
  },
  {
    id: "w-sav",
    label: "Savoy",
    referenceCode: "SAV",
    fieldTypeLabel: "Família",
    contextLabel: "Grupo hoteleiro",
    description: "Família dedicada ao grupo Savoy.",
  },
  {
    id: "w-fra",
    label: "Frasco",
    referenceCode: "FRA",
    fieldTypeLabel: "Formato",
    contextLabel: "Embalagem primária",
    description: "Formato em frasco.",
  },
  {
    id: "w-bis",
    label: "Bisnaga",
    referenceCode: "BIS",
    fieldTypeLabel: "Formato",
    contextLabel: "Embalagem primária",
    description: "Formato em bisnaga.",
  },
  {
    id: "w-sha",
    label: "Shampoo",
    referenceCode: "SHA",
    fieldTypeLabel: "Produto",
    contextLabel: "Produto base",
    description: "Produto shampoo.",
  },
  {
    id: "w-gel",
    label: "Gel",
    referenceCode: "GEL",
    fieldTypeLabel: "Produto",
    contextLabel: "Produto base",
    description: "Gel de banho.",
  },
  {
    id: "w-300",
    label: "300ml",
    referenceCode: "300",
    fieldTypeLabel: "Tamanho",
    contextLabel: "Capacidade",
    description: "Capacidade 300ml.",
  },
  {
    id: "w-500",
    label: "500ml",
    referenceCode: "500",
    fieldTypeLabel: "Tamanho",
    contextLabel: "Capacidade",
    description: "Capacidade 500ml.",
  },
  {
    id: "w-cai",
    label: "Caixa",
    referenceCode: "CAI",
    fieldTypeLabel: "Embalagem",
    contextLabel: "Embalagem secundária",
    description: "Acondicionamento em caixa.",
  },
  {
    id: "w-kit",
    label: "Kit",
    referenceCode: "KIT",
    fieldTypeLabel: "Dados extra",
    contextLabel: "Composição",
    description: "Produto comercializado em kit.",
  },
];

const generatorFamilies: GeneratorFamily[] = [
  {
    id: "family-guerla",
    name: "Guerla",
    description: "Família com formato dependente e composição até embalagem.",
    levels: [
      {
        id: "level-format",
        order: 1,
        fieldType: "format",
        label: "Formato",
        options: [findWord("w-fra"), findWord("w-bis")],
      },
      {
        id: "level-product",
        order: 2,
        fieldType: "product",
        label: "Produto",
        options: [findWord("w-sha"), findWord("w-gel")],
      },
      {
        id: "level-size",
        order: 3,
        fieldType: "size",
        label: "Tamanho / formato",
        options: [findWord("w-300"), findWord("w-500")],
      },
      {
        id: "level-packaging",
        order: 4,
        fieldType: "packaging",
        label: "Tipo de embalagem",
        options: [findWord("w-cai"), findWord("w-kit")],
      },
    ],
    edges: [
      edge("level-format", "w-fra", "level-product", "w-sha"),
      edge("level-format", "w-fra", "level-product", "w-gel"),
      edge("level-format", "w-bis", "level-product", "w-sha"),
      edge("level-product", "w-sha", "level-size", "w-300"),
      edge("level-product", "w-sha", "level-size", "w-500"),
      edge("level-product", "w-gel", "level-size", "w-300"),
      edge("level-size", "w-300", "level-packaging", "w-cai"),
      edge("level-size", "w-500", "level-packaging", "w-kit"),
    ],
  },
  {
    id: "family-savoy",
    name: "Savoy",
    description: "Fluxo alternativo com menos combinações válidas.",
    levels: [
      {
        id: "sav-format",
        order: 1,
        fieldType: "format",
        label: "Formato",
        options: [findWord("w-fra")],
      },
      {
        id: "sav-product",
        order: 2,
        fieldType: "product",
        label: "Produto",
        options: [findWord("w-gel")],
      },
      {
        id: "sav-size",
        order: 3,
        fieldType: "size",
        label: "Tamanho / formato",
        options: [findWord("w-500")],
      },
      {
        id: "sav-packaging",
        order: 4,
        fieldType: "packaging",
        label: "Tipo de embalagem",
        options: [findWord("w-cai")],
      },
    ],
    edges: [
      edge("sav-format", "w-fra", "sav-product", "w-gel"),
      edge("sav-product", "w-gel", "sav-size", "w-500"),
      edge("sav-size", "w-500", "sav-packaging", "w-cai"),
    ],
  },
];

const families: FamilyListItem[] = [
  {
    id: "family-guerla",
    name: "Guerla",
    description: "Árvore publicada para amenities standard.",
    status: "active",
    levelLabels: ["Família", "Formato", "Produto", "Tamanho", "Embalagem"],
  },
  {
    id: "family-savoy",
    name: "Savoy",
    description: "Composição simplificada para catálogo dedicado.",
    status: "active",
    levelLabels: ["Família", "Formato", "Produto", "Tamanho"],
  },
];

const recentSkuGenerations: RecentSkuGeneration[] = [
  {
    id: "sku-1",
    generatedCode: "GUE-FRA-SHA-300-CAI-000124",
    designation: "Guerla Frasco Shampoo 300ml Caixa",
    familyName: "Guerla",
    createdAtLabel: "há 12 min",
  },
  {
    id: "sku-2",
    generatedCode: "GUE-BIS-SHA-500-KIT-000125",
    designation: "Guerla Bisnaga Shampoo 500ml Kit",
    familyName: "Guerla",
    createdAtLabel: "há 32 min",
  },
  {
    id: "sku-3",
    generatedCode: "SAV-FRA-GEL-500-CAI-000126",
    designation: "Savoy Frasco Gel 500ml Caixa",
    familyName: "Savoy",
    createdAtLabel: "há 1 h",
  },
];

function findWord(id: string) {
  const item = words.find((word) => word.id === id);
  if (!item) throw new Error(`Word not found: ${id}`);

  return {
    id: item.id,
    label: item.label,
    referenceCode: item.referenceCode,
  };
}

function edge(fromLevelId: string, fromWordId: string, toLevelId: string, toWordId: string) {
  return { fromLevelId, fromWordId, toLevelId, toWordId };
}

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
