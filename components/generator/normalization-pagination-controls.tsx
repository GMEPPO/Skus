"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function NormalizationPaginationControls({
  page,
  totalPages,
  total,
  onPageChange,
  isLoading,
}: {
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (page: number) => void;
  isLoading?: boolean;
}) {
  if (total === 0) return null;

  return (
    <div className="flex items-center justify-between gap-2 border-t border-slate-800 px-3 py-2">
      <p className="text-xs text-slate-500">
        Pagina {page} de {totalPages} · {total} registo(s)
      </p>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="outline"
          className="h-8 w-8 p-0"
          disabled={page <= 1 || isLoading}
          onClick={() => onPageChange(page - 1)}
          aria-label="Pagina anterior"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-8 w-8 p-0"
          disabled={page >= totalPages || isLoading}
          onClick={() => onPageChange(page + 1)}
          aria-label="Pagina seguinte"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
