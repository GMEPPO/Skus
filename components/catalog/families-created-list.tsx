"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, Settings2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { deleteFamilyAction } from "@/lib/admin-catalog";

type FamilyItem = {
  id: string;
  name: string;
  description: string;
  status: "draft" | "active" | "archived";
  levelLabels: string[];
};

export function FamiliesCreatedList({
  families,
}: {
  families: FamilyItem[];
}) {
  const [query, setQuery] = useState("");
  const [selectedFamilyId, setSelectedFamilyId] = useState("");

  const filteredFamilies = useMemo(() => {
    if (selectedFamilyId) {
      return families.filter((family) => family.id === selectedFamilyId);
    }

    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return families;

    return families.filter((family) => family.name.toLowerCase().includes(normalizedQuery));
  }, [families, query, selectedFamilyId]);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="space-y-2">
          <span className="text-xs uppercase tracking-wide text-slate-500">Buscar familia</span>
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setSelectedFamilyId("");
            }}
            list="families-created-list-options"
            placeholder="Escribe el nombre de la familia"
            className="flex h-10 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
          />
          <datalist id="families-created-list-options">
            {families.map((family) => (
              <option key={family.id} value={family.name} />
            ))}
          </datalist>
        </label>
        <label className="space-y-2">
          <span className="text-xs uppercase tracking-wide text-slate-500">O seleccionar en lista</span>
          <select
            value={selectedFamilyId}
            onChange={(event) => {
              setSelectedFamilyId(event.target.value);
              setQuery("");
            }}
            className="flex h-10 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
          >
            <option value="">Todas las familias</option>
            {families.map((family) => (
              <option key={family.id} value={family.id}>
                {family.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="space-y-3">
        {filteredFamilies.length > 0 ? (
          filteredFamilies.map((family) => (
            <div key={family.id} className="rounded-xl border border-slate-700 bg-slate-900/50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-slate-100">{family.name}</p>
                  <p className="text-sm text-slate-400">{family.description || "Sem descricao"}</p>
                </div>
                <Badge variant={family.status === "active" ? "success" : "outline"}>
                  {family.status}
                </Badge>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                {family.levelLabels.length > 0 ? (
                  family.levelLabels.map((level) => (
                    <div
                      key={level}
                      className="flex items-center gap-2 rounded-full border border-slate-700 bg-slate-800 px-3 py-1"
                    >
                      <span>{level}</span>
                      <ArrowRight className="h-3.5 w-3.5 text-slate-500" />
                    </div>
                  ))
                ) : (
                  <span className="text-slate-500">Sem niveis publicados ainda</span>
                )}
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Button asChild variant="outline" className="h-10">
                  <Link href={`/families-manage/${family.id}`} className="inline-flex items-center gap-2">
                    <Settings2 className="h-4 w-4" />
                    Configurar builder
                  </Link>
                </Button>
                <form action={deleteFamilyAction}>
                  <input type="hidden" name="familyId" value={family.id} />
                  <Button type="submit" variant="outline" className="h-10 text-red-100 hover:bg-red-500/10">
                    Eliminar familia
                  </Button>
                </form>
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-xl border border-dashed border-slate-700 bg-slate-950/40 p-4 text-sm text-slate-400">
            No se encontraron familias con ese criterio.
          </div>
        )}
      </div>
    </div>
  );
}
