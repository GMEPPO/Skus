import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { WordCatalogWorkspace } from "@/components/catalog/word-catalog-workspace";
import { getFieldTypeOptions } from "@/lib/admin-catalog";

export default async function CatalogWordsPage() {
  const fieldTypes = await getFieldTypeOptions();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-50">Biblioteca</h1>
        <p className="mt-2 text-sm text-slate-400">
          Catalogo global de palavras usado pelo gerador SKU.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Palavras por nivel</CardTitle>
          <CardDescription>
            20 palavras por pagina. A busca procura em todo o catalogo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <WordCatalogWorkspace fieldTypes={fieldTypes} showManageActions={false} />
        </CardContent>
      </Card>
    </div>
  );
}
