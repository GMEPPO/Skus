import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NormalizationHistoryTable } from "@/components/normalization/normalization-history-table";
import { requireRole } from "@/lib/auth";
import { getCompletedNormalizationHistory } from "@/lib/normalization-data";

export default async function NormalizationHistoryPage() {
  await requireRole("editor");
  const history = await getCompletedNormalizationHistory();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-50">Historico de normalizacao</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-400">
            Todos os produtos ja normalizados: referencia e designacao antigas, referencia e designacao novas, e
            categoria.
          </p>
        </div>
        <Link
          href="/normalization"
          className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800"
        >
          Voltar a fila pendente
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Produtos normalizados</CardTitle>
          <CardDescription>
            Inclui normalizacoes concluidas no gerador e linhas OK2 importadas do Excel.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NormalizationHistoryTable items={history} />
        </CardContent>
      </Card>
    </div>
  );
}
