import { detectSegments } from "@/lib/reference-normalizer/catalog-matching";
import { finalizeDrafts } from "@/lib/reference-normalizer/postprocess";
import { buildReferenceCode } from "@/lib/reference-normalizer/reference-builder";
import { applyRulesForStage, createRuleRuntimeContext } from "@/lib/reference-normalizer/rule-engine";
import type { NormalizerConfig, RowProcessInput, RowProcessResult, SegmentSelection } from "@/lib/reference-normalizer/types";
import { countCharacters, removeDescriptionNoise } from "@/lib/reference-normalizer/normalization";
import { validateRow } from "@/lib/reference-normalizer/validation";

function cloneSegments(segments: SegmentSelection): SegmentSelection {
  return {
    brand: segments.brand,
    format: segments.format,
    product: segments.product,
    size: segments.size,
    packaging: segments.packaging,
    extra: segments.extra,
  };
}

export function processRow(input: RowProcessInput, config: NormalizerConfig): RowProcessResult {
  const detected = detectSegments(input.oldReference, removeDescriptionNoise(input.oldDesignation), config.catalog);
  const trace = {
    parsedReferenceSegments: detected.parsedReferenceSegments,
    descriptionMatches: detected.descriptionMatches,
    triggeredRules: [] as string[],
    warnings: [] as string[],
    internalNotes: [] as string[],
  };

  const initialSegments = cloneSegments(detected.segments);
  let referenceDraft = buildReferenceCode(initialSegments, new Set<string>());
  const context = createRuleRuntimeContext(input, initialSegments, referenceDraft, trace);

  applyRulesForStage("preprocess", context, config);
  applyRulesForStage("detect", context, config);

  referenceDraft = buildReferenceCode(context.segments, context.overrides.preservedReferenceTokens);
  context.builtReference = referenceDraft;

  applyRulesForStage("reference", context, config);
  context.builtReference = buildReferenceCode(context.segments, context.overrides.preservedReferenceTokens);
  context.designationDraft = finalizeDrafts(context.designationDraft);

  applyRulesForStage("designation", context, config);
  context.designationDraft = finalizeDrafts(context.designationDraft);

  applyRulesForStage("validation", context, config);

  const validation = validateRow(context, config);

  return {
    rowNumber: input.rowNumber,
    originalRow: input.originalRow,
    oldReference: input.oldReference,
    oldDesignation: input.oldDesignation,
    newReference: validation.status === "ERROR" ? "" : context.builtReference,
    designationPt: validation.status === "ERROR" ? "" : context.designationDraft.pt,
    designationEs: validation.status === "ERROR" ? "" : context.designationDraft.es,
    designationEn: validation.status === "ERROR" ? "" : context.designationDraft.en,
    charactersPt: countCharacters(context.designationDraft.pt),
    charactersEs: countCharacters(context.designationDraft.es),
    charactersEn: countCharacters(context.designationDraft.en),
    status: validation.status,
    observations: validation.observations,
    segments: context.segments,
    trace: context.trace,
  };
}
