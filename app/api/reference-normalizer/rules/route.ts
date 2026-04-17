import { NextRequest, NextResponse } from "next/server";
import {
  deleteReferenceNormalizerRule,
  duplicateReferenceNormalizerRule,
  importReferenceNormalizerRules,
  restoreDefaultRules,
  upsertReferenceNormalizerRule,
} from "@/lib/reference-normalizer-admin";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const action = String(body.action ?? "save");

    if (action === "save") {
      return NextResponse.json(await upsertReferenceNormalizerRule(body.rule));
    }
    if (action === "delete") {
      await deleteReferenceNormalizerRule(String(body.ruleId));
      return NextResponse.json({ ok: true });
    }
    if (action === "duplicate") {
      return NextResponse.json(await duplicateReferenceNormalizerRule(String(body.ruleId)));
    }
    if (action === "restore-defaults") {
      await restoreDefaultRules();
      return NextResponse.json({ ok: true });
    }
    if (action === "import") {
      await importReferenceNormalizerRules(body.rules);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Acao de regras invalida." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erro inesperado." }, { status: 500 });
  }
}
