import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { runSkuAssistantTurn } from "@/lib/sku-assistant/run-turn";
import type { SkuAssistantMessage } from "@/lib/sku-assistant/types";
import { isSkuAssistantEnabled } from "@/lib/skus-feature-flags";

function canUseAssistant(role: string) {
  const order: Record<string, number> = { viewer: 1, editor: 2, manager: 3, admin: 4 };
  return (order[role] ?? 0) >= order.editor;
}

export async function POST(request: Request) {
  try {
    if (!isSkuAssistantEnabled()) {
      return NextResponse.json({ error: "Assistente desactivado." }, { status: 503 });
    }

    const user = await getCurrentUser();
    if (!user || !canUseAssistant(user.role)) {
      return NextResponse.json({ error: "Nao autorizado." }, { status: 401 });
    }

    const body = (await request.json()) as {
      categoryId?: string;
      messages?: SkuAssistantMessage[];
      currentSelections?: Record<string, string>;
    };

    const categoryId = String(body.categoryId ?? "").trim();
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const currentSelections = body.currentSelections ?? {};

    if (!categoryId) {
      return NextResponse.json({ error: "categoryId em falta." }, { status: 400 });
    }

    if (messages.length === 0) {
      return NextResponse.json({ error: "Mensagens em falta." }, { status: 400 });
    }

    const result = await runSkuAssistantTurn({ categoryId, messages, currentSelections });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro inesperado no assistente." },
      { status: 500 },
    );
  }
}
