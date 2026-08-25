import { describe, expect, it } from "vitest";
import { isSkuAssistantEnabled, isSkuAssistantUiEnabled } from "@/lib/skus-feature-flags";

describe("sku assistant feature flags", () => {
  it("desactivado por defecto", () => {
    expect(isSkuAssistantEnabled()).toBe(false);
    expect(isSkuAssistantUiEnabled()).toBe(false);
  });
});
