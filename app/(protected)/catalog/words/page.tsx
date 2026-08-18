import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { WordCatalogList } from "@/components/catalog/word-catalog-list";
import { getFieldTypeOptions, getWordsCatalog } from "@/lib/admin-catalog";

export default async function CatalogWordsPage() {
  const [words, fieldTypes] = await Promise.all([
    getWordsCatalog(),
    getFieldTypeOptions(),
  ]);

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
            Busca por palavra, referencia ou designacao em PT, ES e EN.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <WordCatalogList words={words} fieldTypes={fieldTypes} showManageActions={false} />
        </CardContent>
      </Card>
    </div>
  );
}
