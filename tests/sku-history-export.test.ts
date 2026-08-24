import { describe, expect, it } from "vitest";
import { stripReferenceSeparators } from "@/lib/sku-history-export";

describe("stripReferenceSeparators", () => {
  it("elimina guiones de la referencia", () => {
    expect(stripReferenceSeparators("AB-CD-EF-123456")).toBe("ABCDEF123456");
  });

  it("deja referencias sin guiones intactas", () => {
    expect(stripReferenceSeparators("ABCDEF123456")).toBe("ABCDEF123456");
  });
});
