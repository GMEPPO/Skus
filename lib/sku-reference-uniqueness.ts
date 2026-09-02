export function normalizeSkuReference(code: string | null | undefined): string {
  return String(code ?? "")
    .trim()
    .replace(/-/g, "")
    .toUpperCase();
}

export function isSkuReferenceBlank(code: string | null | undefined): boolean {
  return normalizeSkuReference(code) === "";
}

export function isDuplicateSkuErrorMessage(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("ja exist") ||
    normalized.includes("já exist") ||
    normalized.includes("sku_reference_duplicate") ||
    normalized.includes("sku_code_collision") ||
    normalized.includes("colisao de codigo") ||
    normalized.includes("colisão de codigo") ||
    normalized.includes("mesma referencia")
  );
}
