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
  const escapedDescription = ` ${normalizedDescription} `;

  const aliasesByEntry = categoryEntries.map((entry) => ({
    entry,
    aliases: [entry.canonicalValue, ...entry.detectionAliases].filter(Boolean),
  }));

  function isWeakAlias(alias: string) {
    const compact = alias.replace(/[^A-Za-z0-9.&]/g, "");
    if (!compact) return true;
    if (compact.length <= 3) return true;
    if (/^[A-Z0-9.&]+$/.test(alias) && compact.length <= 4) return true;
    return false;
  }

  function aliasMatches(alias: string) {
    const normalizedAlias = normalizeText(alias);
    if (!normalizedAlias) return false;
    const escapedAlias = normalizedAlias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const expression = new RegExp(`(^|\\s)${escapedAlias}(\\s|$)`, "i");
    return expression.test(escapedDescription);
  }

  const strongMatch =
    aliasesByEntry.find(({ aliases }) =>
      aliases
        .filter((alias) => !isWeakAlias(alias))
        .some((alias) => aliasMatches(alias)),
    )?.entry ?? null;

  if (strongMatch) return strongMatch;

  return (
    aliasesByEntry.find(({ aliases }) =>
      aliases.some((alias) => {
        if (isWeakAlias(alias)) return false;
        return normalizedDescription.includes(normalizeText(alias));
      }),
    )?.entry ?? null
  );
}

function findCatalogEntryByCanonicalValue(entries: CatalogEntry[], value: string) {
  const normalizedValue = normalizeText(value);
  return entries.find((entry) => normalizeText(entry.canonicalValue) === normalizedValue) ?? null;
}

function findByCode(entries: Map<string, CatalogEntry[]>, code: string) {
  return entries.get(code)?.find((entry) => entry.usable) ?? entries.get(code)?.[0] ?? null;
}

function findByCodeAnywhere(entries: Map<string, CatalogEntry[]>, reference: string) {
  const codes = Array.from(entries.keys())
    .filter((code) => code && code !== "000")
    .sort((left, right) => right.length - left.length);

  for (const code of codes) {
    if (!reference.includes(code)) continue;
    const found = findByCode(entries, code);
    if (found) return { code, entry: found };
  }

  return null;
}

function looksLikeFiveLiterToken(value: string) {
  return /(?:^|[^A-Z0-9])5L(?:T)?(?:[^A-Z0-9]|$)/i.test(value) || /5000ML/i.test(value);
}

function findFiveLiterSize(index: CatalogIndex) {
  return findByCode(index.byCode.size, "005");
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

  if (!segments.brand) {
    const fallback = findByCodeAnywhere(index.byCode.brand, rawReference);
    if (fallback) {
      rawCodes.brand = fallback.code;
      segments.brand = fallback.entry;
    }
  }

  if (!segments.format) {
    const fallback = findByCodeAnywhere(index.byCode.format, rawReference);
    if (fallback) {
      rawCodes.format = fallback.code;
      segments.format = fallback.entry;
    }
  }

  if (!segments.product) {
    const fallback = findByCodeAnywhere(index.byCode.product, rawReference);
    if (fallback) {
      rawCodes.product = fallback.code;
      segments.product = fallback.entry;
    }
  }

  if (!segments.size) {
    const fallback = findByCodeAnywhere(index.byCode.size, rawReference);
    if (fallback) {
      rawCodes.size = fallback.code;
      segments.size = fallback.entry;
    }
  }

  if (!segments.size && looksLikeFiveLiterToken(rawReference)) {
    const fiveLiterSize = findFiveLiterSize(index);
    if (fiveLiterSize) {
      rawCodes.size = "005";
      segments.size = fiveLiterSize;
    }
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

  if (!segments.packaging) {
    const fallback = findByCodeAnywhere(index.byCode.packaging, tail || rawReference);
    if (fallback) {
      rawCodes.packaging = fallback.code;
      segments.packaging = fallback.entry;
    }
  }

  if (!segments.extra) {
    const fallback = findByCodeAnywhere(index.byCode.extra, tail || rawReference);
    if (fallback) {
      rawCodes.extra = fallback.code;
      segments.extra = fallback.entry;
    }
  }

  return { segments, rawCodes };
}

function chooseDetectedEntry(parsed: CatalogEntry | null, described: CatalogEntry | null) {
  if (described?.usable && parsed?.usable && described.id !== parsed.id) {
    return described;
  }
  if (parsed?.usable) return parsed;
  if (described?.usable) return described;
  return parsed ?? described ?? null;
}

export function detectSegments(reference: string, designation: string, catalog: CatalogEntry[]) {
  const index = buildCatalogIndex(catalog);
  const parsed = parseReferenceSegments(reference, index);
  const normalizedDesignation = normalizeText(removeDescriptionNoise(designation));
  const described = {
    brand: findByDescription(index.byCategory.brand, designation),
    format: findByDescription(index.byCategory.format, designation),
    product: findByDescription(index.byCategory.product, designation),
    size: findByDescription(index.byCategory.size, designation),
    packaging: findByDescription(index.byCategory.packaging, designation),
    extra: findByDescription(index.byCategory.extra, designation),
  };

  if (normalizedDesignation.includes("castelbel") && normalizedDesignation.includes("laranja verbena")) {
    described.brand = findCatalogEntryByCanonicalValue(index.byCategory.brand, "LARANJA VERBENA");
  }

  if (!parsed.segments.size && !described.size && looksLikeFiveLiterToken(normalizedDesignation)) {
    described.size = findFiveLiterSize(index);
  }

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
