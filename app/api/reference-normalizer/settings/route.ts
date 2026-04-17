import { NextRequest, NextResponse } from "next/server";
import { saveReferenceNormalizerSettings } from "@/lib/reference-normalizer-admin";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    return NextResponse.json(await saveReferenceNormalizerSettings(body.settings));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erro inesperado." }, { status: 500 });
  }
}
