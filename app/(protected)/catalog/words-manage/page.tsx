import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { WordForm } from "@/components/catalog/word-form";
import {
  createWordAction,
  deleteWordAction,
  getFamilyOptions,
  getFieldTypeOptions,
  getWordDependencyOptions,
  getWordsCatalog,
} from "@/lib/admin-catalog";

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
  const [words, fieldTypes, families, dependencyOptions] = await Promise.all([
    getWordsCatalog(),
    getFieldTypeOptions(),
    getFamilyOptions(),
    getWordDependencyOptions(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-50">Biblioteca</h1>
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
            Cria uma nova palavra para ser usada nas familias e no gerador de SKU.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <WordForm
            action={createWordAction}
            submitLabel="Guardar palavra"
            fieldTypes={fieldTypes}
            families={families}
            dependencyOptions={dependencyOptions}
            initialValues={{
              label: "",
              referenceCode: "",
              fieldTypeId: "",
              designation: "",
              includeInDesignation: true,
              familyIds: [],
              parentWordIds: [],
            }}
          />
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
              className="grid gap-4 rounded-xl border border-slate-700 bg-slate-900/50 p-4 md:grid-cols-[1.2fr_auto_auto_1fr_auto_auto]"
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
                {word.parentWordLabels.length > 0 ? <div>Depende de: {word.parentWordLabels.join(", ")}</div> : null}
              </div>
              <Button asChild variant="outline">
                <Link href={`/catalog/words-manage/${word.id}`}>Editar palavra</Link>
              </Button>
              <form action={deleteWordAction}>
                <input type="hidden" name="wordId" value={word.id} />
                <Button type="submit" variant="outline" className="text-red-100 hover:bg-red-500/10">
                  Eliminar palavra
                </Button>
              </form>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
