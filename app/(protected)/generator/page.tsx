import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SkuGeneratorWizardMain } from "@/components/generator/sku-generator-wizard-main";
import { getCategories, getGeneratorCatalogForCategory } from "@/lib/category-catalog";
import { isSecureGenerationV2Enabled } from "@/lib/skus-feature-flags";
import type { GeneratorCatalog } from "@/lib/types";

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
  const secureGenerationV2Enabled = isSecureGenerationV2Enabled();
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
              Nao foi possivel resolver uma categoria ativa para o gerador. Verifica a configuracao de categorias antes
              de ativar a UI V2.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const catalog: GeneratorCatalog = {
    levels: categoryCatalog.levels.map((level, index) => ({
      id: level.id,
      order: index + 1,
      fieldType: level.key,
      label: level.label,
      options: level.options.map((option) => ({
        id: option.id,
        label: option.label,
        referenceCode: option.referenceCode,
        designation: option.designationPt,
        designationPt: option.designationPt,
        designationEs: option.designationEs,
        designationEn: option.designationEn,
        includeInDesignation: option.includeInDesignation,
      })),
    })),
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-50">Gerador de SKU</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-400">
          Biblioteca global de 6 niveis, com designacao em tempo real e preview do codigo final.
        </p>
        <p className="mt-2 text-xs uppercase tracking-[0.2em] text-slate-500">
          Categoria ativa: {categoryCatalog.category.name} ({categoryCatalog.category.slug})
        </p>
      </div>

      {searchParams?.message ? (
        <div className={`rounded-lg border px-4 py-3 text-sm ${messageStyles(searchParams.status)}`}>
          {searchParams.message}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Wizard de composicao</CardTitle>
          <CardDescription>
            Procura e seleciona palavras por nivel para construir a referencia final.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SkuGeneratorWizardMain
            catalog={catalog}
            secureGenerationV2Enabled={secureGenerationV2Enabled}
            categoryId={categoryCatalog.category.id}
          />
        </CardContent>
      </Card>
    </div>
  );
}
