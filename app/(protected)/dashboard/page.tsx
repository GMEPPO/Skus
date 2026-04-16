import { BarChart3, Boxes, ShieldCheck, Tags } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getDashboardSummary, getRecentSkuGenerations } from "@/lib/data";

export default async function DashboardPage() {
  const summary = await getDashboardSummary();
  const recent = await getRecentSkuGenerations();

  const items = [
    { label: "Famílias ativas", value: summary.activeFamilies, icon: Boxes },
    { label: "Palavras no catálogo", value: summary.words, icon: Tags },
    { label: "SKUs gerados", value: summary.generatedSkus, icon: BarChart3 },
    { label: "Utilizadores ativos", value: summary.activeUsers, icon: ShieldCheck },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-50">Dashboard</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-400">
          Vista geral da nova plataforma `Skus Administrator`, já organizada para administração,
          configuração das árvores e geração de códigos sequenciais.
        </p>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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
              Últimos códigos gerados com snapshot da designação e família usada.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {recent.map((entry) => (
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
                  <Badge>{entry.familyName}</Badge>
                  <span className="text-xs text-slate-500">{entry.createdAtLabel}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Estado do MVP</CardTitle>
            <CardDescription>
              Estrutura inicial pronta para crescer sem rebentar a modelação.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-300">
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
              Shell protegida, navegação administrativa e base visual alinhadas com a plataforma existente.
            </div>
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
              Gerador com fluxo dependente e barra de designação em tempo real já implementados em modo demo.
            </div>
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
              Persistência Supabase e ações administrativas já estão modeladas no schema, prontas para ligação.
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
