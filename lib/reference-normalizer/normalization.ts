export function cleanText(value: unknown) {
  if (value === undefined || value === null) return "";
  return String(value).replace(/\s+/g, " ").trim();
}

export function normalizeText(value: unknown) {
  return cleanText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[()]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function normalizeKey(value: unknown) {
  return normalizeText(value)
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function toUpperAscii(value: unknown) {
  return cleanText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}

export function removeDescriptionNoise(value: unknown) {
  return cleanText(value)
    .replace(/\(\s*\d+(?:\s*\/\s*\d+)?\s*\)/g, " ")
    .replace(/\bnova imagem\b/gi, " ")
    .replace(/\bimagem nova\b/gi, " ")
    .replace(/\bnew image\b/gi, " ")
    .replace(/\bREF\.?\b/gi, " ")
    .replace(/\bR\.?\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function countCharacters(value: string) {
  return Array.from(value).length;
}

export function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.map((value) => cleanText(value)).filter(Boolean)));
}
