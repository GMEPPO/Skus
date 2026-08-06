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

export type NormalizationStatus = "pending" | "completed" | "cancelled";

export interface NormalizationImportBatchSummary {
  id: string;
  fileName: string;
  status: string;
  totalRows: number;
  pendingRows: number;
  completedRows: number;
  invalidRows: number;
  createdAt: string;
}

export interface NormalizationQueueItem {
  id: string;
  importBatchId: string;
  batchFileName: string;
  sourceRowNumber: number;
  legacyCode: string | null;
  legacyDesignation: string | null;
  sourceNewCode: string | null;
  sourceDesignationPt: string | null;
  normalizationStatus: NormalizationStatus;
  categoryId: string | null;
  importIssue: string | null;
  lockedBy: string | null;
  lockedAt: string | null;
  lockExpiresAt: string | null;
  finalNewCode: string | null;
  completedAt: string | null;
}

export interface NormalizationRecord extends NormalizationQueueItem {
  sourceDesignationEs: string | null;
  sourceDesignationEn: string | null;
  sourceStatus: string | null;
  sourceObservations: string | null;
  generationId: string | null;
  finalDesignationPt: string | null;
  finalDesignationEs: string | null;
  finalDesignationEn: string | null;
}
