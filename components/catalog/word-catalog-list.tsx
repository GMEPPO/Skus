"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
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
}: {
  words: WordListItem[];
  fieldTypes: FieldTypeOption[];
  deleteAction?: (formData: FormData) => void | Promise<void>;
  showManageActions?: boolean;
}) {
  const [query, setQuery] = useState("");
  const groupedWords = useMemo(() => {
    return fieldTypes.map((fieldType) => ({
      fieldType,
      words: words.filter((word) => word.fieldTypeId === fieldType.id && matchesQuery(word, query)),
    }));
  }, [fieldTypes, query, words]);

  return (
    <div className="space-y-5">
      <label className="relative block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar por palavra, codigo ou designacao"
          className="flex h-11 w-full rounded-lg border border-slate-700 bg-slate-950 pl-9 pr-3 text-sm text-slate-100"
        />
      </label>

      {groupedWords.map(({ fieldType, words: levelWords }) => (
        <section key={fieldType.id} className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-300">{fieldType.name}</h3>
              <p className="text-xs text-slate-500">{levelWords.length} palavras</p>
            </div>
          </div>

          {levelWords.length > 0 ? (
            <div className="grid gap-3">
              {levelWords.map((word) => (
                <div
                  key={word.id}
                  className="grid gap-4 rounded-xl border border-slate-700 bg-slate-900/50 p-4 md:grid-cols-[1.2fr_auto_auto_1fr_auto]"
                >
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
                            Eliminar
                          </Button>
                        </form>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/30 p-4 text-sm text-slate-500">
              Sem palavras neste nivel para a busca atual.
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
