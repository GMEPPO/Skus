import type { CatalogEntry, NormalizerCategory, SegmentSelection } from "@/lib/reference-normalizer/types";
import { normalizeText, removeDescriptionNoise, toUpperAscii } from "@/lib/reference-normalizer/normalization";

type CatalogIndex = {
  byCategory: Record<NormalizerCategory, CatalogEntry[]>;
  byCode: Record<NormalizerCategory, Map<string, CatalogEntry[]>>;
};

const ORDERED_CATEGORIES: NormalizerCategory[] = ["brand", "format", "product", "size", "packaging", "extra"];

function emptySegments(): SegmentSelection {
  return {
    brand: null,
    format: null,
    product: null,
    size: null,
    packaging: null,
    extra: null,
  };
}

export function buildCatalogIndex(catalog: CatalogEntry[]): CatalogIndex {
  const base = {
    brand: [] as CatalogEntry[],
    format: [] as CatalogEntry[],
    product: [] as CatalogEntry[],
    size: [] as CatalogEntry[],
    packaging: [] as CatalogEntry[],
    extra: [] as CatalogEntry[],
  };

  const byCode = {
    brand: new Map<string, CatalogEntry[]>(),
    format: new Map<string, CatalogEntry[]>(),
    product: new Map<string, CatalogEntry[]>(),
    size: new Map<string, CatalogEntry[]>(),
    packaging: new Map<string, CatalogEntry[]>(),
    extra: new Map<string, CatalogEntry[]>(),
  };

  for (const entry of catalog.filter((item) => item.enabled)) {
    base[entry.category].push(entry);
    const items = byCode[entry.category].get(entry.code) ?? [];
    items.push(entry);
    byCode[entry.category].set(entry.code, items);
  }

  for (const category of ORDERED_CATEGORIES) {
    base[category].sort(
      (left, right) =>
        Math.max(...right.detectionAliases.map((alias) => alias.length), right.canonicalValue.length) -
        Math.max(...left.detectionAliases.map((alias) => alias.length), left.canonicalValue.length),
    );
  }

  return { byCategory: base, byCode };
}

function findByDescription(categoryEntries: CatalogEntry[], description: string) {
  const normalizedDescription = normalizeText(removeDescriptionNoise(description));
  return (
    categoryEntries.find((entry) =>
      [entry.canonicalValue, ...entry.detectionAliases]
        .filter(Boolean)
        .some((alias) => normalizedDescription.includes(normalizeText(alias))),
    ) ?? null
  );
}

function findByCode(entries: Map<string, CatalogEntry[]>, code: string) {
  return entries.get(code)?.find((entry) => entry.usable) ?? entries.get(code)?.[0] ?? null;
}

type ParsedReferenceResult = {
  segments: SegmentSelection;
  rawCodes: Partial<Record<NormalizerCategory, string>>;
};

function parseReferenceSegments(reference: string, index: CatalogIndex): ParsedReferenceResult {
  const rawReference = toUpperAscii(reference).replace(/[^A-Z0-9.&]/g, "");
  const segments = emptySegments();
  const rawCodes: Partial<Record<NormalizerCategory, string>> = {};

  const brandCode = rawReference.slice(0, 3);
  const formatCode = rawReference.slice(3, 6);
  const productCode = rawReference.slice(6, 9);
  const sizeCode = rawReference.slice(9, 12);
  const tail = rawReference.slice(12);

  if (brandCode) {
    rawCodes.brand = brandCode;
    segments.brand = findByCode(index.byCode.brand, brandCode);
  }
  if (formatCode) {
    rawCodes.format = formatCode;
    segments.format = findByCode(index.byCode.format, formatCode);
  }
  if (productCode) {
    rawCodes.product = productCode;
    segments.product = findByCode(index.byCode.product, productCode);
  }
  if (sizeCode) {
    rawCodes.size = sizeCode;
    segments.size = findByCode(index.byCode.size, sizeCode);
  }

  if (tail) {
    if (tail === "VAZ") {
      rawCodes.packaging = "VAZ";
      segments.packaging = findByCode(index.byCode.packaging, "VAZ");
    } else {
      const packagingCandidates = index.byCategory.packaging
        .map((entry) => entry.code)
        .filter((code) => code !== "000")
        .sort((left, right) => right.length - left.length);

      const packagingCode = packagingCandidates.find((code) => tail.startsWith(code)) ?? tail.slice(0, 3);
      const extraCode = tail.slice(packagingCode.length);

      if (packagingCode) {
        rawCodes.packaging = packagingCode;
        segments.packaging = findByCode(index.byCode.packaging, packagingCode);
      }
      if (extraCode) {
        rawCodes.extra = extraCode;
        segments.extra = findByCode(index.byCode.extra, extraCode);
      } else if (tail.length <= 4 && !segments.packaging) {
        rawCodes.extra = tail;
        segments.extra = findByCode(index.byCode.extra, tail);
      }
    }
  }

  return { segments, rawCodes };
}

function chooseDetectedEntry(parsed: CatalogEntry | null, described: CatalogEntry | null) {
  if (parsed?.usable) return parsed;
  if (described?.usable) return described;
  return parsed ?? described ?? null;
}

export function detectSegments(reference: string, designation: string, catalog: CatalogEntry[]) {
  const index = buildCatalogIndex(catalog);
  const parsed = parseReferenceSegments(reference, index);
  const described = {
    brand: findByDescription(index.byCategory.brand, designation),
    format: findByDescription(index.byCategory.format, designation),
    product: findByDescription(index.byCategory.product, designation),
    size: findByDescription(index.byCategory.size, designation),
    packaging: findByDescription(index.byCategory.packaging, designation),
    extra: findByDescription(index.byCategory.extra, designation),
  };

  return {
    segments: {
      brand: chooseDetectedEntry(parsed.segments.brand, described.brand),
      format: chooseDetectedEntry(parsed.segments.format, described.format),
      product: chooseDetectedEntry(parsed.segments.product, described.product),
      size: chooseDetectedEntry(parsed.segments.size, described.size),
      packaging: chooseDetectedEntry(parsed.segments.packaging, described.packaging),
      extra: chooseDetectedEntry(parsed.segments.extra, described.extra),
    },
    parsedReferenceSegments: parsed.rawCodes,
    descriptionMatches: {
      brand: described.brand?.canonicalValue,
      format: described.format?.canonicalValue,
      product: described.product?.canonicalValue,
      size: described.size?.canonicalValue,
      packaging: described.packaging?.canonicalValue,
      extra: described.extra?.canonicalValue,
    },
  };
}
