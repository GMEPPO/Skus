import { describe, expect, it } from "vitest";
import {
  computeThreeCharReferenceAvailability,
  isThreeCharCatalogReference,
  THREE_CHAR_REFERENCE_POOL_SIZE,
  USABLE_THREE_CHAR_REFERENCE_POOL,
} from "@/lib/word-reference-availability";

describe("word reference availability", () => {
  it("identifica referencias de 3 caracteres validas", () => {
    expect(isThreeCharCatalogReference("ALG")).toBe(true);
    expect(isThreeCharCatalogReference("020")).toBe(true);
    expect(isThreeCharCatalogReference("A&B")).toBe(false);
    expect(isThreeCharCatalogReference("000")).toBe(false);
    expect(isThreeCharCatalogReference("AL")).toBe(false);
    expect(isThreeCharCatalogReference("ALGX")).toBe(false);
  });

  it("calcula disponibilidade por nivel", () => {
    const usedByLevel = new Map<string, Set<string>>([
      ["level-a", new Set(["AAA", "AAB"])],
      ["level-b", new Set(["ZZZ"])],
    ]);

    const summary = computeThreeCharReferenceAvailability({
      levelIds: ["level-a", "level-b", "level-c"],
      usedByLevel,
    });

    expect(THREE_CHAR_REFERENCE_POOL_SIZE).toBe(46656);
    expect(USABLE_THREE_CHAR_REFERENCE_POOL).toBe(46655);
    expect(summary.levels).toBe(3);
    expect(summary.used).toBe(3);
    expect(summary.capacity).toBe(46655 * 3);
    expect(summary.available).toBe(46655 * 3 - 3);
  });
});
