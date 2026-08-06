/**
 * Golden fingerprint vectors for 2B.2 R4 (TS side).
 * postgresSha256 filled by harness with COMMIT→ROLLBACK (see supabase/test/phase2b2_r4_golden_rollback.sql).
 */
import { createHash } from "crypto";
import { describe, expect, it } from "vitest";
import {
  buildSelectionFingerprintCanonical,
  computeSelectionFingerprint,
  type SelectionSnapshotV2,
} from "@/lib/selection-snapshot";

const CAT = "11111111-1111-1111-1111-111111111111";
const L1 = "22222222-2222-2222-2222-222222222222";
const L2 = "44444444-4444-4444-4444-444444444444";
const L3 = "66666666-6666-6666-6666-666666666666";
const W1 = "33333333-3333-3333-3333-333333333333";
const W2 = "55555555-5555-5555-5555-555555555555";

/** UUIDs with A–F so uppercase→lowercase normalization is observable (G8). */
const CAT_HEX = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const L1_HEX = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const L2_HEX = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const W1_HEX = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

function wordLevel(
  levelId: string,
  sortOrder: number,
  codeSegment: string | null,
  wordId: string,
  participatesInCode = true,
): SelectionSnapshotV2["levels"][number] {
  return {
    levelId,
    key: `k${sortOrder}`,
    label: `L${sortOrder}`,
    sortOrder,
    isEnabled: true,
    isRequired: false,
    participatesInCode,
    codeSegment,
    selection: {
      kind: "word",
      wordId,
      label: "X",
      referenceCode: codeSegment ?? "X",
      includeInDesignation: true,
      designations: { pt: "A", es: "A", en: "A" },
    },
  };
}

function emptyLevel(
  levelId: string,
  sortOrder: number,
  participatesInCode = true,
  codeSegment: string | null = "000",
): SelectionSnapshotV2["levels"][number] {
  return {
    levelId,
    key: `e${sortOrder}`,
    label: `E${sortOrder}`,
    sortOrder,
    isEnabled: true,
    isRequired: false,
    participatesInCode,
    codeSegment,
    selection: { kind: "empty" },
  };
}

function base(levels: SelectionSnapshotV2["levels"]): SelectionSnapshotV2 {
  return {
    version: 2,
    codeFormatVersion: 1,
    category: { id: CAT, slug: "cosmetica", name: "Cosmetica" },
    levels,
  };
}

