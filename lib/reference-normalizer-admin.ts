"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { buildDefaultCatalogEntries, buildDefaultNormalizerConfig, buildDefaultRules, DEFAULT_NORMALIZER_SETTINGS } from "@/lib/reference-normalizer/defaults";
import type { CatalogEntry, NormalizerConfig, NormalizerRule, NormalizerSettings } from "@/lib/reference-normalizer/types";
import { createSupabaseServiceServerClient } from "@/lib/supabase-service-server";
import { normalizeText, uniqueStrings } from "@/lib/reference-normalizer/normalization";

const labelsSchema = z.object({
  pt: z.string(),
  es: z.string(),
  en: z.string(),
});

const catalogEntrySchema = z.object({
  id: z.string(),
  category: z.enum(["brand", "format", "product", "size", "packaging", "extra"]),
  canonicalValue: z.string(),
  code: z.string(),
  usable: z.boolean(),
  enabled: z.boolean(),
  labels: labelsSchema,
  detectionAliases: z.array(z.string()),
  notes: z.string().optional(),
  metadata: z.record(z.any()).optional(),
  sortOrder: z.number().int(),
});

const ruleConditionSchema = z.object({
  field: z.string(),
  matchType: z.enum(["exact", "contains", "startsWith", "endsWith", "regex"]),
  value: z.string(),
});

const ruleActionSchema = z.object({
  type: z.string(),
  category: z.string().optional(),
  entryId: z.string().optional(),
  labels: labelsSchema.partial().optional(),
  language: z.enum(["pt", "es", "en", "all"]).optional(),
  pattern: z.string().optional(),
  replacement: z.string().optional(),
  regex: z.boolean().optional(),
  message: z.string().optional(),
  token: z.string().optional(),
  fallbackLabels: labelsSchema.partial().optional(),
});

const ruleSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  enabled: z.boolean(),
  priority: z.number().int(),
  stage: z.enum(["preprocess", "detect", "reference", "designation", "validation"]),
  matchType: z.enum(["exact", "contains", "startsWith", "endsWith", "regex"]),
  matchLogic: z.enum(["and", "or"]),
  conditions: z.array(ruleConditionSchema),
  actions: z.array(ruleActionSchema),
  notes: z.string().optional(),
  source: z.enum(["system", "user"]),
});

const settingsSchema = z.object({
  charLimitPt: z.number().int().min(1),
  charLimitEs: z.number().int().min(1),
  charLimitEn: z.number().int().min(1),
});

type DbCatalogRow = {
  id: string;
  category: CatalogEntry["category"];
  canonical_value: string;
  code: string;
  usable: boolean;
  enabled: boolean;
  labels_json: CatalogEntry["labels"];
  detection_aliases_json: string[];
  notes: string | null;
  metadata_json: Record<string, unknown> | null;
  sort_order: number;
};

type DbRuleRow = {
  id: string;
  name: string;
  description: string | null;
  enabled: boolean;
  priority: number;
  stage: NormalizerRule["stage"];
  match_type: NormalizerRule["matchType"];
  match_logic: NormalizerRule["matchLogic"];
  conditions_json: NormalizerRule["conditions"];
  actions_json: NormalizerRule["actions"];
  notes: string | null;
  source: NormalizerRule["source"];
};

type DbSettingsRow = {
  id: string;
  char_limit_pt: number;
  char_limit_es: number;
  char_limit_en: number;
};

type SkuFamilyRow = {
  id: string;
  name: string;
  name_pt: string | null;
  name_es: string | null;
  name_en: string | null;
  reference_code: string | null;
  status: string;
};

type FieldTypeRelation = { code?: string | null } | Array<{ code?: string | null }> | null;

type SkuWordRow = {
  id: string;
  label: string;
  reference_code: string | null;
  designation: string | null;
  designation_pt: string | null;
  designation_es: string | null;
  designation_en: string | null;
  is_active: boolean;
  skus_field_types?: FieldTypeRelation;
};

type SkuWordCategory = Exclude<CatalogEntry["category"], "brand">;

