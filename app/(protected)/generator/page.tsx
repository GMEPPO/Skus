import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SkuGeneratorWizardMain } from "@/components/generator/sku-generator-wizard-main";
import { getGeneratorFamilies } from "@/lib/generator-data";

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
  const families = await getGeneratorFamilies();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-50">Gerador de SKU</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-400">
          Fluxo dependente por árvore configurável, com designação em tempo real e preview do código final.
        </p>
      </div>

      {searchParams?.message ? (
        <div className={`rounded-lg border px-4 py-3 text-sm ${messageStyles(searchParams.status)}`}>
          {searchParams.message}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Wizard de composição</CardTitle>
          <CardDescription>
            O exemplo abaixo já replica o comportamento principal pedido: seleção encadeada,
            designação automática e proposta de SKU sequencial.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SkuGeneratorWizardMain families={families} />
        </CardContent>
      </Card>
    </div>
  );
}
