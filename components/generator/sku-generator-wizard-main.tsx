"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, Lock, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { GeneratorFamily, GeneratorLevel, GeneratorWord } from "@/lib/types";
import { buildDesignation, buildSkuPreview, getAvailableOptions, MAX_DESIGNATION_LENGTH } from "@/lib/sku";

type Selections = Record<string, string>;

export function SkuGeneratorWizardMain({
  families,
}: {
  families: GeneratorFamily[];
}) {
  const [familyId, setFamilyId] = useState(families[0]?.id ?? "");
  const [selections, setSelections] = useState<Selections>({});

  const family = useMemo(
    () => families.find((item) => item.id === familyId) ?? families[0],
    [families, familyId],
  );

  useEffect(() => {
    setSelections({});
  }, [familyId]);

  if (families.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/40 p-6 text-sm text-slate-400">
        Ainda nao existem familias disponiveis no gerador. Cria uma familia e configura pelo menos um draft
        ou uma arvore publicada para a veres aqui.
      </div>
    );
  }

  if (!family) {
    return <div className="text-sm text-slate-400">Sem familias configuradas.</div>;
  }

  const designation = buildDesignation(family, selections);
  const designationLength = designation.length;
  const isDesignationTooLong = designationLength > MAX_DESIGNATION_LENGTH;
  const skuPreview = buildSkuPreview(family, selections, 125);
  const completedCount = Object.keys(selections).length;
  const hasConfiguredLevels = family.levels.length > 0;

  function handleSelection(level: GeneratorLevel, word: GeneratorWord) {
    setSelections((current) => {
      const next: Selections = {};
      for (const item of family.levels) {
        if (item.order < level.order) {
          const existing = current[item.id];
          if (existing) next[item.id] = existing;
        }
      }
      next[level.id] = word.id;
      return next;
    });
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-[1.35fr_0.85fr]">
        <div className="space-y-4">
          <Card className="p-4">
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-200">Familia</span>
              <select
                value={family.id}
                onChange={(event) => setFamilyId(event.target.value)}
                className="flex h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
              >
                {families.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
          </Card>

          <div className="space-y-3">
            {hasConfiguredLevels ? (
              family.levels.map((level) => {
                const options = getAvailableOptions(family, level.id, selections);
                const previousLevel = family.levels.find((item) => item.order === level.order - 1);
                const isBlocked = level.order > 1 && !selections[previousLevel?.id ?? ""];
                const selectedId = selections[level.id];

                return (
                  <div
                    key={level.id}
                    className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4 shadow-lg shadow-black/10"
                  >
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Passo {level.order}</p>
                        <h3 className="text-lg font-semibold text-slate-50">{level.label}</h3>
                      </div>
                      {selectedId ? (
                        <Badge variant="success">
                          <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                          preenchido
                        </Badge>
                      ) : isBlocked ? (
                        <Badge variant="outline">
                          <Lock className="mr-1 h-3.5 w-3.5" />
                          bloqueado
                        </Badge>
                      ) : (
                        <Badge>ativo</Badge>
                      )}
                    </div>

                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      {options.map((option) => {
                        const isSelected = selectedId === option.id;
                        return (
                          <button
                            key={option.id}
                            type="button"
                            disabled={isBlocked}
                            onClick={() => handleSelection(level, option)}
                            className={[
                              "rounded-xl border px-4 py-3 text-left transition",
                              isSelected
                                ? "border-amber-400 bg-amber-400/10"
                                : "border-slate-700 bg-slate-950/40 hover:border-slate-500 hover:bg-slate-800/80",
                              isBlocked ? "cursor-not-allowed opacity-50" : "",
                            ].join(" ")}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="font-medium text-slate-100">{option.label}</p>
                                <p className="mt-1 text-xs text-slate-500">{option.referenceCode}</p>
                              </div>
                              {isSelected ? <Sparkles className="h-4 w-4 text-amber-300" /> : null}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/40 p-6 text-sm text-slate-400">
                Esta familia ainda nao tem niveis configurados. Vai a <span className="text-slate-200">Familias</span>
                , abre o builder dessa familia e cria os niveis e palavras do fluxo.
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <Card className="space-y-4 p-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Resumo</p>
              <h3 className="mt-1 text-xl font-semibold text-slate-50">{family.name}</h3>
              <p className="mt-2 text-sm text-slate-400">{family.description}</p>
            </div>
            <div className="rounded-xl border border-slate-700 bg-slate-950/50 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Progressao</p>
              <p className="mt-2 text-3xl font-semibold text-slate-50">
                {completedCount}/{family.levels.length}
              </p>
            </div>
            <div className="rounded-xl border border-slate-700 bg-slate-950/50 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Preview SKU</p>
              <p className="mt-2 break-all text-lg font-semibold text-amber-300">{skuPreview}</p>
            </div>
          </Card>

          <Card className="p-4">
            <p className="mb-3 text-xs uppercase tracking-[0.2em] text-slate-500">Fluxo ativo</p>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
              {family.levels.length > 0 ? (
                family.levels.map((level, index) => (
                  <div
                    key={level.id}
                    className="flex items-center gap-2 rounded-full border border-slate-700 bg-slate-800 px-3 py-1"
                  >
                    <span>{level.label}</span>
                    {index < family.levels.length - 1 ? <ArrowRight className="h-3.5 w-3.5" /> : null}
                  </div>
                ))
              ) : (
                <span className="text-slate-500">Sem fluxo configurado ainda.</span>
              )}
            </div>
          </Card>
        </div>
      </div>

      <div className="sticky bottom-4 z-20 rounded-2xl border border-amber-500/30 bg-slate-950/95 p-4 shadow-2xl shadow-black/30 backdrop-blur">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-amber-300">Designacao</p>
            <p className={`mt-2 text-base ${isDesignationTooLong ? "text-red-300" : "text-slate-100"}`}>
              {designation || "Seleciona os campos para construir a designacao final."}
            </p>
            {designation ? (
              <p className={`mt-2 text-xs ${isDesignationTooLong ? "text-red-300" : "text-slate-400"}`}>
                {designationLength}/{MAX_DESIGNATION_LENGTH} caracteres
                {isDesignationTooLong ? " - limite excedido" : ""}
              </p>
            ) : null}
          </div>
          <Button
            disabled={!hasConfiguredLevels || completedCount !== family.levels.length || isDesignationTooLong}
          >
            Gerar SKU
          </Button>
        </div>
      </div>
    </div>
  );
}
