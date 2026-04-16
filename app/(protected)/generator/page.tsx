import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SkuGeneratorWizardMain } from "@/components/generator/sku-generator-wizard-main";
import { getGeneratorFamilies } from "@/lib/generator-data";

export default async function GeneratorPage() {
  const families = await getGeneratorFamilies();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-50">Gerador de SKU</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-400">
          Fluxo dependente por árvore configurável, com designação em tempo real e preview do código final.
        </p>
      </div>

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
