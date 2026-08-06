import { createHash } from "crypto";
import { describe, expect, it } from "vitest";
import { canManageCategoryLevels, canManageWords, hasMinimumRole } from "@/lib/rbac";
import {
  buildEmptySelectionId,
  buildSelectionFingerprintCanonical,
  computeSelectionFingerprint,
  isEmptySelectionValue,
  readSelectionSnapshot,
  resolveV1KeyToLevelId,
  selectionSnapshotV2Schema,
  type SelectionSnapshotV2,
} from "@/lib/selection-snapshot";

describe("rbac phase 2B.1", () => {
  it("allows editors to manage words but not levels", () => {
    expect(canManageWords("editor")).toBe(true);
    expect(canManageWords("viewer")).toBe(false);
    expect(canManageCategoryLevels("editor")).toBe(false);
    expect(canManageCategoryLevels("manager")).toBe(true);
    expect(hasMinimumRole("admin", "manager")).toBe(true);
  });
});

describe("selection snapshot v1/v2", () => {
  const v2: SelectionSnapshotV2 = {
    version: 2,
    codeFormatVersion: 1,
    category: { id: "11111111-1111-1111-1111-111111111111", slug: "cosmetica", name: "Cosmética" },
    levels: [
      {
        levelId: "22222222-2222-2222-2222-222222222222",
        key: "brand",
        label: "Marca",
        sortOrder: 1,
        isEnabled: true,
        isRequired: false,
        participatesInCode: true,
        codeSegment: "ALG",
        selection: {
          kind: "word",
          wordId: "33333333-3333-3333-3333-333333333333",
          label: "ALG",
          referenceCode: "ALG",
          includeInDesignation: true,
          designations: { pt: "ALG", es: "ALG", en: "ALG" },
        },
      },
      {
        levelId: "44444444-4444-4444-4444-444444444444",
        key: "extra",
        label: "Outros",
        sortOrder: 6,
        isEnabled: true,
        isRequired: false,
        participatesInCode: true,
        codeSegment: "000",
        selection: { kind: "empty" },
      },
    ],
  };

  it("parses approved v2 shape", () => {
    expect(selectionSnapshotV2Schema.safeParse(v2).success).toBe(true);
  });

  it("reads v1 maps keyed by field type id", () => {
    const fieldTypeId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
    const wordId = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
    const view = readSelectionSnapshot({ [fieldTypeId]: wordId }, 1);
    expect(view.kind).toBe("v1");
    if (view.kind === "v1") {
      expect(view.map[fieldTypeId]).toBe(wordId);
      expect(isEmptySelectionValue(buildEmptySelectionId(fieldTypeId))).toBe(true);
    }
  });

  it("resolves v1 field type keys to category levels via legacy_field_type_id", () => {
    const fieldTypeId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
    const levelId = "cccccccc-cccc-cccc-cccc-cccccccccccc";
    expect(
      resolveV1KeyToLevelId(fieldTypeId, [
        { id: levelId, legacyFieldTypeId: fieldTypeId },
        { id: "other", legacyFieldTypeId: null },
      ]),
    ).toBe(levelId);
  });

  it("computes stable SHA-256 fingerprints for the same combination", () => {
    const a = computeSelectionFingerprint(v2);
    const shuffled: SelectionSnapshotV2 = {
      ...v2,
      levels: [...v2.levels].reverse(),
    };
    const b = computeSelectionFingerprint(shuffled);
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it("omits non-participating empty levels from fingerprint input", () => {
    const withExtra: SelectionSnapshotV2 = {
      ...v2,
      levels: [
        ...v2.levels,
        {
          levelId: "66666666-6666-6666-6666-666666666666",
          key: "note",
          label: "Nota",
          sortOrder: 99,
          isEnabled: true,
          isRequired: false,
          participatesInCode: false,
          codeSegment: null,
          selection: { kind: "empty" },
        },
      ],
    };
    expect(computeSelectionFingerprint(withExtra)).toBe(computeSelectionFingerprint(v2));
  });

  it("golden fingerprint matches known SHA-256 canonical string", () => {
    const canonical = buildSelectionFingerprintCanonical(v2);
    expect(canonical).toBe(
      'sku-selection:v2:{"categoryId":"11111111-1111-1111-1111-111111111111","codeFormatVersion":1,"levels":[{"codeSegment":"ALG","levelId":"22222222-2222-2222-2222-222222222222","selection":{"kind":"word","wordId":"33333333-3333-3333-3333-333333333333"}},{"codeSegment":"000","levelId":"44444444-4444-4444-4444-444444444444","selection":{"kind":"empty"}}]}',
    );
    const expected = createHash("sha256").update(canonical, "utf8").digest("hex");
    expect(computeSelectionFingerprint(v2)).toBe(expected);
    expect(expected).toMatch(/^[0-9a-f]{64}$/);
  });

  it("documents golden vector fields for SQL↔TS parity", () => {
    const canonicalText = buildSelectionFingerprintCanonical(v2);
    const typescriptSha256 = computeSelectionFingerprint(v2);
    // postgresSha256: fill after rollback test on GGMPI with same snapshot
    expect({
      canonicalText,
      expectedSha256: typescriptSha256,
      typescriptSha256,
      postgresSha256: "(pending GGMPI rollback vector)",
    }).toMatchObject({
      typescriptSha256: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
  });

  it("changes fingerprint when word selection changes", () => {
    const other: SelectionSnapshotV2 = {
      ...v2,
      levels: v2.levels.map((level, index) =>
        index === 0 && level.selection.kind === "word"
          ? {
              ...level,
              selection: {
                ...level.selection,
                wordId: "55555555-5555-5555-5555-555555555555",
              },
            }
          : level,
      ),
    };
    expect(computeSelectionFingerprint(other)).not.toBe(computeSelectionFingerprint(v2));
  });
});
