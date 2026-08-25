"use client";

import { useMemo, useState } from "react";
import { Loader2, MessageSquare, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { SkuAssistantMessage, SkuAssistantProposal, SkuAssistantResponse } from "@/lib/sku-assistant/types";

type ChatEntry = SkuAssistantMessage & { id: string };

function createEntry(role: SkuAssistantMessage["role"], content: string): ChatEntry {
  return { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, role, content };
}

export function SkuAssistantComposer({
  categoryId,
  currentSelections,
  onApplyProposal,
  mode = "wizard",
  generatedSku = null,
  onCloseAfterApply,
}: {
  categoryId: string;
  currentSelections: Record<string, string>;
  onApplyProposal: (proposal: SkuAssistantProposal) => void;
  mode?: "wizard" | "post-generation";
  generatedSku?: {
    codeCompact: string;
    designationPt: string;
    designationEs: string;
    designationEn: string;
  } | null;
  onCloseAfterApply?: () => void;
}) {
  const initialMessage =
    mode === "post-generation" && generatedSku
      ? `SKU gerado: ${generatedSku.codeCompact}\nDesignacao PT: ${generatedSku.designationPt}\n\nSe faltar informacao (cor, material, variante, etc.), pergunto antes de sugerir a nomenclatura combinada correcta.`
      : "Descreve o produto (marca, formato, produto, tamanho, embalagem). Se faltar informacao, pergunto antes de sugerir o codigo.";

  const [open, setOpen] = useState(true);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingProposal, setPendingProposal] = useState<SkuAssistantProposal | null>(null);
  const [entries, setEntries] = useState<ChatEntry[]>([createEntry("assistant", initialMessage)]);

  const messages = useMemo(
    () => entries.map((entry) => ({ role: entry.role, content: entry.content })),
    [entries],
  );

  async function handleSend() {
    const text = input.trim();
    if (!text || isLoading) return;

    setInput("");
    setError(null);
    setPendingProposal(null);
    const nextEntries = [...entries, createEntry("user", text)];
    setEntries(nextEntries);
    setIsLoading(true);

    try {
      const response = await fetch("/api/sku-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryId,
          currentSelections,
          generatedSku: generatedSku ?? undefined,
          messages: nextEntries.map((entry) => ({ role: entry.role, content: entry.content })),
        }),
      });

      const payload = (await response.json()) as SkuAssistantResponse & { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Erro ao contactar o assistente.");
      }

      if (payload.type === "clarify") {
        const questionBlock =
          payload.questions.length > 0 ? `\n\n${payload.questions.map((q) => `• ${q}`).join("\n")}` : "";
        setEntries((current) => [...current, createEntry("assistant", `${payload.message}${questionBlock}`)]);
        return;
      }

      if (payload.type === "propose") {
        setPendingProposal(payload.proposal);
        setEntries((current) => [
          ...current,
          createEntry(
            "assistant",
            `${payload.message}\n\nCodigo sugerido: ${payload.proposal.codeCompact}\nDesignacao PT: ${payload.proposal.designationPt}`,
          ),
        ]);
        return;
      }

      setEntries((current) => [...current, createEntry("assistant", payload.message)]);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Erro inesperado.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card className={mode === "post-generation" ? "border-violet-500/40 bg-slate-900/80 p-4" : "border-violet-500/30 bg-slate-950/80 p-4"}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-violet-300" />
          <p className="text-sm font-medium text-slate-100">Assistente nomenclatura</p>
        </div>
        <Button type="button" variant="outline" className="h-8 px-2 text-xs" onClick={() => setOpen((value) => !value)}>
          {open ? "Ocultar" : "Abrir"}
        </Button>
      </div>

      {open ? (
        <div className="mt-3 space-y-3">
          <div className="max-h-56 space-y-2 overflow-y-auto rounded-xl border border-slate-800 bg-slate-900/50 p-3">
            {entries.map((entry) => (
              <div
                key={entry.id}
                className={[
                  "rounded-lg px-3 py-2 text-sm whitespace-pre-wrap",
                  entry.role === "user" ? "bg-violet-500/15 text-violet-50" : "bg-slate-800/80 text-slate-200",
                ].join(" ")}
              >
                {entry.content}
              </div>
            ))}
            {isLoading ? (
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                A analisar nomenclatura...
              </div>
            ) : null}
          </div>

          {pendingProposal ? (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-50">
              <p className="font-medium">Proposta encontrada</p>
              <p className="mt-1 text-xs text-amber-100/90">Ref: {pendingProposal.codeCompact}</p>
              <p className="mt-1 text-xs text-amber-100/90">{pendingProposal.designationPt}</p>
              <Button
                type="button"
                className="mt-3 h-9 gap-2"
                onClick={() => {
                  onApplyProposal(pendingProposal);
                  setPendingProposal(null);
                  if (mode === "post-generation") {
                    onCloseAfterApply?.();
                    return;
                  }
                  setEntries((current) => [
                    ...current,
                    createEntry("assistant", "Seleccoes aplicadas no gerador. Revê os niveis e gera o SKU."),
                  ]);
                }}
              >
                <Sparkles className="h-4 w-4" />
                {mode === "post-generation" ? "Usar referencia sugerida" : "Aplicar seleccoes"}
              </Button>
            </div>
          ) : null}

          {error ? <p className="text-xs text-red-400">{error}</p> : null}

          <div className="flex gap-2">
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void handleSend();
                }
              }}
              rows={2}
              placeholder={
                mode === "post-generation"
                  ? "Ex: falta indicar cor branca e material madeira para encontrar a nomenclatura combinada"
                  : "Ex: percha branca em madeira, ou sabonete solido Algotherm 20g caixa cartao"
              }
              className="min-h-[44px] flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
            />
            <Button type="button" className="h-11 px-3" disabled={isLoading || !input.trim()} onClick={() => void handleSend()}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
