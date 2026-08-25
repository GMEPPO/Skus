import { describe, expect, it } from "vitest";
import { normalizeCnCode } from "@/lib/sku-assistant/run-combined-nomenclature-turn";

describe("normalizeCnCode", () => {
  it("formats 8-digit codes", () => {
    expect(normalizeCnCode("33059000")).toBe("3305 90 00");
    expect(normalizeCnCode("3305 90 00")).toBe("3305 90 00");
  });

  it("rejects invalid codes", () => {
    expect(normalizeCnCode("3305")).toBeNull();
    expect(normalizeCnCode("")).toBeNull();
  });
});
