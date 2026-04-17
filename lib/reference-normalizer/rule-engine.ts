import { buildDesignationDrafts } from "@/lib/reference-normalizer/designation-builder";
import type {
  CatalogEntry,
  NormalizerCategory,
  NormalizerConfig,
  NormalizerLanguage,
  NormalizerRule,
  RuleRuntimeContext,
  RuleStage,
  SegmentOverrides,
  SegmentSelection,
} from "@/lib/reference-normalizer/types";
import { cleanText, normalizeText, removeDescriptionNoise } from "@/lib/reference-normalizer/normalization";

function emptyOverrides(): SegmentOverrides {
  return {
    labels: {},
    hiddenCategories: new Set<NormalizerCategory>(),
    preservedReferenceTokens: new Set<string>(),
  };
}

function getFieldValue(context: RuleRuntimeContext, field: string) {
  switch (field) {
    case "oldReference":
      return context.input.oldReference;
    case "oldDesignation":
      return context.input.oldDesignation;
    case "normalizedDesignation":
      return normalizeText(context.input.oldDesignation);
    case "detectedBrand":
      return context.segments.brand?.canonicalValue ?? "";
    case "detectedFormat":
      return context.segments.format?.canonicalValue ?? "";
    case "detectedProduct":
      return context.segments.product?.canonicalValue ?? "";
    case "detectedSize":
      return context.segments.size?.canonicalValue ?? "";
    case "detectedPackaging":
      return context.segments.packaging?.canonicalValue ?? "";
    case "detectedExtra":
      return context.segments.extra?.canonicalValue ?? "";
    case "builtReference":
      return context.builtReference;
    case "designationPt":
      return context.designationDraft.pt;
    case "designationEs":
      return context.designationDraft.es;
    case "designationEn":
      return context.designationDraft.en;
    default:
      return "";
  }
}

function conditionMatches(left: string, right: string, matchType: NormalizerRule["matchType"]) {
  const subject = normalizeText(left);
  const target = normalizeText(right);

  if (matchType === "exact") return subject === target;
  if (matchType === "contains") return subject.includes(target);
  if (matchType === "startsWith") return subject.startsWith(target);
  if (matchType === "endsWith") return subject.endsWith(target);

  try {
    return new RegExp(right, "i").test(left);
  } catch {
    return false;
  }
}

function ruleMatches(rule: NormalizerRule, context: RuleRuntimeContext) {
  if (!rule.enabled || rule.conditions.length === 0) return false;
  const results = rule.conditions.map((condition) =>
    conditionMatches(getFieldValue(context, condition.field), condition.value, condition.matchType),
  );

  return rule.matchLogic === "or" ? results.some(Boolean) : results.every(Boolean);
}

