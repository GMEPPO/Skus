import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { NormalizationWorkWizard } from "@/components/normalization/normalization-work-wizard";
import { requireRole } from "@/lib/auth";
import { getCategories, getGeneratorCatalogForCategory } from "@/lib/category-catalog";
import { getNormalizationById } from "@/lib/normalization-data";
import {
  claimNormalizationAction,
  releaseNormalizationAction,
} from "@/lib/sku-normalization-actions";
import { isNormalizationV2Enabled } from "@/lib/skus-feature-flags";
import type { GeneratorCatalog } from "@/lib/types";

function isLockActive(lockedBy: string | null, lockExpiresAt: string | null, userId: string) {
  if (!lockedBy || !lockExpiresAt) return false;
  if (new Date(lockExpiresAt).getTime() <= Date.now()) return false;
  return lockedBy === userId;
}

function isLockedByOther(lockedBy: string | null, lockExpiresAt: string | null, userId: string) {
  if (!lockedBy || !lockExpiresAt) return false;
  if (new Date(lockExpiresAt).getTime() <= Date.now()) return false;
  return lockedBy !== userId;
}

export default async function NormalizationWorkPage({ params }: { params: { id: string } }) {
  const user = await requireRole("editor");
  const normalizationV2Enabled = isNormalizationV2Enabled();
  const record = await getNormalizationById(params.id);
  if (!record) notFound();

  const categories = await getCategories();
  const preferredCategory =
    (record.categoryId ? categories.find((c) => c.id === record.categoryId) : null) ??
    categories.find((c) => c.slug === "cosmetica") ??
    categories[0] ??
    null;

  const categoryCatalog = preferredCategory ? await getGeneratorCatalogForCategory(preferredCategory.id) : null;

  const catalog: GeneratorCatalog | null = categoryCatalog
    ? {
        levels: categoryCatalog.levels.map((level, index) => ({
          id: level.id,
          order: index + 1,
          fieldType: level.key,
          label: level.label,
          options: level.options.map((option) => ({
            id: option.id,
            label: option.label,
            referenceCode: option.referenceCode,
            designation: option.designationPt,
            designationPt: option.designationPt,
            designationEs: option.designationEs,
            designationEn: option.designationEn,
            includeInDesignation: option.includeInDesignation,
          })),
        })),
      }
    : null;

  const ownedLock = isLockActive(record.lockedBy, record.lockExpiresAt, user.id);
  const foreignLock = isLockedByOther(record.lockedBy, record.lockExpiresAt, user.id);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
            <Link href="/normalization" className="hover:text-slate-300">
              Normalizacao
            </Link>{" "}
            / Registo {record.sourceRowNumber}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-50">
            {record.legacyCode ?? "Sem codigo legacy"}
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-400">{record.legacyDesignation ?? record.sourceDesignationPt ?? "—"}</p>
        </div>
        <div className="flex gap-2">
          {ownedLock && normalizationV2Enabled ? (
            <form
              action={async () => {
                "use server";
                await releaseNormalizationAction(record.id);
              }}
            >
              <Button type="submit" variant="outline" className="h-9 px-3">
                Libertar bloqueio
              </Button>
            </form>
          ) : null}
          <Button asChild variant="outline" className="h-9 px-3">
            <Link href="/normalization">Voltar a fila</Link>
          </Button>
        </div>
      </div>

      {record.normalizationStatus === "completed" ? (
        <Card>
          <CardHeader>
            <CardTitle>Normalizacao concluida</CardTitle>
            <CardDescription>Este registo ja foi processado.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <span className="text-slate-500">Codigo final:</span>{" "}
              <span className="font-mono text-slate-100">{record.finalNewCode}</span>
            </p>
            <p>
              <span className="text-slate-500">Designacao PT:</span> {record.finalDesignationPt}
            </p>
          </CardContent>
        </Card>
      ) : record.normalizationStatus === "cancelled" ? (
        <Card className="border-red-500/30 bg-red-500/5 p-6 text-sm text-red-100">
          Registo cancelado{record.importIssue ? `: ${record.importIssue}` : "."}
        </Card>
      ) : foreignLock ? (
        <Card className="border-amber-500/30 bg-amber-500/5 p-6 text-sm text-amber-100">
          Este registo esta bloqueado por outro utilizador ate{" "}
          {record.lockExpiresAt ? new Date(record.lockExpiresAt).toLocaleString("pt-PT") : "expirar o lock"}.
        </Card>
      ) : !ownedLock ? (
        <Card>
          <CardHeader>
            <CardTitle>Reivindicar registo</CardTitle>
            <CardDescription>
              Precisas de um bloqueio exclusivo (10 min) antes de concluir a normalizacao.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {normalizationV2Enabled ? (
              <form
                action={async () => {
                  "use server";
                  await claimNormalizationAction(record.id);
                }}
              >
                <Button type="submit">Reivindicar e comecar</Button>
              </form>
            ) : (
              <p className="text-sm text-slate-400">Ativa a flag de normalizacao V2 para reivindicar registos.</p>
            )}
          </CardContent>
        </Card>
      ) : !catalog || !preferredCategory ? (
        <Card>
          <CardHeader>
            <CardTitle>Configuracao em falta</CardTitle>
            <CardDescription>Nao foi possivel carregar o catalogo da categoria.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <NormalizationWorkWizard
          record={record}
          catalog={catalog}
          categoryId={preferredCategory.id}
          categoryLabel={preferredCategory.name}
          normalizationV2Enabled={normalizationV2Enabled}
        />
      )}
    </div>
  );
}
