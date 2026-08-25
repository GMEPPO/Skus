import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { runCombinedNomenclatureTurn } from "@/lib/sku-assistant/run-combined-nomenclature-turn";
import type { CombinedNomenclatureMessage } from "@/lib/sku-assistant/types";
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
      designationPt?: string;
      designationEs?: string;
      designationEn?: string;
      referenceCode?: string;
      messages?: CombinedNomenclatureMessage[];
    };

    const designationPt = String(body.designationPt ?? "").trim();
    if (!designationPt) {
      return NextResponse.json({ error: "Designacao PT em falta." }, { status: 400 });
    }

    const messages = Array.isArray(body.messages) ? body.messages : [];

    const result = await runCombinedNomenclatureTurn({
      designation: {
        designationPt,
        designationEs: String(body.designationEs ?? "").trim() || undefined,
        designationEn: String(body.designationEn ?? "").trim() || undefined,
        referenceCode: String(body.referenceCode ?? "").trim() || undefined,
      },
      messages,
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro inesperado no assistente NC." },
      { status: 500 },
    );
  }
}
