import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getFamilyOptions, getFieldTypeOptions, getWordsCatalog, updateWordAction } from "@/lib/admin-catalog";

function messageStyles(status?: string) {
  if (status === "error") {
    return "border-red-500/40 bg-red-500/10 text-red-100";
  }
  return "border-emerald-500/40 bg-emerald-500/10 text-emerald-100";
}

export default async function EditWordPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { status?: string; message?: string };
}) {
  const [words, fieldTypes, families] = await Promise.all([
    getWordsCatalog(),
    getFieldTypeOptions(),
    getFamilyOptions(),
  ]);

  const word = words.find((item) => item.id === params.id);
  if (!word) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/catalog/words-manage"
          className="mb-3 inline-flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar a biblioteca
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-50">Editar palavra</h1>
        <p className="mt-2 text-sm text-slate-400">
          Atualiza dados da palavra, tipo de campo e familias onde ela pode ser usada.
        </p>
      </div>

      {searchParams?.message ? (
        <div className={`rounded-lg border px-4 py-3 text-sm ${messageStyles(searchParams.status)}`}>
          {searchParams.message}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{word.label}</CardTitle>
          <CardDescription>Qualquer alteracao sera aplicada ao builder e ao gerador de SKU.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={updateWordAction} className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <input type="hidden" name="wordId" value={word.id} />

            <label className="space-y-2">
              <span className="text-sm text-slate-300">Palavra</span>
              <input
                name="label"
                required
                defaultValue={word.label}
                className="flex h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm text-slate-300">Referencia</span>
              <input
                name="referenceCode"
                required
                minLength={3}
                maxLength={3}
                defaultValue={word.referenceCode}
                className="flex h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm uppercase text-slate-100"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm text-slate-300">Tipo de campo</span>
              <select
                name="fieldTypeId"
                required
                defaultValue={word.fieldTypeId}
                className="flex h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
              >
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
                defaultValue={word.designation}
                className="flex h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
              />
            </label>

            <label className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-950/60 px-4 py-3 md:col-span-2 xl:col-span-1">
              <input
                type="checkbox"
                name="includeInDesignation"
                defaultChecked={word.includeInDesignation}
                className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-amber-400 focus:ring-amber-400"
              />
              <div>
                <p className="text-sm font-medium text-slate-100">Incluir na designacao final</p>
                <p className="text-xs text-slate-400">Desativa se esta palavra so deve entrar na referencia/codigo.</p>
              </div>
            </label>

            <label className="space-y-2 md:col-span-2 xl:col-span-3">
              <span className="text-sm text-slate-300">Familias associadas</span>
              <select
                name="familyIds"
                multiple
                defaultValue={word.familyIds}
                className="min-h-[10rem] w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-slate-100"
              >
                {families.map((family) => (
                  <option key={family.id} value={family.id}>
                    {family.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex gap-3 md:col-span-2 xl:col-span-3">
              <Button type="submit">Guardar alteracoes</Button>
              <Button asChild variant="outline">
                <Link href="/catalog/words-manage">Cancelar</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
