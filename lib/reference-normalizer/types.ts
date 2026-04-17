export type NormalizerLanguage = "pt" | "es" | "en";

export type NormalizerCategory = "brand" | "format" | "product" | "size" | "packaging" | "extra";

export type NormalizerStatus = "OK" | "REVIEW" | "ERROR" | "MANUAL";

export type RuleStage = "preprocess" | "detect" | "reference" | "designation" | "validation";

export type RuleMatchType = "exact" | "contains" | "startsWith" | "endsWith" | "regex";

export type RuleMatchLogic = "and" | "or";

export type RuleField =
  | "oldReference"
  | "oldDesignation"
  | "normalizedDesignation"
  | "detectedBrand"
  | "detectedFormat"
  | "detectedProduct"
  | "detectedSize"
  | "detectedPackaging"
  | "detectedExtra"
  | "builtReference"
  | "designationPt"
  | "designationEs"
  | "designationEn";

export type RuleActionType =
  | "setCanonicalSegment"
  | "setLabelTranslations"
  | "hideLabelInDesignation"
  | "replaceTextInDesignation"
  | "addValidationWarning"
  | "forceStatusReview"
  | "preserveReferenceToken"
  | "extractRemainderAfterBrandOrFallback";

export interface CatalogEntry {
  id: string;
  category: NormalizerCategory;
  canonicalValue: string;
  code: string;
  usable: boolean;
  enabled: boolean;
  labels: Record<NormalizerLanguage, string>;
  detectionAliases: string[];
  notes?: string;
  metadata?: Record<string, unknown>;
  sortOrder: number;
}

export interface NormalizerRuleCondition {
  field: RuleField;
  matchType: RuleMatchType;
  value: string;
}

export interface NormalizerRuleAction {
  type: RuleActionType;
  category?: NormalizerCategory;
  entryId?: string;
  labels?: Partial<Record<NormalizerLanguage, string>>;
  language?: NormalizerLanguage | "all";
  pattern?: string;
  replacement?: string;
  regex?: boolean;
  message?: string;
  token?: string;
  fallbackLabels?: Partial<Record<NormalizerLanguage, string>>;
}

export interface NormalizerRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  priority: number;
  stage: RuleStage;
  matchType: RuleMatchType;
  matchLogic: RuleMatchLogic;
  conditions: NormalizerRuleCondition[];
  actions: NormalizerRuleAction[];
  notes?: string;
  source: "system" | "user";
}

export interface NormalizerSettings {
  charLimitPt: number;
  charLimitEs: number;
  charLimitEn: number;
}

export interface ColumnDetectionResult {
  referenceColumn: string | null;
  designationColumn: string | null;
  scoreByColumn: Record<string, number>;
}

export interface WorkbookSheetData {
  sheetName: string;
  columns: string[];
  rows: Record<string, unknown>[];
}

export interface NormalizerConfig {
  catalog: CatalogEntry[];
  rules: NormalizerRule[];
  settings: NormalizerSettings;
}

export interface SegmentSelection {
  brand: CatalogEntry | null;
  format: CatalogEntry | null;
  product: CatalogEntry | null;
  size: CatalogEntry | null;
  packaging: CatalogEntry | null;
  extra: CatalogEntry | null;
}

export interface SegmentOverrides {
  labels: Partial<Record<NormalizerCategory, Partial<Record<NormalizerLanguage, string>>>>;
  hiddenCategories: Set<NormalizerCategory>;
  preservedReferenceTokens: Set<string>;
}

export interface RowTrace {
  parsedReferenceSegments: Partial<Record<NormalizerCategory, string>>;
  descriptionMatches: Partial<Record<NormalizerCategory, string>>;
  triggeredRules: string[];
  warnings: string[];
  internalNotes: string[];
}

export interface RowProcessInput {
  rowNumber: number;
  originalRow: Record<string, unknown>;
  oldReference: string;
  oldDesignation: string;
  keepExtraColumns: boolean;
}

export interface RowProcessResult {
  rowNumber: number;
  originalRow: Record<string, unknown>;
  oldReference: string;
  oldDesignation: string;
  newReference: string;
  designationPt: string;
  designationEs: string;
  designationEn: string;
  charactersPt: number;
  charactersEs: number;
  charactersEn: number;
  status: NormalizerStatus;
  observations: string[];
  manualEdited?: boolean;
  segments: SegmentSelection;
  trace: RowTrace;
}

export interface RuleRuntimeContext {
  input: RowProcessInput;
  segments: SegmentSelection;
  overrides: SegmentOverrides;
  trace: RowTrace;
  designationDraft: Record<NormalizerLanguage, string>;
  builtReference: string;
  reviewForced: boolean;
}

export interface WorkbookProcessingResult {
  rows: RowProcessResult[];
  summary: Record<NormalizerStatus, number> & { total: number };
}
