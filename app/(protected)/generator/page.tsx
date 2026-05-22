import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SkuGeneratorWizardMain } from "@/components/generator/sku-generator-wizard-main";
import { getGeneratorCatalog } from "@/lib/generator-data";

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
  const catalog = await getGeneratorCatalog();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-50">Gerador de SKU</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-400">
          Biblioteca global de 6 niveis, com designacao em tempo real e preview do codigo final.
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
          <SkuGeneratorWizardMain catalog={catalog} />
        </CardContent>
      </Card>
    </div>
  );
}

