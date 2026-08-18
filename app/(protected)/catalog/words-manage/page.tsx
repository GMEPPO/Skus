import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { WordCatalogWorkspace } from "@/components/catalog/word-catalog-workspace";
import { deleteWordAction, getFieldTypeOptions } from "@/lib/admin-catalog";

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
  const fieldTypes = await getFieldTypeOptions();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-50">Biblioteca</h1>
        <p className="mt-2 text-sm text-slate-400">
          Consulta e edita palavras existentes. Para criar novas palavras usa o botao + em cada nivel no{" "}
          <Link href="/generator" className="text-amber-300 hover:underline">
            Gerador SKU
          </Link>
          .
        </p>
      </div>

      {searchParams?.message ? (
        <div className={`rounded-lg border px-4 py-3 text-sm ${messageStyles(searchParams.status)}`}>
          {searchParams.message}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Catalogo atual</CardTitle>
          <CardDescription>
            20 palavras por pagina, com busca global e ranking de palavras em alertas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <WordCatalogWorkspace fieldTypes={fieldTypes} deleteAction={deleteWordAction} />
        </CardContent>
      </Card>
    </div>
  );
}
