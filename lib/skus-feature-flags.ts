/**
 * Feature flags for SKUS secure generation (Fase 2B.2 R5).
 * Default OFF — UI must not call R5 RPCs until a separate activation OK.
 */
export function isSecureGenerationV2Enabled(): boolean {
  const raw = (process.env.NEXT_PUBLIC_SKUS_SECURE_GENERATION_V2 ?? "false").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

/** Normalization UI V2 — independent gate from generator V2. Default OFF. */
export function isNormalizationV2Enabled(): boolean {
  const raw = (process.env.NEXT_PUBLIC_SKUS_NORMALIZATION_V2 ?? "false").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}
