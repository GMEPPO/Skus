"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseServiceServerClient } from "@/lib/supabase-service-server";

const generateSkuSchema = z.object({
  familyId: z.string().uuid(),
  treeVersionId: z.string().uuid(),
  generatedCode: z.string().trim().min(3),
  designation: z.string().trim().min(1),
  selectionSnapshot: z.string().trim().min(2),
  unitsPerBox: z.coerce.number().positive(),
  unitsPerBoxStatus: z.enum(["real", "estimated"]),
  multiples: z.coerce.number().positive(),
  multiplesStatus: z.enum(["real", "estimated"]),
  weight: z.coerce.number().positive(),
  weightStatus: z.enum(["real", "estimated"]),
});

export async function generateSkuAction(formData: FormData) {
  const parsed = generateSkuSchema.safeParse({
    familyId: formData.get("familyId"),
    treeVersionId: formData.get("treeVersionId"),
    generatedCode: formData.get("generatedCode"),
    designation: formData.get("designation"),
    selectionSnapshot: formData.get("selectionSnapshot"),
    unitsPerBox: formData.get("unitsPerBox"),
    unitsPerBoxStatus: formData.get("unitsPerBoxStatus"),
    multiples: formData.get("multiples"),
    multiplesStatus: formData.get("multiplesStatus"),
    weight: formData.get("weight"),
    weightStatus: formData.get("weightStatus"),
  });

  if (!parsed.success) {
    redirect("/generator?status=error&message=Dados+invalidos+na+geracao+do+SKU");
  }

  const supabase = createSupabaseServiceServerClient();
  if (!supabase) {
    redirect("/generator?status=error&message=Supabase+service+role+nao+configurada");
  }

  const authSupabase = createSupabaseServerClient();
  const authResult = authSupabase ? await authSupabase.auth.getUser() : null;
  const generatedBy = authResult?.data.user?.id ?? null;

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
    redirect("/generator?status=error&message=Nao+foi+possivel+guardar+o+SKU");
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
  redirect("/generator?status=success&message=SKU+guardado+com+sucesso");
}