function findCatalogEntry(catalog: CatalogEntry[], category: NormalizerCategory, entryId?: string) {
  if (!entryId) return null;
  return catalog.find((entry) => entry.category === category && entry.id === entryId) ?? null;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripVariantNoise(value: string) {
  return removeDescriptionNoise(value)
    .replace(/\bpink lily\b/gi, " ")
    .replace(/\s+/g, " ")
    .replace(/^[\s\-_/.,]+|[\s\-_/.,]+$/g, "")
    .trim();
}

function hasMeaningfulVariant(value: string) {
  const cleaned = stripVariantNoise(value);
  const normalized = normalizeText(cleaned);
  const tokenCount = cleaned.split(/\s+/).filter(Boolean).length;

  if (!normalized) return false;
  if (normalized.length < 3) return false;
  if (cleaned.length > 28) return false;
  if (tokenCount > 3) return false;
  if (/\d/.test(cleaned)) return false;
  if (["castelbel", "pink lily", "nova imagem", "imagem nova"].includes(normalized)) return false;

  return /[a-z]/i.test(cleaned);
}

function applyExtractRemainderAfterBrandOrFallback(context: RuleRuntimeContext, fallback?: Partial<Record<NormalizerLanguage, string>>) {
  const brand = context.segments.brand;
  if (!brand) return;

  const aliases = uniqueNormalized([brand.canonicalValue, ...brand.detectionAliases]);
  const removableSegments = [context.segments.format, context.segments.product, context.segments.size, context.segments.packaging, context.segments.extra]
    .filter(Boolean)
    .flatMap((entry) => (entry ? [entry.canonicalValue, ...entry.detectionAliases, entry.labels.pt, entry.labels.es, entry.labels.en] : []));
  const nonBrandAliases = uniqueNormalized(removableSegments);
  const source = stripVariantNoise(context.input.oldDesignation);
  let candidate = source;

  for (const alias of aliases) {
    const expression = new RegExp(escapeRegExp(alias), "ig");
    candidate = candidate.replace(expression, " ");
  }

  const containsExplicitNonBrandSegments = nonBrandAliases.some((alias) => {
    if (!alias) return false;
    return new RegExp(escapeRegExp(alias), "i").test(source);
  });

  for (const alias of nonBrandAliases) {
    const expression = new RegExp(escapeRegExp(alias), "ig");
    candidate = candidate.replace(expression, " ");
  }

  const variant = stripVariantNoise(candidate);
  const fallbackPt = cleanText(fallback?.pt);
  const fallbackEs = cleanText(fallback?.es) || fallbackPt;
  const fallbackEn = cleanText(fallback?.en) || fallbackPt;
  const resolvedPt = hasMeaningfulVariant(variant) ? variant : fallbackPt;
  const resolvedEs = hasMeaningfulVariant(variant) ? variant : fallbackEs;
  const resolvedEn = hasMeaningfulVariant(variant) ? variant : fallbackEn;

  context.overrides.labels.brand = {
    pt: resolvedPt,
    es: resolvedEs,
    en: resolvedEn,
  };

  if (!containsExplicitNonBrandSegments) {
    context.overrides.hiddenCategories.add("format");
    context.overrides.hiddenCategories.add("product");
    context.overrides.hiddenCategories.add("size");
    context.overrides.hiddenCategories.add("packaging");
    context.overrides.hiddenCategories.add("extra");
  }
}

function uniqueNormalized(values: string[]) {
  return Array.from(new Set(values.map((value) => cleanText(value)).filter(Boolean))).sort((left, right) => right.length - left.length);
}

function applyRule(rule: NormalizerRule, context: RuleRuntimeContext, config: NormalizerConfig) {
  for (const action of rule.actions) {
    if (action.type === "setCanonicalSegment" && action.category) {
      const entry = findCatalogEntry(config.catalog, action.category, action.entryId);
      if (entry) {
        context.segments[action.category] = entry;
      }
      continue;
    }

    if (action.type === "setLabelTranslations" && action.category) {
      context.overrides.labels[action.category] = {
        ...context.overrides.labels[action.category],
        ...action.labels,
      };
      continue;
    }

    if (action.type === "hideLabelInDesignation" && action.category) {
      context.overrides.hiddenCategories.add(action.category);
      continue;
    }

    if (action.type === "replaceTextInDesignation") {
      const languages: NormalizerLanguage[] = action.language === "all" || !action.language ? ["pt", "es", "en"] : [action.language];
      for (const language of languages) {
        const current = context.designationDraft[language];
        if (!current) continue;
        try {
          context.designationDraft[language] = action.regex
            ? current.replace(new RegExp(action.pattern ?? "", "gi"), action.replacement ?? "")
            : current.replaceAll(action.pattern ?? "", action.replacement ?? "");
        } catch {
          context.trace.internalNotes.push(`Regex invalido na regra ${rule.name}.`);
        }
      }
      continue;
    }

    if (action.type === "addValidationWarning" && action.message) {
      context.trace.warnings.push(action.message);
      continue;
    }

    if (action.type === "forceStatusReview") {
      context.reviewForced = true;
      if (action.message) context.trace.warnings.push(action.message);
      continue;
    }

    if (action.type === "preserveReferenceToken" && action.token) {
      context.overrides.preservedReferenceTokens.add(action.token);
      continue;
    }

    if (action.type === "extractRemainderAfterBrandOrFallback") {
      applyExtractRemainderAfterBrandOrFallback(context, action.fallbackLabels);
    }
  }

  context.designationDraft = buildDesignationDrafts(context.segments, context.overrides);
}

export function createRuleRuntimeContext(input: RuleRuntimeContext["input"], segments: SegmentSelection, builtReference: string, trace: RuleRuntimeContext["trace"]): RuleRuntimeContext {
  const overrides = emptyOverrides();
  return {
    input,
    segments,
    overrides,
    trace,
    designationDraft: buildDesignationDrafts(segments, overrides),
    builtReference,
    reviewForced: false,
  };
}

export function applyRulesForStage(stage: RuleStage, context: RuleRuntimeContext, config: NormalizerConfig) {
  const rules = config.rules
    .filter((rule) => rule.stage === stage && rule.enabled)
    .sort((left, right) => left.priority - right.priority);

  for (const rule of rules) {
    if (!ruleMatches(rule, context)) continue;
    context.trace.triggeredRules.push(rule.name);
    applyRule(rule, context, config);
  }

  return context;
}
