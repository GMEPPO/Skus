import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createWordAction, getFieldTypeOptions, getWordsCatalog } from "@/lib/admin-catalog";

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
  const [words, fieldTypes] = await Promise.all([
    getWordsCatalog(),
    getFieldTypeOptions(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-50">Vocabulario</h1>
        <p className="mt-2 text-sm text-slate-400">
          Cria e gere palavras reutilizaveis, referencias e contextos a partir da interface administrativa.
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
              <span className="text-sm text-slate-300">Descricao</span>
              <input
                name="description"
                className="flex h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
                placeholder="Descricao opcional"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm text-slate-300">Tipo de contexto</span>
              <input
                name="contextType"
                className="flex h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
                placeholder="Ex: brand"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm text-slate-300">Valor de contexto</span>
              <input
                name="contextValue"
                className="flex h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
                placeholder="Ex: Guerla"
              />
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
                <p className="text-sm text-slate-400">{word.description || "Sem descricao"}</p>
              </div>
              <Badge variant="outline">{word.referenceCode}</Badge>
              <Badge>{word.fieldTypeLabel}</Badge>
              <div className="text-sm text-slate-400">{word.contextLabel}</div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
