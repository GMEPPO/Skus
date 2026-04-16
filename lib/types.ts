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
  activeFamilies: number;
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
  includeInDesignation: boolean;
  familyIds: string[];
  familyLabels: string[];
}

export interface FamilyListItem {
  id: string;
  name: string;
  description: string;
  status: "draft" | "active" | "archived";
  levelLabels: string[];
}

export interface GeneratorWord {
  id: string;
  label: string;
  referenceCode: string;
  designation: string;
  includeInDesignation: boolean;
}

export interface GeneratorLevel {
  id: string;
  order: number;
  fieldType: string;
  label: string;
  options: GeneratorWord[];
}

export interface GeneratorEdge {
  fromLevelId: string;
  fromWordId: string;
  toLevelId: string;
  toWordId: string;
}

export interface GeneratorFamily {
  id: string;
  name: string;
  description: string;
  levels: GeneratorLevel[];
  edges: GeneratorEdge[];
}

export interface RecentSkuGeneration {
  id: string;
  generatedCode: string;
  designation: string;
  familyName: string;
  createdAtLabel: string;
}