const SKU_WORD_CATEGORIES: SkuWordCategory[] = ["format", "product", "size", "packaging", "extra"];

function mapCatalogRow(row: DbCatalogRow): CatalogEntry {
  return {
    id: row.id,
    category: row.category,
    canonicalValue: row.canonical_value,
    code: row.code,
    usable: row.usable,
    enabled: row.enabled,
    labels: row.labels_json,
    detectionAliases: row.detection_aliases_json ?? [],
    notes: row.notes ?? undefined,
    metadata: row.metadata_json ?? {},
    sortOrder: row.sort_order,
  };
}

function mapRuleRow(row: DbRuleRow): NormalizerRule {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? "",
    enabled: row.enabled,
    priority: row.priority,
    stage: row.stage,
    matchType: row.match_type,
    matchLogic: row.match_logic,
    conditions: row.conditions_json ?? [],
    actions: row.actions_json ?? [],
    notes: row.notes ?? undefined,
    source: row.source,
  };
}

function mapSettingsRow(row: DbSettingsRow | null | undefined): NormalizerSettings {
  if (!row) return DEFAULT_NORMALIZER_SETTINGS;
  return {
    charLimitPt: row.char_limit_pt,
    charLimitEs: row.char_limit_es,
    charLimitEn: row.char_limit_en,
  };
}

function getFieldTypeCode(relation: FieldTypeRelation | undefined) {
  if (!relation) return null;
  if (Array.isArray(relation)) return relation[0]?.code ?? null;
  return relation.code ?? null;
}

function buildLabels(pt: string, es?: string | null, en?: string | null): CatalogEntry["labels"] {
  return {
    pt,
    es: es || pt,
    en: en || pt,
  };
}

function toCatalogCode(value: string | null | undefined) {
  return String(value ?? "").trim().toUpperCase();
}

function isSkuWordCategory(value: string | null): value is SkuWordCategory {
  return SKU_WORD_CATEGORIES.includes(value as SkuWordCategory);
}

