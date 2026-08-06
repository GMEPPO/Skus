/**
 * Snapshot selection v1/v2 + fingerprint helpers (Fase 2B.1 / 2B.2 R2).
 *
 * v1 keys = skus_field_types.id (legacy), NOT category_level_id.
 * v2 keys = category_level_id with full historical designations.
 *
 * Fingerprint (must match skus_private.compute_selection_fingerprint):
 *   sha256_hex("sku-selection:v2:" + jsonb_canonical_text)
 */

import { createHash } from "crypto";
import { z } from "zod";

export const CODE_FORMAT_VERSION_V1 = 1 as const;

const designationsSchema = z.object({
  pt: z.string(),
  es: z.string(),
  en: z.string(),
});

const selectionWordSchema = z.object({
  kind: z.literal("word"),
  wordId: z.string().uuid(),
  label: z.string(),
  referenceCode: z.string(),
  includeInDesignation: z.boolean(),
  designations: designationsSchema,
});

const selectionEmptySchema = z.object({
  kind: z.literal("empty"),
});

export const selectionSnapshotV2Schema = z.object({
  version: z.literal(2),
  codeFormatVersion: z.literal(1),
  category: z.object({
    id: z.string().uuid(),
    slug: z.string(),
    name: z.string(),
  }),
  levels: z.array(
    z.object({
      levelId: z.string().uuid(),
      key: z.string(),
      label: z.string(),
      sortOrder: z.number().int(),
      isEnabled: z.boolean(),
      isRequired: z.boolean(),
      participatesInCode: z.boolean(),
      codeSegment: z.string().nullable(),
      selection: z.union([selectionWordSchema, selectionEmptySchema]),
    }),
  ),
});

export type SelectionSnapshotV2 = z.infer<typeof selectionSnapshotV2Schema>;

/** v1: Record<fieldTypeId, wordId | "__empty__:<fieldTypeId}"> */
export type SelectionSnapshotV1 = Record<string, string>;

export type SelectionSnapshotView =
  | { kind: "v2"; snapshot: SelectionSnapshotV2 }
  | { kind: "v1"; map: SelectionSnapshotV1 };

export const EMPTY_SELECTION_PREFIX = "__empty__:";

export function buildEmptySelectionId(fieldOrLevelId: string) {
  return `${EMPTY_SELECTION_PREFIX}${fieldOrLevelId}`;
}

export function isEmptySelectionValue(value?: string | null) {
  return Boolean(value && value.startsWith(EMPTY_SELECTION_PREFIX));
}

export function isV2Shape(value: unknown): value is SelectionSnapshotV2 {
  return selectionSnapshotV2Schema.safeParse(value).success;
}

export function readSelectionSnapshot(
  snapshot: unknown,
  snapshotVersion: number | null | undefined,
): SelectionSnapshotView {
  if (snapshotVersion != null && snapshotVersion >= 2) {
    const parsed = selectionSnapshotV2Schema.safeParse(snapshot);
    if (parsed.success) return { kind: "v2", snapshot: parsed.data };
  }
  if (isV2Shape(snapshot)) return { kind: "v2", snapshot };

  if (snapshot && typeof snapshot === "object" && !Array.isArray(snapshot)) {
    const map: SelectionSnapshotV1 = {};
    for (const [key, value] of Object.entries(snapshot as Record<string, unknown>)) {
      if (typeof value === "string") map[key] = value;
    }
    return { kind: "v1", map };
  }

  return { kind: "v1", map: {} };
}

/**
 * Explicit canonical text for fingerprint (must match SQL format()/string_agg).
 * NOT jsonb::text / NOT arbitrary JSON.stringify key order.
 *
 * Contract key order:
 *   root: categoryId, codeFormatVersion, levels
 *   level: codeSegment, levelId, selection
 *   selection word: kind, wordId
 *   selection empty: kind
 */
export function buildSelectionFingerprintCanonical(snapshot: SelectionSnapshotV2): string {
  const seen = new Set<string>();
  const levels = [...snapshot.levels]
    .sort((a, b) => a.sortOrder - b.sortOrder || a.levelId.localeCompare(b.levelId))
    .filter((level) => {
      if (!level.isEnabled) throw new Error("invalid_payload");
      const id = level.levelId.toLowerCase();
      if (seen.has(id)) throw new Error("invalid_payload");
      seen.add(id);
      return !(!level.participatesInCode && level.selection.kind === "empty");
    })
    .map((level) => {
      const levelId = level.levelId.toLowerCase();
      if (level.selection.kind === "word") {
        const wordId = level.selection.wordId.toLowerCase();
        if (level.participatesInCode) {
          const codeSegment = level.codeSegment;
          if (codeSegment == null || !/^[A-Z0-9&.]{1,3}$/.test(codeSegment)) {
            throw new Error("invalid_payload");
          }
          return `{"codeSegment":${JSON.stringify(codeSegment)},"levelId":${JSON.stringify(levelId)},"selection":{"kind":"word","wordId":${JSON.stringify(wordId)}}}`;
        }
        if (level.codeSegment !== null) throw new Error("invalid_payload");
        return `{"codeSegment":null,"levelId":${JSON.stringify(levelId)},"selection":{"kind":"word","wordId":${JSON.stringify(wordId)}}}`;
      }
      // empty participating only (non-participating empty filtered above; must be exactly "000")
      if (level.codeSegment !== "000") throw new Error("invalid_payload");
      return `{"codeSegment":"000","levelId":${JSON.stringify(levelId)},"selection":{"kind":"empty"}}`;
    });

  const categoryId = snapshot.category.id.toLowerCase();
  return `sku-selection:v2:{"categoryId":${JSON.stringify(categoryId)},"codeFormatVersion":1,"levels":[${levels.join(",")}]}`;
}

/**
 * Canonical fingerprint for unique combination (must match SQL SHA-256).
 */
export function computeSelectionFingerprint(snapshot: SelectionSnapshotV2): string {
  const canonical = buildSelectionFingerprintCanonical(snapshot);
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

/**
 * Resolve a v1 snapshot entry key (field type UUID) to a category level via legacy_field_type_id.
 */
export function resolveV1KeyToLevelId(
  fieldTypeId: string,
  levels: Array<{ id: string; legacyFieldTypeId: string | null }>,
): string | null {
  const match = levels.find((level) => level.legacyFieldTypeId === fieldTypeId);
  return match?.id ?? null;
}
