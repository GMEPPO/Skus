import { BarChart3, Hash, ShieldCheck, Tags } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getDashboardSummary, getRecentSkuGenerations } from "@/lib/data";

function formatCounter(value: number): string {
  return new Intl.NumberFormat("pt-PT").format(value);
}

export default async function DashboardPage() {
  const summary = await getDashboardSummary();
  const recent = await getRecentSkuGenerations();

  const items = [
    { label: "Marcas ativas", value: formatCounter(summary.activeBrands), icon: Tags },
    { label: "Palavras no catalogo", value: formatCounter(summary.words), icon: Tags },
    { label: "SKUs gerados", value: formatCounter(summary.generatedSkus), icon: BarChart3 },
    {
      label: "Referencias 3 chars disponiveis",
      value: formatCounter(summary.availableThreeCharReferences),
      icon: Hash,
      hint: `${formatCounter(summary.threeCharReferencesUsed)} ocupadas de ${formatCounter(summary.threeCharReferenceCapacity)} (${summary.threeCharReferenceLevels} niveis, A-Z 0-9)`,
    },
    { label: "Utilizadores ativos", value: formatCounter(summary.activeUsers), icon: ShieldCheck },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-50">Dashboard</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-400">
          Vista geral da biblioteca global de seis niveis e dos SKUs gerados.
        </p>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.label}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm font-medium text-slate-300">{item.label}</CardTitle>
                <Icon className="h-4 w-4 text-amber-300" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-semibold text-slate-50">{item.value}</div>
                {"hint" in item && item.hint ? (
                  <p className="mt-2 text-xs leading-relaxed text-slate-500">{item.hint}</p>
                ) : null}
              </CardContent>
            </Card>
          );
        })}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Atividade recente</CardTitle>
            <CardDescription>
              Ultimos codigos gerados com snapshot da designacao e dados logisticos.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {recent.length > 0 ? (
              recent.map((entry) => (
                <div
                  key={entry.id}
                  className="flex flex-col gap-2 rounded-xl border border-slate-700 bg-slate-900/50 p-4 md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <p className="font-medium text-slate-100">{entry.generatedCode}</p>
                    <p className="text-sm text-slate-400">{entry.designation}</p>
                    <p className="text-xs text-slate-500">Criado por: {entry.createdByName ?? "Sem utilizador"}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">Global</Badge>
                    <span className="text-xs text-slate-500">{entry.createdAtLabel}</span>
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

        <Card>
          <CardHeader>
            <CardTitle>Modelo atual</CardTitle>
            <CardDescription>Biblioteca global sem familias, arvores ou dependencias.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-300">
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
              O primeiro nivel e a marca/familia; depois entram formato, produto, tamanho, embalagem e extra.
            </div>
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
              Todas as palavras ativas aparecem no gerador dentro do seu nivel, com busca independente.
            </div>
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
              O historico antigo deve ser resetado ao executar o novo SQL de migracao.
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
