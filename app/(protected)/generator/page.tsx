import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GeneratorWorkspace } from "@/components/generator/generator-workspace";
import { getCategories, getGeneratorCatalogForCategory } from "@/lib/category-catalog";
import { mapCategoryCatalogToGeneratorCatalog } from "@/lib/generator-catalog-mapper";
import { requireRole } from "@/lib/auth";
import { isNormalizationV2Enabled, isSecureGenerationV2Enabled } from "@/lib/skus-feature-flags";

function messageStyles(status?: string) {
  if (status === "error") {
    return "border-red-500/40 bg-red-500/10 text-red-100";
  }
  return "border-emerald-500/40 bg-emerald-500/10 text-emerald-100";
}

export default async function GeneratorPage({
  searchParams,
}: {
  searchParams?: { status?: string; message?: string };
}) {
  await requireRole("editor");
  const secureGenerationV2Enabled = isSecureGenerationV2Enabled();
  const normalizationV2Enabled = isNormalizationV2Enabled();
  const categories = await getCategories();
  const preferredCategory = categories.find((category) => category.slug === "cosmetica") ?? categories[0] ?? null;
  const categoryCatalog = preferredCategory ? await getGeneratorCatalogForCategory(preferredCategory.id) : null;

  if (!preferredCategory || !categoryCatalog) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-50">Gerador de SKU</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-400">
            Biblioteca global de 6 niveis, com designacao em tempo real e preview do codigo final.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Configuracao em falta</CardTitle>
            <CardDescription>
              Nao foi possivel resolver uma categoria ativa para o gerador. Verifica a configuracao de categorias.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const catalog = mapCategoryCatalogToGeneratorCatalog(categoryCatalog);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-50">Gerador de SKU</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-400">
          Cria SKUs novos ou normaliza referencias importadas no mesmo wizard. Usa o painel lateral para filtrar
          pendentes por referencia ou designacao.
        </p>
      </div>

      {searchParams?.message ? (
        <div className={`rounded-lg border px-4 py-3 text-sm ${messageStyles(searchParams.status)}`}>
          {searchParams.message}
        </div>
      ) : null}

      <GeneratorWorkspace
        categories={categories.map((category) => ({ id: category.id, name: category.name, slug: category.slug }))}
        initialCategoryId={preferredCategory.id}
        initialCatalog={catalog}
        secureGenerationV2Enabled={secureGenerationV2Enabled}
        normalizationV2Enabled={normalizationV2Enabled}
      />
    </div>
  );
}
