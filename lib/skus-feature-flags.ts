/**
 * Feature flags for SKUS secure generation (Fase 2B.2 R5).
 * Default OFF — UI must not call R5 RPCs until a separate activation OK.
 */
function isTruthyEnv(raw: string | undefined) {
  const value = (raw ?? "false").trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes" || value === "on";
}

export function isSecureGenerationV2Enabled(): boolean {
  return isTruthyEnv(process.env.NEXT_PUBLIC_SKUS_SECURE_GENERATION_V2);
}

/** Normalization UI V2 — independent gate from generator V2. Default OFF. */
export function isNormalizationV2Enabled(): boolean {
  return isTruthyEnv(process.env.NEXT_PUBLIC_SKUS_NORMALIZATION_V2);
}

/** Server gate for OpenAI nomenclature assistant. Default OFF. */
export function isSkuAssistantEnabled(): boolean {
  return isTruthyEnv(process.env.SKUS_AI_ASSISTANT_ENABLED);
}

/** Client gate to show assistant UI. Default OFF. */
export function isSkuAssistantUiEnabled(): boolean {
  return isTruthyEnv(process.env.NEXT_PUBLIC_SKUS_AI_ASSISTANT);
}
