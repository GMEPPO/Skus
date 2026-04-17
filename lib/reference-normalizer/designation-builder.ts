import type { NormalizerCategory, NormalizerLanguage, SegmentOverrides, SegmentSelection } from "@/lib/reference-normalizer/types";
import { cleanText } from "@/lib/reference-normalizer/normalization";

const CATEGORY_ORDER: NormalizerCategory[] = ["brand", "format", "product", "size", "packaging", "extra"];

function resolveLabel(
  category: NormalizerCategory,
  language: NormalizerLanguage,
  segments: SegmentSelection,
  overrides: SegmentOverrides,
) {
  if (overrides.hiddenCategories.has(category)) return "";

  const override = overrides.labels[category]?.[language];
  if (override !== undefined) return cleanText(override);

  const entry = segments[category];
  if (!entry) return "";

  return cleanText(entry.labels[language] || entry.canonicalValue);
}

export function buildDesignationDrafts(segments: SegmentSelection, overrides: SegmentOverrides) {
  const languages: NormalizerLanguage[] = ["pt", "es", "en"];
  return Object.fromEntries(
    languages.map((language) => [
      language,
      CATEGORY_ORDER.map((category) => resolveLabel(category, language, segments, overrides))
        .filter(Boolean)
        .join(" "),
    ]),
  ) as Record<NormalizerLanguage, string>;
}
