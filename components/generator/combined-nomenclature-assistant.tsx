"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Copy, Loader2, MessageSquare, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type {
  CombinedNomenclatureAbbreviation,
  CombinedNomenclatureMessage,
  CombinedNomenclatureProposal,
  CombinedNomenclatureResponse,
} from "@/lib/sku-assistant/types";

type ChatEntry = CombinedNomenclatureMessage & { id: string };

function createEntry(role: CombinedNomenclatureMessage["role"], content: string): ChatEntry {
  return { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, role, content };
}

async function copyValue(value: string) {
  try {
    await navigator.clipboard.writeText(value);
  } catch {
    // ignore clipboard failures
  }
}

export function CombinedNomenclatureAssistant({
  designationPt,
  designationEs,
  designationEn,
  referenceCode,
  abbreviationGlossary = [],
}: {
  designationPt: string;
  designationEs: string;
  designationEn: string;
  referenceCode?: string;
  abbreviationGlossary?: CombinedNomenclatureAbbreviation[];
}) {
  const [open, setOpen] = useState(true);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proposal, setProposal] = useState<CombinedNomenclatureProposal | null>(null);
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const autoStartedRef = useRef(false);

  const runTurn = useCallback(
    async (conversation: CombinedNomenclatureMessage[]) => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/combined-nomenclature-assistant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            designationPt,
            designationEs,
            designationEn,
            referenceCode,
            abbreviationGlossary,
            messages: conversation,
          }),
        });

        const payload = (await response.json()) as CombinedNomenclatureResponse & { error?: string };
        if (!response.ok) {
          throw new Error(payload.error ?? "Erro ao contactar o assistente NC.");
        }

        if (payload.type === "clarify") {
          const questionBlock =
            payload.questions.length > 0 ? `\n\n${payload.questions.map((q) => `• ${q}`).join("\n")}` : "";
          setEntries((current) => [...current, createEntry("assistant", `${payload.message}${questionBlock}`)]);
          return;
        }

        if (payload.type === "propose") {
          setProposal(payload.proposal);
          setEntries((current) => [
            ...current,
            createEntry(
              "assistant",
              `${payload.message}\n\nNC sugerida: ${payload.proposal.cnCode}\n${payload.proposal.cnDescription}`,
            ),
          ]);
          return;
        }

        setEntries((current) => [...current, createEntry("assistant", payload.message)]);
      } catch (turnError) {
        setError(turnError instanceof Error ? turnError.message : "Erro inesperado.");
      } finally {
        setIsLoading(false);
      }
    },
    [abbreviationGlossary, designationEn, designationEs, designationPt, referenceCode],
  );

  useEffect(() => {
    if (autoStartedRef.current) return;
    autoStartedRef.current = true;
    void runTurn([]);
  }, [runTurn]);

  async function handleSend() {
    const text = input.trim();
    if (!text || isLoading) return;

    setInput("");
    setProposal(null);
    const userEntry = createEntry("user", text);
    const nextConversation = [...entries, userEntry].map((entry) => ({
      role: entry.role,
      content: entry.content,
    }));
    setEntries((current) => [...current, userEntry]);
    await runTurn(nextConversation);
  }

  return (
    <Card className="border-violet-500/40 bg-slate-900/80 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-violet-300" />
          <p className="text-sm font-medium text-slate-100">Nomenclatura Combinada (NC UE)</p>
        </div>
        <Button type="button" variant="outline" className="h-8 px-2 text-xs" onClick={() => setOpen((value) => !value)}>
          {open ? "Ocultar" : "Abrir"}
        </Button>
      </div>

      {open ? (
        <div className="mt-3 space-y-3">
          {proposal ? (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3">
              <p className="text-sm font-medium text-emerald-50">Codigo NC encontrado</p>
              <div className="mt-2 grid gap-2 md:grid-cols-[1fr_auto] md:items-center">
                <p className="font-mono text-lg text-emerald-100">{proposal.cnCode}</p>
                <Button type="button" variant="outline" className="h-9" onClick={() => void copyValue(proposal.cnCode)}>
                  <Copy className="mr-2 h-4 w-4" />
                  Copiar NC
                </Button>
              </div>
              <p className="mt-2 text-xs text-emerald-100/90">{proposal.cnDescription}</p>
              {proposal.rationale ? (
                <p className="mt-2 text-xs text-emerald-100/70">{proposal.rationale}</p>
              ) : null}
            </div>
          ) : null}

          <div className="max-h-56 space-y-2 overflow-y-auto rounded-xl border border-slate-800 bg-slate-900/50 p-3">
            {entries.length === 0 && isLoading ? (
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                A analisar a designacao na NC UE...
              </div>
            ) : null}
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
                A classificar produto na NC UE...
              </div>
            ) : null}
          </div>

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
              placeholder="Responde as duvidas (ex.: material madeira, composicao, uso hoteleiro...)"
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
