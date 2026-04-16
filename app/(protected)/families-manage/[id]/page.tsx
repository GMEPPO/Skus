import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Boxes, GitBranchPlus, Layers3, Link2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  attachWordToFamilyLevelAction,
  createFamilyDraftTreeAction,
  getFamilyBuilderDetail,
  getWordsCatalog,
  updateFamilyLevelLabelAction,
} from "@/lib/admin-catalog";

function messageStyles(status?: string) {
  if (status === "error") {
    return "border-red-500/40 bg-red-500/10 text-red-100";
  }
  return "border-emerald-500/40 bg-emerald-500/10 text-emerald-100";
}

export default async function FamilyBuilderDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { status?: string; message?: string };
}) {
  const [family, words] = await Promise.all([
    getFamilyBuilderDetail(params.id),
    getWordsCatalog(),
  ]);

  if (!family) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/families-manage"
            className="mb-3 inline-flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar a familias
          </Link>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-50">{family.name}</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-400">
            Configura os niveis reais da familia, associa palavras a cada passo e prepara a base para as
            relacoes dependentes.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Badge variant={family.status === "active" ? "success" : "outline"}>{family.status}</Badge>
          <div className="rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-xs text-slate-300">
            slug: {family.slug}
          </div>
        </div>
      </div>

      {searchParams?.message ? (
        <div className={`rounded-lg border px-4 py-3 text-sm ${messageStyles(searchParams.status)}`}>
          {searchParams.message}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Resumo da familia</CardTitle>
            <CardDescription>
              O draft controla a configuracao em curso. Quando ainda nao existe, cria-o primeiro.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-xl border border-slate-700 bg-slate-900/50 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Descricao</p>
                <p className="mt-2 text-sm text-slate-200">{family.description || "Sem descricao"}</p>
              </div>
              <div className="rounded-xl border border-slate-700 bg-slate-900/50 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Draft atual</p>
                <p className="mt-2 text-sm text-slate-200">
                  {family.draftTreeVersionId ? "Disponivel para edicao" : "Ainda nao existe"}
                </p>
              </div>
              <div className="rounded-xl border border-slate-700 bg-slate-900/50 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Niveis configurados</p>
                <p className="mt-2 text-sm text-slate-200">{family.levels.length}</p>
              </div>
            </div>

            {!family.draftTreeVersionId ? (
              <form action={createFamilyDraftTreeAction}>
                <input type="hidden" name="familyId" value={family.id} />
                <Button type="submit" className="inline-flex items-center gap-2">
                  <GitBranchPlus className="h-4 w-4" />
                  Criar draft do builder
                </Button>
              </form>
            ) : (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-100">
                Este draft ja pode receber niveis e palavras.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Biblioteca disponivel</CardTitle>
            <CardDescription>
              Estas palavras podem ser reutilizadas em qualquer nivel da familia.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {words.length > 0 ? (
              words.map((word) => (
                <div
                  key={word.id}
                  className="rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-xs text-slate-300"
                >
                  {word.label} - {word.referenceCode}
                </div>
              ))
            ) : (
              <div className="rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-2 text-sm text-slate-500">
                Ainda nao existem palavras na biblioteca.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Builder da familia</CardTitle>
            <CardDescription>
              Aqui ja editas niveis reais. O passo seguinte sera ligar dependencias entre palavras.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {family.levels.length > 0 ? (
              family.levels.map((level) => {
                const usedWordIds = new Set(level.words.map((word) => word.id));
                const previousLevel = family.levels.find((item) => item.order === level.order - 1);
                const previousLevelWordIds = new Set(previousLevel?.words.map((word) => word.id) ?? []);
                const availableWords = words.filter(
                  (word) =>
                    !usedWordIds.has(word.id) &&
                    word.fieldTypeId === level.fieldTypeId &&
                    word.familyIds.includes(family.id) &&
                    (level.order === 1 || word.parentWordIds.some((parentWordId) => previousLevelWordIds.has(parentWordId))),
                );
                const hasAvailableWords = availableWords.length > 0;

                return (
                  <div key={level.id} className="rounded-xl border border-slate-700 bg-slate-900/50 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-wide text-slate-500">Nivel {level.order}</p>
                        <p className="text-lg font-medium text-slate-100">{level.label}</p>
                        <p className="text-sm text-slate-400">{level.fieldTypeName}</p>
                      </div>
                      <div className="rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-xs text-slate-300">
                        {level.words.length} palavras
                      </div>
                    </div>

                    <form action={updateFamilyLevelLabelAction} className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
                      <input type="hidden" name="familyId" value={family.id} />
                      <input type="hidden" name="treeLevelId" value={level.id} />
                      <input type="hidden" name="defaultLabel" value={level.fieldTypeName} />
                      <input
                        name="labelOverride"
                        defaultValue={level.label === level.fieldTypeName ? "" : level.label}
                        placeholder={`Etiqueta para ${level.fieldTypeName}`}
                        className="flex h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
                      />
                      <Button type="submit" variant="outline">
                        Guardar etiqueta
                      </Button>
                    </form>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {level.words.length > 0 ? (
                        level.words.map((word) => (
                          <div
                            key={word.id}
                            className="rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-xs text-slate-200"
                          >
                            {word.label} - {word.referenceCode}
                          </div>
                        ))
                      ) : (
                        <div className="rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2 text-sm text-slate-500">
                          Ainda nao existem palavras neste nivel.
                        </div>
                      )}
                    </div>

                    <form action={attachWordToFamilyLevelAction} className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
                      <input type="hidden" name="familyId" value={family.id} />
                      <input type="hidden" name="treeLevelId" value={level.id} />
                      <select
                        name="wordId"
                        required
                        disabled={!hasAvailableWords}
                        className="flex h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
                      >
                        {hasAvailableWords ? (
                          <>
                            <option value="">Associar palavra a este nivel</option>
                            {availableWords.map((word) => (
                              <option key={word.id} value={word.id}>
                                {word.label} - {word.referenceCode} - {word.fieldTypeLabel}
                              </option>
                            ))}
                          </>
                        ) : (
                          <option value="">Sem palavras disponiveis para este nivel</option>
                        )}
                      </select>
                      <Button type="submit" variant="outline" disabled={!hasAvailableWords}>
                        Associar palavra
                      </Button>
                    </form>
                  </div>
                );
              })
            ) : (
              <div className="rounded-xl border border-dashed border-slate-700 bg-slate-950/40 p-6 text-sm text-slate-400">
                Ainda nao existem niveis neste draft. Cria o draft e os 5 niveis obrigatorios vao aparecer automaticamente.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Preview configurado</CardTitle>
            <CardDescription>
              Este preview ja reflete a estrutura que configuraste para esta familia.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl border border-dashed border-slate-700 bg-slate-950/40 p-4">
              <div className="mb-3 flex items-center gap-2 text-amber-300">
                <Boxes className="h-4 w-4" />
                <span className="text-sm font-medium">Fluxo atual da familia</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {family.levels.length > 0 ? (
                  family.levels.map((level) => (
                    <div
                      key={level.id}
                      className="rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-xs text-slate-300"
                    >
                      Nivel {level.order}: {level.label}
                    </div>
                  ))
                ) : (
                  <span className="text-sm text-slate-500">Sem niveis configurados ainda.</span>
                )}
              </div>
            </div>

            <div className="space-y-3">
              {family.levels.length > 0 ? (
                family.levels.map((level) => (
                  <div key={level.id} className="rounded-xl border border-slate-700 bg-slate-900/50 p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <Layers3 className="h-4 w-4 text-slate-400" />
                      <div>
                        <p className="text-xs uppercase tracking-wide text-slate-500">Nivel {level.order}</p>
                        <p className="font-medium text-slate-100">{level.label}</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {level.words.length > 0 ? (
                        level.words.map((word) => (
                          <div
                            key={word.id}
                            className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2 text-sm text-slate-300"
                          >
                            <span>{word.label}</span>
                            <span className="text-xs text-slate-500">{word.referenceCode}</span>
                          </div>
                        ))
                      ) : (
                        <div className="rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2 text-sm text-slate-500">
                          Nivel vazio.
                        </div>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-dashed border-slate-700 bg-slate-950/40 p-6 text-sm text-slate-400">
                  O preview vai aparecer aqui assim que criares niveis e comecares a associar palavras.
                </div>
              )}
            </div>

            <div className="rounded-xl border border-slate-700 bg-slate-900/50 p-4">
              <div className="mb-2 flex items-center gap-2 text-slate-300">
                <Link2 className="h-4 w-4" />
                <span className="text-sm font-medium">Proximo passo</span>
              </div>
              <p className="text-sm text-slate-400">
                Depois desta estrutura base, o builder vai ganhar relacoes entre palavras para limitar o passo
                seguinte em funcao da selecao anterior.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
