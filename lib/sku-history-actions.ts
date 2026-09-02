"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { createSupabaseServiceServerClient } from "@/lib/supabase-service-server";

const deleteSkuGenerationSchema = z.object({
  generationId: z.string().uuid(),
});

export type DeleteSkuGenerationResult = { ok: true } | { ok: false; message: string };

export async function deleteSkuGenerationAction(generationId: string): Promise<DeleteSkuGenerationResult> {
  await requireRole("editor");

  const parsed = deleteSkuGenerationSchema.safeParse({ generationId });
  if (!parsed.success) {
    return { ok: false, message: "Identificador de SKU invalido." };
  }

  const supabase = createSupabaseServiceServerClient();
  if (!supabase) {
    return { ok: false, message: "Supabase service role nao configurada." };
  }

  const existing = await supabase
    .from("skus_sku_generations")
    .select("id, product_image_path")
    .eq("id", parsed.data.generationId)
    .maybeSingle();

  if (existing.error) {
    return { ok: false, message: "Nao foi possivel ler o codigo no historico." };
  }
  if (!existing.data) {
    return { ok: false, message: "Este codigo ja nao existe no historico." };
  }

  const unlinkResult = await supabase
    .from("skus_code_normalizations")
    .update({ generation_id: null, updated_at: new Date().toISOString() })
    .eq("generation_id", parsed.data.generationId);

  if (unlinkResult.error) {
    return {
      ok: false,
      message: "Nao foi possivel desligar este codigo da normalizacao associada.",
    };
  }

  const deleteResult = await supabase.from("skus_sku_generations").delete().eq("id", parsed.data.generationId);
  if (deleteResult.error) {
    return { ok: false, message: "Nao foi possivel eliminar o codigo do historico." };
  }

  const imagePath = existing.data.product_image_path ? String(existing.data.product_image_path) : "";
  if (imagePath) {
    await supabase.storage.from("sku-product-images").remove([imagePath]);
  }

  revalidatePath("/sku-history");
  revalidatePath("/dashboard");
  revalidatePath("/generator");

  return { ok: true };
}
