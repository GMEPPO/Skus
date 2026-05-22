export type UserRole = "viewer" | "editor" | "manager" | "admin";

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  department: string;
  isActive: boolean;
}

export interface DashboardSummary {
  activeBrands: number;
  words: number;
  generatedSkus: number;
  activeUsers: number;
}

export interface WordListItem {
  id: string;
  label: string;
  referenceCode: string;
  fieldTypeId: string;
  fieldTypeLabel: string;
  designation: string;
  designationPt: string;
  designationEs: string;
  designationEn: string;
  includeInDesignation: boolean;
  familyIds: string[];
  familyLabels: string[];
  parentWordIds: string[];
  parentWordLabels: string[];
}

export interface GeneratorWord {
  id: string;
  label: string;
  referenceCode: string;
  designation: string;
  designationPt: string;
  designationEs: string;
  designationEn: string;
  includeInDesignation: boolean;
}

export interface GeneratorLevel {
  id: string;
  order: number;
  fieldType: string;
  label: string;
  options: GeneratorWord[];
}

export interface GeneratorCatalog {
  levels: GeneratorLevel[];
}

export interface RecentSkuGeneration {
  id: string;
  generatedCode: string;
  designation: string;
  productImageUrl?: string;
  createdByName?: string;
  createdAtLabel: string;
  unitsPerBox?: number;
  unitsPerBoxStatus?: "real" | "estimated";
  multiples?: number;
  multiplesStatus?: "real" | "estimated";
  weight?: number;
  weightStatus?: "real" | "estimated";
}