function getLegacyAliases(category: CatalogEntry["category"], code: string, canonicalValue: string) {
  const key = `${normalizeText(category)}:${normalizeText(code)}:${normalizeText(canonicalValue)}`;
  const aliases: Record<string, string[]> = {
    "brand:acb:achb lavanda": ["ACH BRITO", "ARCH BRITO", "ACH BRITO LAVANDA", "ARCH BRITO LAVANDA"],
    "brand:alg:alg ocean spa": ["ALGOTHERM", "ALGOTHERM O SPA", "ALGOTHERM O. SPA", "ALGOTHERM OCEAN SPA", "OCEAN SPA"],
    "brand:ase:an semonin": ["ANNE SEMONIN", "AN SEMONIN"],
    "brand:ale:ben alecrim": ["BENAMOR ALECRIM", "BENAMOR - ALECRIM"],
    "brand:gor:ben gordissimo": ["GORDISSIMO", "BENAMOR GORDISSIMO"],
    "brand:cas:cas pink lily": ["CASTELBEL", "CASTELBEL PINK LILY", "PINK LILY"],
    "brand:lve:cas laranja ver": ["CASTELBEL LARANJA VERBENA", "LARANJA VERBENA", "LARANJA-VERBENA"],
    "brand:cbo:cdp bois olivie": ["COMPAGNIE DE PROVENCE BOIS D'OLIVIER", "CDP BOIS OLIVIER", "BOIS D OLIVIER"],
    "brand:cmb:cdp mint basil": ["COMPAGNIE DE PROVENCE MINT BASIL", "CDP MINT BASIL"],
    "brand:cmo:cereria black orc": ["CERERIA MOLLA BLACK ORCHID", "BLACK ORCHID"],
    "brand:cmr:cereria bulg rose": ["CERERIA MOLLA BULGARIAN ROSE", "BULGARIAN ROSE"],
    "brand:cqm:c mondes": ["CINQ MONDES"],
    "brand:fci:edpfm indelebil": ["FREDERIC MALLE INDELEBILE", "EDPFM INDELEBILE", "INDELEBILE"],
    "brand:frm:edpfm magnolia": ["FREDERIC MALLE MAGNOLIA", "EDPFM MAGNOLIA"],
    "brand:g&b:pc gold blue": ["GOLD&BLUE", "GOLD BLUE"],
    "brand:plf:pc plum flower": ["PLUM FLOWER"],
    "brand:rub:pc ruby red": ["RUBY RED"],
    "brand:swh:scand white": ["SCANDINAVIAN WHITE"],

    "format:bis:bisnaga": ["Bisnaga"],
    "format:eco:ecofill": ["ECOFILL"],
    "format:eco:garrafa ecofill": ["Garrafa ECOFILL", "Garrafa ECOFILL ALUMINIO", "Garrafa ECOFILL ALUM"],
    "format:eco:rec ecofill": ["Recarga ECOFILL", "Rec ECOFILL"],
    "format:ecp:ecopump": ["Ecopump", "Eco pump"],
    "format:fra:frasco": ["Frasco"],
    "format:rec:rec 5l": ["Recarga 5L", "Recarga 5l", "Rec 5L", "5L", "5LT"],
    "format:ecs:rec ecosource": ["Recarga Ecosource", "Rec Ecosource", "Ecosource"],
    "format:sol:solido": ["Solido", "Sólido"],
    "format:sti:stick": ["Stick"],
    "format:vel:vela": ["Vela"],

    "product:con:condicionador": ["Amaciador", "Condicionador", "Conditioner"],
    "product:bod:body lotion": ["Body Lotion", "Loção Corpo", "Locao Corpo", "Body"],
    "product:cha:champo": ["Champo", "Champô", "Shampoo"],
    "product:chc:champo/cond": ["Champo/Cond", "Champô/Cond", "Champo Condicionador", "Champô Condicionador", "2 em 1", "2in1"],
    "product:gbd:gel banho": ["Gel Banho", "Gel de Banho", "Shower Gel"],
    "product:gcc:gel corp cabelo": ["Gel Corpo Cabelo", "Gel Corpo e Cabelo", "Gel Corp Cabelo", "Hair Body Wash"],
    "product:gbd:gel maos corpo": ["Gel Mãos Corpo", "Gel Maos Corpo", "Gel Mãos e Corpo", "Gel Maos e Corpo"],
    "product:lmc:locao mao corpo": ["Loção Mão Corpo", "Locao Mao Corpo", "Loção Mãos Corpo", "Locao Maos Corpo", "Loção Mãos e Corpo", "Locao Maos e Corpo", "Loção de Mãos e Corpo", "Locao de Maos e Corpo"],
    "product:sab:sabonete": ["Sabonete", "Sabonete Solido", "Sabonete Sólido"],
    "product:sab:sab liquido": ["Sab Líquido", "Sab Liquido", "Sabonete Líquido", "Sabonete Liquido", "Liquid Soap"],
    "product:sai:sais de banho": ["Sais de Banho", "Sais banho"],
    "product:lma:locao mao": ["Loção Mão", "Locao Mao", "Loção de Mãos", "Locao de Maos"],

    "packaging:cxa:caixa": ["Caixa", "Cx Cartão", "Caixa de Cartão", "Cartao", "Cartão", "CAE"],
    "packaging:ppl:papel": ["Papel"],
    "packaging:sgc:sugar cane": ["Sugar Cane", "Cana de Açúcar", "Cana de Acucar"],
    "packaging:vaz:vaz": ["VAZ", "Vazia", "Vacio", "Vacia", "Empty"],
    "packaging:pou:bolsa": ["Bolsa", "Pouch"],
    "packaging:plr:plast. rec.": ["Plast. Rec.", "Plast Rec", "Plástico Reciclado", "Plastico Reciclado", "PLÁST. RECICLADO"],

    "extra:cls:classico": ["Classico", "Clássico", "Classic"],
    "extra:slm:slim": ["Slim"],
  };

  return aliases[key] ?? [];
}

