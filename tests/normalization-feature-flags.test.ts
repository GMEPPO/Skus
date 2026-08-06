import { describe, expect, it, vi, afterEach } from "vitest";

describe("normalization feature flags", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("isNormalizationV2Enabled defaults to false", async () => {
    vi.stubEnv("NEXT_PUBLIC_SKUS_NORMALIZATION_V2", "");
    const { isNormalizationV2Enabled, isSecureGenerationV2Enabled } = await import("@/lib/skus-feature-flags");
    expect(isNormalizationV2Enabled()).toBe(false);
    expect(isSecureGenerationV2Enabled()).toBe(false);
  });

  it("isNormalizationV2Enabled is independent from generator V2", async () => {
    vi.stubEnv("NEXT_PUBLIC_SKUS_SECURE_GENERATION_V2", "true");
    vi.stubEnv("NEXT_PUBLIC_SKUS_NORMALIZATION_V2", "false");
    const { isNormalizationV2Enabled, isSecureGenerationV2Enabled } = await import("@/lib/skus-feature-flags");
    expect(isSecureGenerationV2Enabled()).toBe(true);
    expect(isNormalizationV2Enabled()).toBe(false);
  });

  it("isNormalizationV2Enabled accepts true variants", async () => {
    vi.stubEnv("NEXT_PUBLIC_SKUS_NORMALIZATION_V2", "yes");
    const { isNormalizationV2Enabled } = await import("@/lib/skus-feature-flags");
    expect(isNormalizationV2Enabled()).toBe(true);
  });
});
