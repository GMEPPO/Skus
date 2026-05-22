import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getRecentSkuGenerations } from "@/lib/data";

export default async function SkuHistoryPage() {
  const rows = await getRecentSkuGenerations();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-50">Historico de SKUs</h1>
        <p className="mt-2 text-sm text-slate-400">
          Lista de codigos gerados, designacoes finais, snapshot de selecao e dados logisticos.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Registos recentes</CardTitle>
          <CardDescription>Historico criado pelo gerador global de seis niveis.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {rows.length > 0 ? (
            rows.map((row) => (
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
                      Caixa: {row.unitsPerBox ?? "-"} ({row.unitsPerBoxStatus ?? "-"}) | Multiplos: {row.multiples ?? "-"} (
                      {row.multiplesStatus ?? "-"}) | Peso: {row.weight ?? "-"} ({row.weightStatus ?? "-"})
                    </p>
                  </div>
                  <p className="text-sm text-slate-500">
                    {row.createdByName ?? "Sem utilizador"} | {row.createdAtLabel}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/30 p-4 text-sm text-slate-500">
              Sem SKUs gerados ainda.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