async function buildSkuCatalogEntries(
  supabase: NonNullable<ReturnType<typeof createSupabaseServiceServerClient>>,
): Promise<CatalogEntry[]> {
  const [familiesResult, wordsResult] = await Promise.all([
    supabase
      .from("skus_families")
      .select("id, name, name_pt, name_es, name_en, reference_code, status")
      .neq("status", "archived")
      .order("name", { ascending: true }),
    supabase
      .from("skus_words")
      .select("id, label, reference_code, designation, designation_pt, designation_es, designation_en, is_active, skus_field_types(code)")
      .eq("is_active", true)
      .order("label", { ascending: true }),
  ]);

  const catalog: CatalogEntry[] = [];

  for (const [index, family] of ((familiesResult.data ?? []) as SkuFamilyRow[]).entries()) {
    const code = toCatalogCode(family.reference_code);
    const canonicalValue = family.name_pt || family.name || code;
    if (!code || !canonicalValue) continue;

    catalog.push({
      id: `sku-family-${family.id}`,
      category: "brand",
      canonicalValue,
      code,
      usable: true,
      enabled: true,
      labels: buildLabels(canonicalValue, family.name_es, family.name_en),
      detectionAliases: uniqueStrings([
        code,
        family.name,
        family.name_pt ?? "",
        family.name_es ?? "",
        family.name_en ?? "",
        ...getLegacyAliases("brand", code, canonicalValue),
      ]),
      notes: "Sincronizado automaticamente desde skus_families.",
      metadata: { source: "skus_families", familyId: family.id, status: family.status },
      sortOrder: -60000 + index,
    });
  }

  const categorySortOffset: Record<SkuWordCategory, number> = {
    format: -50000,
    product: -40000,
    size: -30000,
    packaging: -20000,
    extra: -10000,
  };

  for (const [index, word] of ((wordsResult.data ?? []) as SkuWordRow[]).entries()) {
    const category = getFieldTypeCode(word.skus_field_types);
    if (!isSkuWordCategory(category)) continue;

    const code = toCatalogCode(word.reference_code);
    const canonicalValue = word.designation_pt || word.designation || word.label || code;
    if (!code || !canonicalValue) continue;

    catalog.push({
      id: `sku-word-${word.id}`,
      category,
      canonicalValue,
      code,
      usable: true,
      enabled: true,
      labels: buildLabels(canonicalValue, word.designation_es, word.designation_en),
      detectionAliases: uniqueStrings([
        code,
        word.label,
        word.designation ?? "",
        word.designation_pt ?? "",
        word.designation_es ?? "",
        word.designation_en ?? "",
        ...getLegacyAliases(category, code, canonicalValue),
      ]),
      notes: "Sincronizado automaticamente desde skus_words.",
      metadata: { source: "skus_words", wordId: word.id },
      sortOrder: categorySortOffset[category] + index,
    });
  }

  return catalog;
}

function mergeCatalogWithDefaults(persisted: CatalogEntry[], synced: CatalogEntry[] = []) {
  const defaults = buildDefaultCatalogEntries();
  const merged = new Map<string, CatalogEntry>();
  const defaultIds = new Set(defaults.map((entry) => entry.id));

  if (synced.length === 0) {
    for (const entry of defaults) {
      merged.set(`${entry.category}:${entry.code}:${entry.canonicalValue}`, entry);
    }
  }

  for (const entry of synced) {
    merged.set(`${entry.category}:${entry.code}:${entry.canonicalValue}`, {
      ...merged.get(`${entry.category}:${entry.code}:${entry.canonicalValue}`),
      ...entry,
      labels: entry.labels ?? merged.get(`${entry.category}:${entry.code}:${entry.canonicalValue}`)?.labels ?? { pt: "", es: "", en: "" },
      detectionAliases:
        entry.detectionAliases?.length > 0
          ? entry.detectionAliases
          : merged.get(`${entry.category}:${entry.code}:${entry.canonicalValue}`)?.detectionAliases ?? [],
    });
  }

  for (const entry of persisted) {
    if (synced.length > 0 && defaultIds.has(entry.id)) continue;
    merged.set(`${entry.category}:${entry.code}:${entry.canonicalValue}`, {
      ...merged.get(`${entry.category}:${entry.code}:${entry.canonicalValue}`),
      ...entry,
      labels: entry.labels ?? merged.get(`${entry.category}:${entry.code}:${entry.canonicalValue}`)?.labels ?? { pt: "", es: "", en: "" },
      detectionAliases:
        entry.detectionAliases?.length > 0
          ? entry.detectionAliases
          : merged.get(`${entry.category}:${entry.code}:${entry.canonicalValue}`)?.detectionAliases ?? [],
    });
  }

  return Array.from(merged.values()).sort((left, right) => {
    if (left.category !== right.category) return left.category.localeCompare(right.category);
    return left.sortOrder - right.sortOrder;
  });
}

