import Link from "next/link";
import { Lock, Unlock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { claimNormalizationAction } from "@/lib/sku-normalization-actions";
import type { NormalizationQueueItem } from "@/lib/types";

function isLockActive(item: NormalizationQueueItem, nowMs: number) {
  if (!item.lockedBy || !item.lockExpiresAt) return false;
  return new Date(item.lockExpiresAt).getTime() > nowMs;
}

function lockLabel(item: NormalizationQueueItem, currentUserId: string, nowMs: number) {
  if (!isLockActive(item, nowMs)) return "Livre";
  if (item.lockedBy === currentUserId) return "Bloqueado por ti";
  return "Bloqueado por outro";
}

export function NormalizationQueueTable({
  items,
  currentUserId,
  actionsEnabled,
}: {
  items: NormalizationQueueItem[];
  currentUserId: string;
  actionsEnabled: boolean;
}) {
  const nowMs = Date.now();

  if (items.length === 0) {
    return (
      <Card className="p-6 text-sm text-slate-400">
        Nao existem registos pendentes na fila. Os imports aparecem aqui apos serem carregados na base.
      </Card>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-800">
      <table className="min-w-full divide-y divide-slate-800 text-sm">
        <thead className="bg-slate-950/80 text-left text-xs uppercase tracking-[0.15em] text-slate-500">
          <tr>
            <th className="px-4 py-3">Fila</th>
            <th className="px-4 py-3">Legacy</th>
            <th className="px-4 py-3">Designacao</th>
            <th className="px-4 py-3">Batch</th>
            <th className="px-4 py-3">Lock</th>
            <th className="px-4 py-3">Acao</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800 bg-slate-900/40">
          {items.map((item) => {
            const lockedByMe = isLockActive(item, nowMs) && item.lockedBy === currentUserId;
            const lockedByOther = isLockActive(item, nowMs) && item.lockedBy !== currentUserId;
            const canOpen = lockedByMe;
            const canClaim = actionsEnabled && !lockedByOther && !item.importIssue;

            return (
              <tr key={item.id}>
                <td className="px-4 py-3 text-slate-400">#{item.sourceRowNumber}</td>
                <td className="px-4 py-3 font-mono text-slate-100">{item.legacyCode ?? "—"}</td>
                <td className="max-w-xs truncate px-4 py-3 text-slate-300">
                  {item.legacyDesignation ?? item.sourceDesignationPt ?? "—"}
                </td>
                <td className="px-4 py-3 text-slate-400">{item.batchFileName || "—"}</td>
                <td className="px-4 py-3">
                  <Badge variant="outline" className="gap-1">
                    {lockedByOther ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                    {lockLabel(item, currentUserId, nowMs)}
                  </Badge>
                  {item.importIssue ? (
                    <p className="mt-1 text-xs text-amber-300">{item.importIssue}</p>
                  ) : null}
                </td>
                <td className="px-4 py-3">
                  {canOpen ? (
                    <Button asChild className="h-9 px-3">
                      <Link href={`/normalization/${item.id}`}>Continuar</Link>
                    </Button>
                  ) : canClaim ? (
                    <form
                      action={async () => {
                        "use server";
                        await claimNormalizationAction(item.id);
                      }}
                    >
                      <Button type="submit" variant="outline" className="h-9 px-3">
                        Reivindicar
                      </Button>
                    </form>
                  ) : lockedByOther ? (
                    <span className="text-xs text-slate-500">Aguardar lock</span>
                  ) : (
                    <Button asChild variant="outline" className="h-9 px-3">
                      <Link href={`/normalization/${item.id}`}>Ver</Link>
                    </Button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
