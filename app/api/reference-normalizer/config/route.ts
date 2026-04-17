import { NextResponse } from "next/server";
import { getReferenceNormalizerConfig } from "@/lib/reference-normalizer-admin";

export async function GET() {
  try {
    const config = await getReferenceNormalizerConfig();
    return NextResponse.json(config);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erro inesperado." }, { status: 500 });
  }
}
