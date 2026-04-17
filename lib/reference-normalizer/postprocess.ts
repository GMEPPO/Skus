import type { NormalizerLanguage } from "@/lib/reference-normalizer/types";
import { cleanText } from "@/lib/reference-normalizer/normalization";

function removeUnsafeDots(value: string) {
  return value
    .replace(/(?<=\b[A-Za-z]{2,})\.(?=\s|$)/g, "")
    .replace(/(?<=\b[A-Za-z]{2,})\.(?=[A-Za-z])/g, "");
}

function tightenHyphens(value: string) {
  return value.replace(/\s*-\s*/g, "-");
}

export function finalizeDesignation(value: string) {
  return cleanText(tightenHyphens(removeUnsafeDots(value)).replace(/\s+/g, " "));
}

export function finalizeDrafts(drafts: Record<NormalizerLanguage, string>) {
  return {
    pt: finalizeDesignation(drafts.pt),
    es: finalizeDesignation(drafts.es),
    en: finalizeDesignation(drafts.en),
  };
}
