"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { FieldTypeOption } from "@/lib/admin-catalog";
import type { WordListItem } from "@/lib/types";

function matchesQuery(word: WordListItem, query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;

  return [
    word.label,
    word.referenceCode,
    word.designation,
    word.designationPt,
    word.designationEs,
    word.designationEn,
    word.fieldTypeLabel,
  ]
    .join(" ")
    .toLowerCase()
    .includes(normalizedQuery);
}

export function WordCatalogList({
  words,
  fieldTypes,
  deleteAction,
  showManageActions = true,
  searchQuery,
  onSearchQueryChange,
  isLoading = false,
  serverPaginated = false,
}: {
  words: WordListItem[];
  fieldTypes: FieldTypeOption[];
  deleteAction?: (formData: FormData) => void | Promise<void>;
  showManageActions?: boolean;
  searchQuery?: string;
  onSearchQueryChange?: (query: string) => void;
  isLoading?: boolean;
  serverPaginated?: boolean;
}) {
  const [internalQuery, setInternalQuery] = useState("");
  const query = searchQuery ?? internalQuery;
  const setQuery = onSearchQueryChange ?? setInternalQuery;

  const groupedWords = useMemo(() => {
    return fieldTypes.map((fieldType) => ({
      fieldType,
      words: words.filter((word) => {
        if (word.fieldTypeId !== fieldType.id) return false;
        if (serverPaginated) return true;
        return matchesQuery(word, query);
      }),
    }));
  }, [fieldTypes, query, serverPaginated, words]);

  const hasVisibleWords = groupedWords.some(({ words: levelWords }) => levelWords.length > 0);

  return (
    <div className="space-y-5">
      <label className="relative block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Pesquisar por palavra, código ou designação"
          className="flex h-11 w-full rounded-lg border border-slate-700 bg-slate-950 pl-9 pr-3 text-sm text-slate-100"
        />
      </label>

      {isLoading && words.length === 0 ? (
        <div className="flex items-center gap-2 rounded-xl border border-dashed border-slate-700 bg-slate-900/30 p-4 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          A carregar palavras...
        </div>
      ) : null}

      {!isLoading && !hasVisibleWords ? (
        <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/30 p-4 text-sm text-slate-500">
          Sem palavras para a busca atual.
        </div>
      ) : null}

      {groupedWords.map(({ fieldType, words: levelWords }) =>
        levelWords.length === 0 ? null : (
          <section key={fieldType.id} className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-300">{fieldType.name}</h3>
                <p className="text-xs text-slate-500">
                  {serverPaginated ? `${levelWords.length} palavra(s) nesta pagina` : `${levelWords.length} palavras`}
                </p>
              </div>
            </div>

            <div className="grid gap-3">
              {levelWords.map((word) => (
                <div key={word.id} className="rounded-xl border border-slate-700 bg-slate-900/50 p-4">
                  <div className="grid gap-4 md:grid-cols-[1.2fr_auto_auto_1fr_auto]">
                    <div>
                      <p className="font-medium text-slate-100">{word.label}</p>
                      <p className="text-sm text-slate-400">PT: {word.designationPt || "Sem designacao"}</p>
                      <p className="text-xs text-slate-500">
                        ES: {word.designationEs || "-"} | EN: {word.designationEn || "-"}
                      </p>
                    </div>
                    <Badge variant="outline">{word.referenceCode}</Badge>
                    <Badge>{word.fieldTypeLabel}</Badge>
                    <div className="text-sm text-slate-400">
                      {word.includeInDesignation ? "Entra na designacao" : "So entra no codigo"}
                    </div>
                    {showManageActions ? (
                      <div className="flex flex-wrap gap-2">
                        <Button asChild variant="outline">
                          <Link href={`/catalog/words-manage/${word.id}`}>Editar</Link>
                        </Button>
                        {deleteAction ? (
                          <form action={deleteAction}>
                            <input type="hidden" name="wordId" value={word.id} />
                            <Button type="submit" variant="outline" className="text-red-100 hover:bg-red-500/10">
                              Remover
                            </Button>
                          </form>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ),
      )}
    </div>
  );
}
