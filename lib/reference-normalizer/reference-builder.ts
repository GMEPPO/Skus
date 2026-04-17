import type { NormalizerCategory, SegmentSelection } from "@/lib/reference-normalizer/types";

function segmentCode(value: SegmentSelection[NormalizerCategory]) {
  return value?.code || "000";
}

export function buildReferenceCode(segments: SegmentSelection, preservedTokens: Set<string>) {
  const brand = segmentCode(segments.brand);
  const format = segmentCode(segments.format);
  const product = segmentCode(segments.product);
  const size = segmentCode(segments.size);
  let packaging = segmentCode(segments.packaging);
  const extra = segmentCode(segments.extra);

  if (preservedTokens.has("VAZ")) {
    packaging = "VAZ";
  }

  return `${brand}${format}${product}${size}${packaging}${extra}`;
}