function mergeRulesWithDefaults(persisted: NormalizerRule[]) {
  const defaults = buildDefaultRules();
  const merged = new Map<string, NormalizerRule>();

  for (const rule of defaults) {
    merged.set(rule.id, rule);
  }

  for (const rule of persisted) {
    merged.set(rule.id, { ...merged.get(rule.id), ...rule });
  }

  return Array.from(merged.values()).sort((left, right) => left.priority - right.priority);
}

async function recordAudit(action: string, payload: Record<string, unknown>) {
  const supabase = createSupabaseServiceServerClient();
  if (!supabase) return;
  await supabase.from("skus_refnorm_rule_audit").insert({ action, payload });
}

async function ensureReferenceNormalizerSeeded() {
  const supabase = createSupabaseServiceServerClient();
  if (!supabase) return null;

  const [catalogCount, rulesCount, settingsCount] = await Promise.all([
    supabase.from("skus_refnorm_catalog_entries").select("id", { count: "exact", head: true }),
    supabase.from("skus_refnorm_rules").select("id", { count: "exact", head: true }),
    supabase.from("skus_refnorm_settings").select("id", { count: "exact", head: true }),
  ]);

  if ((catalogCount.count ?? 0) === 0) {
    await supabase.from("skus_refnorm_catalog_entries").insert(
      buildDefaultCatalogEntries().map((entry) => ({
        id: entry.id,
        category: entry.category,
        canonical_value: entry.canonicalValue,
        code: entry.code,
        usable: entry.usable,
        enabled: entry.enabled,
        labels_json: entry.labels,
        detection_aliases_json: entry.detectionAliases,
        notes: entry.notes ?? null,
        metadata_json: entry.metadata ?? {},
        sort_order: entry.sortOrder,
      })),
    );
  }

  if ((rulesCount.count ?? 0) === 0) {
    await supabase.from("skus_refnorm_rules").insert(
      buildDefaultRules().map((rule) => ({
        id: rule.id,
        name: rule.name,
        description: rule.description,
        enabled: rule.enabled,
        priority: rule.priority,
        stage: rule.stage,
        match_type: rule.matchType,
        match_logic: rule.matchLogic,
        conditions_json: rule.conditions,
        actions_json: rule.actions,
        notes: rule.notes ?? null,
        source: rule.source,
      })),
    );
  }

  if ((settingsCount.count ?? 0) === 0) {
    await supabase.from("skus_refnorm_settings").insert({
      char_limit_pt: DEFAULT_NORMALIZER_SETTINGS.charLimitPt,
      char_limit_es: DEFAULT_NORMALIZER_SETTINGS.charLimitEs,
      char_limit_en: DEFAULT_NORMALIZER_SETTINGS.charLimitEn,
    });
  }

  return supabase;
}

export async function getReferenceNormalizerConfig(): Promise<NormalizerConfig> {
  const supabase = await ensureReferenceNormalizerSeeded();
  if (!supabase) {
    return buildDefaultNormalizerConfig();
  }

  const [catalogResult, rulesResult, settingsResult] = await Promise.all([
    supabase.from("skus_refnorm_catalog_entries").select("*").order("category").order("sort_order"),
    supabase.from("skus_refnorm_rules").select("*").order("priority"),
    supabase.from("skus_refnorm_settings").select("*").limit(1).maybeSingle(),
  ]);
  const skuCatalog = await buildSkuCatalogEntries(supabase);

  return {
    catalog: mergeCatalogWithDefaults(((catalogResult.data ?? []) as DbCatalogRow[]).map(mapCatalogRow), skuCatalog),
    rules: mergeRulesWithDefaults(((rulesResult.data ?? []) as DbRuleRow[]).map(mapRuleRow)),
    settings: mapSettingsRow(settingsResult.data as DbSettingsRow | null),
  };
}

