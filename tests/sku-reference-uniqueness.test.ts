import { describe, expect, it } from "vitest";
import { isSkuReferenceBlank, normalizeSkuReference } from "@/lib/sku-reference-uniqueness";
import { findDuplicateSkuReferencesWithinList } from "@/lib/sku-reference-uniqueness-data";

describe("sku reference uniqueness helpers", () => {
  it("normalizeSkuReference elimina guiones y usa mayusculas", () => {
    expect(normalizeSkuReference("sun-fra-bod-030-0000-v6")).toBe("SUNFRABOD0300000V6");
    expect(normalizeSkuReference("SUNFRABOD0300000V6")).toBe("SUNFRABOD0300000V6");
  });

  it("isSkuReferenceBlank detecta valores vacios", () => {
    expect(isSkuReferenceBlank(null)).toBe(true);
    expect(isSkuReferenceBlank("  -  ")).toBe(true);
    expect(isSkuReferenceBlank("ABC")).toBe(false);
  });

  it("findDuplicateSkuReferencesWithinList detecta duplicados normalizados", () => {
    expect(
      findDuplicateSkuReferencesWithinList(["ABC-123", "abc123", "XYZ"]),
    ).toEqual(["ABC123"]);
  });
});
