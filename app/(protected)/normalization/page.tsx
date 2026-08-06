import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NormalizationImportForm } from "@/components/normalization/normalization-import-form";
import { NormalizationQueueTable } from "@/components/normalization/normalization-queue-table";
import { requireRole } from "@/lib/auth";
import { getCategories } from "@/lib/category-catalog";
import { getNormalizationImportBatches, getPendingNormalizationQueue } from "@/lib/normalization-data";
import { isNormalizationV2Enabled } from "@/lib/skus-feature-flags";

export default async function NormalizationPage() {
  const user = await requireRole("editor");
  const normalizationV2Enabled = isNormalizationV2Enabled();
  const categories = await getCategories();
  const preferredCategory = categories.find((category) => category.slug === "cosmetica") ?? categories[0] ?? null;
  const [queue, batches] = await Promise.all([getPendingNormalizationQueue(), getNormalizationImportBatches()]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-50">Normalizacao de codigos</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-400">
          Fila de registos importados pendentes. Reivindica um registo, seleciona o catalogo e conclui a normalizacao.
        </p>
        <p className="mt-2 text-xs uppercase tracking-[0.2em] text-slate-500">
          Flag V2: {normalizationV2Enabled ? "ON" : "OFF"}
        </p>
      </div>

      {!normalizationV2Enabled ? (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardHeader>
            <CardTitle className="text-amber-100">Normalizacao V2 desativada</CardTitle>
            <CardDescription className="text-amber-100/80">
              A fila e visivel em modo leitura. Para reivindicar e concluir registos, ativa
              `NEXT_PUBLIC_SKUS_NORMALIZATION_V2=true` em Vercel e redeploy.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <NormalizationImportForm
        categories={categories.map((category) => ({ id: category.id, name: category.name, slug: category.slug }))}
        defaultCategoryId={preferredCategory?.id ?? null}
      />

      <Card>
        <CardHeader>
          <CardTitle>Resumo de batches</CardTitle>
          <CardDescription>{batches.length} import(s) registados</CardDescription>
        </CardHeader>
        <CardContent>
          {batches.length === 0 ? (
            <p className="text-sm text-slate-400">Sem batches importados. Usa o formulario acima para carregar um Excel.</p>
          ) : (
            <ul className="grid gap-2 text-sm md:grid-cols-2">
              {batches.slice(0, 6).map((batch) => (
                <li key={batch.id} className="rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2">
                  <p className="font-medium text-slate-200">{batch.fileName}</p>
                  <p className="text-xs text-slate-500">
                    {batch.pendingRows} pendentes · {batch.completedRows} concluidos · {batch.totalRows} total
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Fila pendente</CardTitle>
          <CardDescription>{queue.length} registo(s) aguardando normalizacao</CardDescription>
        </CardHeader>
        <CardContent>
          <NormalizationQueueTable items={queue} currentUserId={user.id} actionsEnabled={normalizationV2Enabled} />
        </CardContent>
      </Card>
    </div>
  );
}
