import { NextRequest, NextResponse } from "next/server";
import {
  deleteReferenceNormalizerCatalogEntry,
  importReferenceNormalizerCatalog,
  restoreDefaultCatalog,
  upsertReferenceNormalizerCatalogEntry,
} from "@/lib/reference-normalizer-admin";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const action = String(body.action ?? "save");

    if (action === "save") {
      return NextResponse.json(await upsertReferenceNormalizerCatalogEntry(body.entry));
    }
    if (action === "delete") {
      await deleteReferenceNormalizerCatalogEntry(String(body.entryId));
      return NextResponse.json({ ok: true });
    }
    if (action === "restore-defaults") {
      await restoreDefaultCatalog();
      return NextResponse.json({ ok: true });
    }
    if (action === "import") {
      await importReferenceNormalizerCatalog(body.catalog);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Acao de catalogo invalida." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erro inesperado." }, { status: 500 });
  }
}
