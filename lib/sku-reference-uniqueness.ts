export function normalizeSkuReference(code: string | null | undefined): string {
  return String(code ?? "")
    .trim()
    .replace(/-/g, "")
    .toUpperCase();
}

export function isSkuReferenceBlank(code: string | null | undefined): boolean {
  return normalizeSkuReference(code) === "";
}
