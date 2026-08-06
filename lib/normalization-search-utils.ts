export const NORMALIZATION_PENDING_PAGE_SIZE = 40;
export const NORMALIZATION_HISTORY_PAGE_SIZE = 50;

export type PaginatedResult<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export function escapeIlikePattern(value: string): string {
  return value.replace(/[%_\\]/g, "\\$&");
}

export function buildIlikePattern(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return `%${escapeIlikePattern(trimmed)}%`;
}

export function toPaginatedResult<T>(items: T[], total: number, page: number, pageSize: number): PaginatedResult<T> {
  const safePageSize = Math.max(1, pageSize);
  const totalPages = Math.max(1, Math.ceil(total / safePageSize));
  return {
    items,
    total,
    page,
    pageSize: safePageSize,
    totalPages,
  };
}
