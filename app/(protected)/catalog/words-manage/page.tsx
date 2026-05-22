import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { WordCatalogList } from "@/components/catalog/word-catalog-list";
import { WordForm } from "@/components/catalog/word-form";
import {
  createWordAction,
  deleteWordAction,
  getFieldTypeOptions,
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
  const [words, fieldTypes] = await Promise.all([
    getWordsCatalog(),
    getFieldTypeOptions(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-50">Biblioteca</h1>
        <p className="mt-2 text-sm text-slate-400">
          Cria e gere palavras globais por nivel. O gerador usa diretamente esta biblioteca.
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
            Cada palavra pertence a um dos seis niveis: marca, formato, produto, tamanho, embalagem ou extra.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <WordForm
            action={createWordAction}
            submitLabel="Guardar palavra"
            fieldTypes={fieldTypes}
            initialValues={{
              label: "",
              referenceCode: "",
              fieldTypeId: "",
              designationPt: "",
              designationEs: "",
              designationEn: "",
              includeInDesignation: true,
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Catalogo atual</CardTitle>
          <CardDescription>
            Lista agrupada por nivel, com busca por palavra, codigo e designacoes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <WordCatalogList words={words} fieldTypes={fieldTypes} deleteAction={deleteWordAction} />
        </CardContent>
      </Card>
    </div>
  );
}