function sha(canonical: string) {
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

describe("phase2b2 R4 golden vectors (TS)", () => {
  const vectors: Array<{
    vectorId: string;
    snapshot: SelectionSnapshotV2;
    note: string;
  }> = [
    {
      vectorId: "G1_two_words_and_empty",
      note: "two participating words + participating empty",
      snapshot: base([
        wordLevel(L1, 1, "ALG", W1),
        wordLevel(L2, 2, "FMT", W2),
        emptyLevel(L3, 3, true, "000"),
      ]),
    },
    {
      vectorId: "G2_empty_participant",
      note: "single participating empty",
      snapshot: base([emptyLevel(L1, 1, true, "000")]),
    },
    {
      vectorId: "G3_shuffled_order",
      note: "same as G1 with levels shuffled — same hash",
      snapshot: base([
        emptyLevel(L3, 3, true, "000"),
        wordLevel(L2, 2, "FMT", W2),
        wordLevel(L1, 1, "ALG", W1),
      ]),
    },
    {
      vectorId: "G4_omit_non_participating_empty",
      note: "non-participating empty omitted from canonical",
      snapshot: base([
        wordLevel(L1, 1, "ALG", W1),
        emptyLevel(L2, 2, false, null),
      ]),
    },
    {
      vectorId: "G5_non_participating_word_null",
      note: "non-participating word with codeSegment null included",
      snapshot: base([
        wordLevel(L1, 1, "ALG", W1),
        wordLevel(L2, 2, null, W2, false),
      ]),
    },
    {
      vectorId: "G6_label_change_same_hash",
      note: "label/designation change must not affect fingerprint",
      snapshot: (() => {
        const s = base([wordLevel(L1, 1, "ALG", W1), emptyLevel(L2, 2, true, "000")]);
        if (s.levels[0].selection.kind === "word") {
          s.levels[0] = {
            ...s.levels[0],
            label: "CHANGED",
            selection: {
              ...s.levels[0].selection,
              label: "CHANGED",
              designations: { pt: "ZZ", es: "ZZ", en: "ZZ" },
            },
          };
        }
        return s;
      })(),
    },
    {
      vectorId: "G7_segment_change_diff_hash",
      note: "codeSegment change must change hash",
      snapshot: base([wordLevel(L1, 1, "XXX", W1), emptyLevel(L2, 2, true, "000")]),
    },
    {
      vectorId: "G8_uuid_uppercase_normalized",
      note: "uppercase A-F UUIDs normalize to lowercase in canonical text",
      snapshot: {
        version: 2,
        codeFormatVersion: 1,
        category: { id: CAT_HEX.toUpperCase(), slug: "cosmetica", name: "Cosmetica" },
        levels: [
          wordLevel(L1_HEX.toUpperCase(), 1, "ALG", W1_HEX.toUpperCase()),
          emptyLevel(L2_HEX.toUpperCase(), 2, true, "000"),
        ],
      },
    },
  ];

  const baselineSameLabel = base([
    wordLevel(L1, 1, "ALG", W1),
    emptyLevel(L2, 2, true, "000"),
  ]);

  const g8LowercaseEquivalent: SelectionSnapshotV2 = {
    version: 2,
    codeFormatVersion: 1,
    category: { id: CAT_HEX, slug: "cosmetica", name: "Cosmetica" },
    levels: [wordLevel(L1_HEX, 1, "ALG", W1_HEX), emptyLevel(L2_HEX, 2, true, "000")],
  };

  it("emits golden vector table with stable typescriptSha256", () => {
    const rows = vectors.map((v) => {
      const canonicalText = buildSelectionFingerprintCanonical(v.snapshot);
      const typescriptSha256 = sha(canonicalText);
      expect(computeSelectionFingerprint(v.snapshot)).toBe(typescriptSha256);
      return {
        vectorId: v.vectorId,
        canonicalText,
        expectedSha256: typescriptSha256,
        typescriptSha256,
        postgresSha256: null,
        match: null,
        note: v.note,
        snapshot: v.snapshot,
      };
    });

    expect(rows.find((r) => r.vectorId === "G3_shuffled_order")?.typescriptSha256).toBe(
      rows.find((r) => r.vectorId === "G1_two_words_and_empty")?.typescriptSha256,
    );
    expect(rows.find((r) => r.vectorId === "G6_label_change_same_hash")?.typescriptSha256).toBe(
      computeSelectionFingerprint(baselineSameLabel),
    );
    expect(rows.find((r) => r.vectorId === "G7_segment_change_diff_hash")?.typescriptSha256).not.toBe(
      computeSelectionFingerprint(baselineSameLabel),
    );

    const g8 = rows.find((r) => r.vectorId === "G8_uuid_uppercase_normalized")!;
    expect(g8.typescriptSha256).toBe(computeSelectionFingerprint(g8LowercaseEquivalent));
    expect(g8.canonicalText).toContain(CAT_HEX);
    expect(g8.canonicalText).toContain(L1_HEX);
    expect(g8.canonicalText).toContain(W1_HEX);
    expect(g8.canonicalText).not.toContain(CAT_HEX.toUpperCase());
    expect(g8.canonicalText).not.toContain(L1_HEX.toUpperCase());

    const g1 = rows.find((r) => r.vectorId === "G1_two_words_and_empty")!;
    expect(g1.canonicalText).toContain('"codeFormatVersion":1');
    expect(g1.typescriptSha256).toMatch(/^[0-9a-f]{64}$/);

    const { writeFileSync } = require("fs") as typeof import("fs");
    const { join } = require("path") as typeof import("path");
    // Slim artifact for ChatGPT attach (no nested snapshots → smaller)
    const slim = rows.map(({ vectorId, note, canonicalText, expectedSha256, typescriptSha256 }) => ({
      vectorId,
      note,
      canonicalText,
      expectedSha256,
      typescriptSha256,
      postgresSha256: null,
      match: null,
    }));
    writeFileSync(
      join(process.cwd(), ".cursor", "golden-g1-g8-r5.json"),
      JSON.stringify(rows, null, 2),
      "utf8",
    );
    writeFileSync(
      join(process.cwd(), ".cursor", "golden-g1-g8-r5-slim.json"),
      JSON.stringify(slim, null, 2),
      "utf8",
    );
  });
});
