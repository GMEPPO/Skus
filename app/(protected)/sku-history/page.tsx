import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getRecentSkuGenerations } from "@/lib/data";

export default async function SkuHistoryPage() {
  const rows = await getRecentSkuGenerations();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-50">Histórico de SKUs</h1>
        <p className="mt-2 text-sm text-slate-400">
          Lista de códigos gerados, designações finais e contexto da família usada.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Registos recentes</CardTitle>
          <CardDescription>Pronto para ser ligado à tabela `sku_generations`.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {rows.map((row) => (
            <div key={row.id} className="rounded-xl border border-slate-700 bg-slate-900/50 p-4">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                {row.productImageUrl ? (
                  <img
                    src={row.productImageUrl}
                    alt={`Imagem do produto ${row.generatedCode}`}
                    className="h-28 w-28 rounded-xl border border-slate-700 object-cover"
                  />
                ) : null}
                <div>
                  <p className="font-medium text-slate-100">{row.generatedCode}</p>
                  <p className="text-sm text-slate-400">{row.designation}</p>
                  <p className="mt-2 text-xs text-slate-500">
                    Caixa: {row.unitsPerBox ?? "-"} ({row.unitsPerBoxStatus ?? "-"}) • Multiplos: {row.multiples ?? "-"} (
                    {row.multiplesStatus ?? "-"}) • Peso: {row.weight ?? "-"} ({row.weightStatus ?? "-"})
                  </p>
                </div>
                <p className="text-sm text-slate-500">
                  {row.familyName} • {row.createdByName ?? "Sem utilizador"} • {row.createdAtLabel}
                </p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
