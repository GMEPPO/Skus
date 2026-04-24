"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseServiceServerClient } from "@/lib/supabase-service-server";

const PRODUCT_IMAGE_BUCKET = "sku-product-images";
const MAX_PRODUCT_IMAGE_SIZE = 5 * 1024 * 1024;
const ALLOWED_PRODUCT_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const generateSkuSchema = z.object({
  familyId: z.string().uuid(),
  treeVersionId: z.string().uuid(),
  generatedCode: z.string().trim().min(3),
  designation: z.string().trim().min(1),
  designationPt: z.string().trim().min(1),
  designationEs: z.string().trim().min(1),
  designationEn: z.string().trim().min(1),
  selectionSnapshot: z.string().trim().min(2),
  unitsPerBox: z.coerce.number().positive(),
  unitsPerBoxStatus: z.enum(["real", "estimated"]),
  multiples: z.coerce.number().positive(),
  multiplesStatus: z.enum(["real", "estimated"]),
  weight: z.coerce.number().positive(),
  weightStatus: z.enum(["real", "estimated"]),
});

export type GenerateSkuActionResult =
  | {
      ok: true;
      message: string;
      generatedCode: string;
      generatedCodeCompact: string;
      productImageUrl?: string;
      designationPt: string;
      designationEs: string;
      designationEn: string;
      unitsPerBox: number;
      unitsPerBoxStatus: "real" | "estimated";
      multiples: number;
      multiplesStatus: "real" | "estimated";
      weight: number;
      weightStatus: "real" | "estimated";
    }
  | { ok: false; message: string };

function getFileExtension(fileName: string, mimeType: string) {
  const normalizedName = fileName.trim().toLowerCase();
  if (normalizedName.endsWith(".png")) return "png";
  if (normalizedName.endsWith(".webp")) return "webp";
  if (normalizedName.endsWith(".jpg") || normalizedName.endsWith(".jpeg")) return "jpg";
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  return "jpg";
}

export async function generateSkuAction(formData: FormData): Promise<GenerateSkuActionResult> {
  const parsed = generateSkuSchema.safeParse({
    familyId: formData.get("familyId"),
    treeVersionId: formData.get("treeVersionId"),
    generatedCode: formData.get("generatedCode"),
    designation: formData.get("designation"),
    designationPt: formData.get("designationPt"),
    designationEs: formData.get("designationEs"),
    designationEn: formData.get("designationEn"),
    selectionSnapshot: formData.get("selectionSnapshot"),
    unitsPerBox: formData.get("unitsPerBox"),
    unitsPerBoxStatus: formData.get("unitsPerBoxStatus"),
    multiples: formData.get("multiples"),
    multiplesStatus: formData.get("multiplesStatus"),
    weight: formData.get("weight"),
    weightStatus: formData.get("weightStatus"),
  });

  if (!parsed.success) {
    return { ok: false, message: "Dados invalidos na geracao do SKU." };
  }

  const supabase = createSupabaseServiceServerClient();
  if (!supabase) {
    return { ok: false, message: "Supabase service role nao configurada." };
  }

  const authSupabase = createSupabaseServerClient();
  const authResult = authSupabase ? await authSupabase.auth.getUser() : null;
  const generatedBy = authResult?.data.user?.id ?? null;
  const productImage = formData.get("productImage");

  let productImagePath: string | null = null;
  let productImageUrl: string | null = null;

  if (productImage instanceof File && productImage.size > 0) {
    if (!ALLOWED_PRODUCT_IMAGE_TYPES.has(productImage.type)) {
      return { ok: false, message: "A imagem do produto deve ser JPG, PNG ou WEBP." };
    }

    if (productImage.size > MAX_PRODUCT_IMAGE_SIZE) {
      return { ok: false, message: "A imagem do produto nao pode ultrapassar 5 MB." };
    }

    const extension = getFileExtension(productImage.name, productImage.type);
    productImagePath = `${parsed.data.familyId}/${parsed.data.generatedCode}-${randomUUID()}.${extension}`;
    const uploadResult = await supabase.storage.from(PRODUCT_IMAGE_BUCKET).upload(productImagePath, productImage, {
      cacheControl: "3600",
      contentType: productImage.type,
      upsert: false,
    });

    if (uploadResult.error) {
      return { ok: false, message: "Nao foi possivel carregar a imagem do produto." };
    }

    productImageUrl = supabase.storage.from(PRODUCT_IMAGE_BUCKET).getPublicUrl(productImagePath).data.publicUrl;
  }

  const sequenceResult = await supabase
    .from("skus_sku_sequences")
    .upsert(
      {
        family_id: parsed.data.familyId,
        prefix_key: parsed.data.generatedCode,
        last_value: 1,
      },
      { onConflict: "family_id,prefix_key" },
    )
    .select("last_value")
    .single();

  const sequenceValue = sequenceResult.data?.last_value ?? 1;

  const insertResult = await supabase
    .from("skus_sku_generations")
    .insert({
      family_id: parsed.data.familyId,
      tree_version_id: parsed.data.treeVersionId,
      generated_code: parsed.data.generatedCode,
      designation: parsed.data.designation,
      product_image_path: productImagePath,
      product_image_url: productImageUrl,
      sequence_value: sequenceValue,
      prefix_snapshot: parsed.data.generatedCode,
      selection_snapshot: JSON.parse(parsed.data.selectionSnapshot),
      units_per_box: parsed.data.unitsPerBox,
      units_per_box_status: parsed.data.unitsPerBoxStatus,
      multiples: parsed.data.multiples,
      multiples_status: parsed.data.multiplesStatus,
      weight: parsed.data.weight,
      weight_status: parsed.data.weightStatus,
      generated_by: generatedBy,
    })
    .select("id")
    .single();

  if (insertResult.error || !insertResult.data) {
    if (productImagePath) {
      await supabase.storage.from(PRODUCT_IMAGE_BUCKET).remove([productImagePath]);
    }
    return { ok: false, message: "Nao foi possivel guardar o SKU." };
  }

  await supabase.from("skus_sku_generation_measurement_history").insert([
    {
      sku_generation_id: insertResult.data.id,
      field_name: "units_per_box",
      new_value_numeric: parsed.data.unitsPerBox,
      new_value_status: parsed.data.unitsPerBoxStatus,
    },
    {
      sku_generation_id: insertResult.data.id,
      field_name: "multiples",
      new_value_numeric: parsed.data.multiples,
      new_value_status: parsed.data.multiplesStatus,
    },
    {
      sku_generation_id: insertResult.data.id,
      field_name: "weight",
      new_value_numeric: parsed.data.weight,
      new_value_status: parsed.data.weightStatus,
    },
  ]);

  revalidatePath("/generator");
  revalidatePath("/sku-history");
  revalidatePath("/dashboard");

  return {
    ok: true,
    message: "SKU guardado com sucesso.",
    generatedCode: parsed.data.generatedCode,
    generatedCodeCompact: parsed.data.generatedCode.replaceAll("-", ""),
    productImageUrl: productImageUrl ?? undefined,
    designationPt: parsed.data.designationPt,
    designationEs: parsed.data.designationEs,
    designationEn: parsed.data.designationEn,
    unitsPerBox: parsed.data.unitsPerBox,
    unitsPerBoxStatus: parsed.data.unitsPerBoxStatus,
    multiples: parsed.data.multiples,
    multiplesStatus: parsed.data.multiplesStatus,
    weight: parsed.data.weight,
    weightStatus: parsed.data.weightStatus,
  };
}
