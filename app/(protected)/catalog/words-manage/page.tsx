import Link from "next/link";
import { Suspense } from "react";
import { WordCatalogExportButton } from "@/components/catalog/word-catalog-export-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SearchParamsFlashMessage } from "@/components/ui/search-params-flash-message";
import { WordCatalogWorkspace } from "@/components/catalog/word-catalog-workspace";
import { deleteWordAction, getFieldTypeOptions } from "@/lib/admin-catalog";

export default async function CatalogWordsManagePage() {
  const fieldTypes = await getFieldTypeOptions();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
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
        <WordCatalogExportButton />
      </div>
      <Suspense fallback={null}>
        <SearchParamsFlashMessage />
      </Suspense>

      <Card>
        <CardHeader>
          <CardTitle>Catalogo atual</CardTitle>
          <CardDescription>
            20 palavras por pagina. A busca procura em todo o catalogo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <WordCatalogWorkspace fieldTypes={fieldTypes} deleteAction={deleteWordAction} />
        </CardContent>
      </Card>
    </div>
  );
}