export async function saveReferenceNormalizerSettings(input: unknown) {
  const parsed = settingsSchema.parse(input);
  const supabase = await ensureReferenceNormalizerSeeded();
  if (!supabase) throw new Error("Supabase service role nao configurada.");

  const settingsResult = await supabase.from("skus_refnorm_settings").select("id").limit(1).maybeSingle();
  if (settingsResult.data?.id) {
    await supabase
      .from("skus_refnorm_settings")
      .update({
        char_limit_pt: parsed.charLimitPt,
        char_limit_es: parsed.charLimitEs,
        char_limit_en: parsed.charLimitEn,
      })
      .eq("id", settingsResult.data.id);
  } else {
    await supabase.from("skus_refnorm_settings").insert({
      char_limit_pt: parsed.charLimitPt,
      char_limit_es: parsed.charLimitEs,
      char_limit_en: parsed.charLimitEn,
    });
  }

  await recordAudit("settings.save", parsed);
  revalidatePath("/reference-normalizer");
  return parsed;
}

export async function upsertReferenceNormalizerRule(input: unknown) {
  const parsed = ruleSchema.parse(input);
  const supabase = await ensureReferenceNormalizerSeeded();
  if (!supabase) throw new Error("Supabase service role nao configurada.");

  await supabase.from("skus_refnorm_rules").upsert({
    id: parsed.id,
    name: parsed.name,
    description: parsed.description,
    enabled: parsed.enabled,
    priority: parsed.priority,
    stage: parsed.stage,
    match_type: parsed.matchType,
    match_logic: parsed.matchLogic,
    conditions_json: parsed.conditions,
    actions_json: parsed.actions,
    notes: parsed.notes ?? null,
    source: parsed.source,
  });

  await recordAudit("rule.save", { id: parsed.id, name: parsed.name });
  revalidatePath("/reference-normalizer");
  return parsed;
}

export async function deleteReferenceNormalizerRule(ruleId: string) {
  const supabase = await ensureReferenceNormalizerSeeded();
  if (!supabase) throw new Error("Supabase service role nao configurada.");
  await supabase.from("skus_refnorm_rules").delete().eq("id", ruleId);
  await recordAudit("rule.delete", { ruleId });
  revalidatePath("/reference-normalizer");
}

export async function duplicateReferenceNormalizerRule(ruleId: string) {
  const config = await getReferenceNormalizerConfig();
  const source = config.rules.find((rule) => rule.id === ruleId);
  if (!source) throw new Error("Regra nao encontrada.");

  const duplicated: NormalizerRule = {
    ...source,
    id: `${source.id}-copy-${Date.now()}`,
    name: `${source.name} (copia)`,
    source: "user",
  };

  await upsertReferenceNormalizerRule(duplicated);
  await recordAudit("rule.duplicate", { ruleId, newRuleId: duplicated.id });
  return duplicated;
}

export async function restoreDefaultRules() {
  const supabase = await ensureReferenceNormalizerSeeded();
  if (!supabase) throw new Error("Supabase service role nao configurada.");

  await supabase.from("skus_refnorm_rules").delete().neq("id", "");
  await supabase.from("skus_refnorm_rules").insert(
    buildDefaultRules().map((rule) => ({
      id: rule.id,
      name: rule.name,
      description: rule.description,
      enabled: rule.enabled,
      priority: rule.priority,
      stage: rule.stage,
      match_type: rule.matchType,
      match_logic: rule.matchLogic,
      conditions_json: rule.conditions,
      actions_json: rule.actions,
      notes: rule.notes ?? null,
      source: rule.source,
    })),
  );

  await recordAudit("rule.restore-defaults", {});
  revalidatePath("/reference-normalizer");
}

