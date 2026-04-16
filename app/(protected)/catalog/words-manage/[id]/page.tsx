import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { WordForm } from "@/components/catalog/word-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getFamilyOptions,
  getFieldTypeOptions,
  getWordDependencyOptions,
  getWordsCatalog,
  updateWordAction,
} from "@/lib/admin-catalog";

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
  const [words, fieldTypes, families, dependencyOptions] = await Promise.all([
    getWordsCatalog(),
    getFieldTypeOptions(),
    getFamilyOptions(),
    getWordDependencyOptions(),
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
          <WordForm
            action={updateWordAction}
            submitLabel="Guardar alteracoes"
            cancelHref="/catalog/words-manage"
            fieldTypes={fieldTypes}
            families={families}
            dependencyOptions={dependencyOptions.filter((option) => option.id !== word.id)}
            initialValues={{
              wordId: word.id,
              label: word.label,
              referenceCode: word.referenceCode,
              fieldTypeId: word.fieldTypeId,
              designationPt: word.designationPt,
              designationEs: word.designationEs,
              designationEn: word.designationEn,
              includeInDesignation: word.includeInDesignation,
              familyIds: word.familyIds,
              parentWordIds: word.parentWordIds,
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
