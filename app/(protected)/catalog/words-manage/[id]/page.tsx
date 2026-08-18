import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { WordForm } from "@/components/catalog/word-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getFieldTypeOptions,
  getParentLevelsForWordEdit,
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
  const [words, fieldTypes] = await Promise.all([
    getWordsCatalog(),
    getFieldTypeOptions(),
  ]);

  const word = words.find((item) => item.id === params.id);
  if (!word) {
    notFound();
  }

  const parentLevels = await getParentLevelsForWordEdit(word.categoryLevelId);
  const showHierarchyField =
    word.fieldTypeLabel.toLowerCase().includes("embal") || word.fieldTypeLabel.toLowerCase().includes("extra");

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
          Atualiza o nivel, referencia, designacoes e dependencias usadas pelo gerador.
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
          <CardDescription>Qualquer alteracao aparece no gerador depois de guardar.</CardDescription>
        </CardHeader>
        <CardContent>
          <WordForm
            action={updateWordAction}
            submitLabel="Guardar alteracoes"
            cancelHref="/catalog/words-manage"
            fieldTypes={fieldTypes}
            categoryLevelId={word.categoryLevelId ?? undefined}
            parentLevels={parentLevels}
            showHierarchyField={showHierarchyField}
            initialValues={{
              wordId: word.id,
              label: word.label,
              referenceCode: word.referenceCode,
              fieldTypeId: word.fieldTypeId,
              designationPt: word.designationPt,
              designationEs: word.designationEs,
              designationEn: word.designationEn,
              includeInDesignation: word.includeInDesignation,
              visibilityMode: word.parentWordIds.length > 0 ? "conditional" : "always",
              parentWordIds: word.parentWordIds,
              parentMatchMode: word.parentMatchMode,
              selectionHierarchy: word.selectionHierarchy,
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
