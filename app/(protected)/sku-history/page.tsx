import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SkuHistoryExportButton } from "@/components/sku-history/sku-history-export-button";
import { SkuHistoryList } from "@/components/sku-history/sku-history-list";
import { requireRole } from "@/lib/auth";
import { getRecentSkuGenerations } from "@/lib/data";
import { hasMinimumRole } from "@/lib/rbac";

export default async function SkuHistoryPage() {
  const user = await requireRole("viewer");
  const rows = await getRecentSkuGenerations(500);
  const canDelete = hasMinimumRole(user.role, "editor");

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-50">Histórico de SKUs</h1>
          <p className="mt-2 text-sm text-slate-400">
            Lista de codigos gerados, designacoes finais, snapshot de selecao e dados logisticos.
          </p>
        </div>
        <SkuHistoryExportButton />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Registos recentes</CardTitle>
          <CardDescription>
            Historico criado pelo gerador. Os editores podem eliminar um codigo ja criado.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SkuHistoryList rows={rows} canDelete={canDelete} />
        </CardContent>
      </Card>
    </div>
  );
}