export async function importReferenceNormalizerRules(input: unknown) {
  const parsed = z.array(ruleSchema).parse(input);
  const supabase = await ensureReferenceNormalizerSeeded();
  if (!supabase) throw new Error("Supabase service role nao configurada.");

  await supabase.from("skus_refnorm_rules").delete().neq("id", "");
  await supabase.from("skus_refnorm_rules").insert(
    parsed.map((rule) => ({
      id: rule.id,
      name: rule.name,
      description: rule.description,
      enabled: rule.enabled,
      priority: rule.priority,
      stage: rule.stage,
      match_type: rule.matchType,
      match_logic: rule.matchLogic,
      conditions_json: rule.conditions,
      actions_json: rule.actions,
      notes: rule.notes ?? null,
      source: rule.source,
    })),
  );

  await recordAudit("rule.import", { total: parsed.length });
  revalidatePath("/reference-normalizer");
}

export async function upsertReferenceNormalizerCatalogEntry(input: unknown) {
  const parsed = catalogEntrySchema.parse(input);
  const supabase = await ensureReferenceNormalizerSeeded();
  if (!supabase) throw new Error("Supabase service role nao configurada.");

  await supabase.from("skus_refnorm_catalog_entries").upsert({
    id: parsed.id,
    category: parsed.category,
    canonical_value: parsed.canonicalValue,
    code: parsed.code,
    usable: parsed.usable,
    enabled: parsed.enabled,
    labels_json: parsed.labels,
    detection_aliases_json: parsed.detectionAliases,
    notes: parsed.notes ?? null,
    metadata_json: parsed.metadata ?? {},
    sort_order: parsed.sortOrder,
  });

  await recordAudit("catalog.save", { id: parsed.id, category: parsed.category });
  revalidatePath("/reference-normalizer");
  return parsed;
}

export async function deleteReferenceNormalizerCatalogEntry(entryId: string) {
  const supabase = await ensureReferenceNormalizerSeeded();
  if (!supabase) throw new Error("Supabase service role nao configurada.");
  await supabase.from("skus_refnorm_catalog_entries").delete().eq("id", entryId);
  await recordAudit("catalog.delete", { entryId });
  revalidatePath("/reference-normalizer");
}

export async function restoreDefaultCatalog() {
  const supabase = await ensureReferenceNormalizerSeeded();
  if (!supabase) throw new Error("Supabase service role nao configurada.");

  await supabase.from("skus_refnorm_catalog_entries").delete().neq("id", "");
  await supabase.from("skus_refnorm_catalog_entries").insert(
    buildDefaultCatalogEntries().map((entry) => ({
      id: entry.id,
      category: entry.category,
      canonical_value: entry.canonicalValue,
      code: entry.code,
      usable: entry.usable,
      enabled: entry.enabled,
      labels_json: entry.labels,
      detection_aliases_json: entry.detectionAliases,
      notes: entry.notes ?? null,
      metadata_json: entry.metadata ?? {},
      sort_order: entry.sortOrder,
    })),
  );

  await recordAudit("catalog.restore-defaults", {});
  revalidatePath("/reference-normalizer");
}

export async function importReferenceNormalizerCatalog(input: unknown) {
  const parsed = z.array(catalogEntrySchema).parse(input);
  const supabase = await ensureReferenceNormalizerSeeded();
  if (!supabase) throw new Error("Supabase service role nao configurada.");

  await supabase.from("skus_refnorm_catalog_entries").delete().neq("id", "");
  await supabase.from("skus_refnorm_catalog_entries").insert(
    parsed.map((entry) => ({
      id: entry.id,
      category: entry.category,
      canonical_value: entry.canonicalValue,
      code: entry.code,
      usable: entry.usable,
      enabled: entry.enabled,
      labels_json: entry.labels,
      detection_aliases_json: entry.detectionAliases,
      notes: entry.notes ?? null,
      metadata_json: entry.metadata ?? {},
      sort_order: entry.sortOrder,
    })),
  );

  await recordAudit("catalog.import", { total: parsed.length });
  revalidatePath("/reference-normalizer");
}
