import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createWordAction, getFamilyOptions, getFieldTypeOptions, getWordsCatalog } from "@/lib/admin-catalog";

function messageStyles(status?: string) {
  if (status === "error") {
    return "border-red-500/40 bg-red-500/10 text-red-100";
  }
  return "border-emerald-500/40 bg-emerald-500/10 text-emerald-100";
}

export default async function CatalogWordsManagePage({
  searchParams,
}: {
  searchParams?: { status?: string; message?: string };
}) {
  const [words, fieldTypes, families] = await Promise.all([
    getWordsCatalog(),
    getFieldTypeOptions(),
    getFamilyOptions(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-50">Vocabulario</h1>
        <p className="mt-2 text-sm text-slate-400">
          Cria e gere palavras reutilizaveis, referencias, designacoes e associacoes por familia.
        </p>
      </div>

      {searchParams?.message ? (
        <div className={`rounded-lg border px-4 py-3 text-sm ${messageStyles(searchParams.status)}`}>
          {searchParams.message}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Nova palavra</CardTitle>
          <CardDescription>
            Cria uma nova variavel para ser usada nas familias e no gerador de SKU.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createWordAction} className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <label className="space-y-2">
              <span className="text-sm text-slate-300">Palavra</span>
              <input
                name="label"
                required
                className="flex h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
                placeholder="Ex: Frasco"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm text-slate-300">Referencia</span>
              <input
                name="referenceCode"
                required
                minLength={3}
                maxLength={3}
                className="flex h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm uppercase text-slate-100"
                placeholder="FRA"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm text-slate-300">Tipo de campo</span>
              <select
                name="fieldTypeId"
                required
                className="flex h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
              >
                <option value="">Selecionar...</option>
                {fieldTypes.map((fieldType) => (
                  <option key={fieldType.id} value={fieldType.id}>
                    {fieldType.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2">
              <span className="text-sm text-slate-300">Designacao</span>
              <input
                name="designation"
                required
                className="flex h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
                placeholder="Texto que pode aparecer na designacao final"
              />
            </label>
            <label className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-950/60 px-4 py-3 md:col-span-2 xl:col-span-1">
              <input
                type="checkbox"
                name="includeInDesignation"
                defaultChecked
                className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-amber-400 focus:ring-amber-400"
              />
              <div>
                <p className="text-sm font-medium text-slate-100">Incluir na designacao final</p>
                <p className="text-xs text-slate-400">
                  Desativa se esta palavra so deve entrar na referencia/codigo.
                </p>
              </div>
            </label>
            <label className="space-y-2 md:col-span-2 xl:col-span-3">
              <span className="text-sm text-slate-300">Familias associadas</span>
              <select
                name="familyIds"
                multiple
                className="min-h-[10rem] w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-slate-100"
              >
                {families.map((family) => (
                  <option key={family.id} value={family.id}>
                    {family.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-500">
                Podes selecionar uma ou varias familias. Em Windows usa `Ctrl` para selecao multipla.
              </p>
            </label>
            <div className="md:col-span-2 xl:col-span-3">
              <Button type="submit">Guardar palavra</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Catalogo atual</CardTitle>
          <CardDescription>
            Lista atual de palavras disponiveis no sistema.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {words.map((word) => (
            <div
              key={word.id}
              className="grid gap-4 rounded-xl border border-slate-700 bg-slate-900/50 p-4 md:grid-cols-[1.2fr_auto_auto_1fr]"
            >
              <div>
                <p className="font-medium text-slate-100">{word.label}</p>
                <p className="text-sm text-slate-400">Designacao: {word.designation || "Sem designacao"}</p>
              </div>
              <Badge variant="outline">{word.referenceCode}</Badge>
              <Badge>{word.fieldTypeLabel}</Badge>
              <div className="space-y-2 text-sm text-slate-400">
                <div>{word.includeInDesignation ? "Entra na designacao" : "So entra no codigo"}</div>
                <div>{word.familyLabels.length > 0 ? word.familyLabels.join(", ") : "Sem familias associadas"}</div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
