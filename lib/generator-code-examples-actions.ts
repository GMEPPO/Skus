"use server";

import { requireRole } from "@/lib/auth";
import { createSupabaseServiceServerClient } from "@/lib/supabase-service-server";

export type SkuCodeExample = {
  code: string;
  designationPt: string;
  source: "generation" | "normalization";
};

const EXAMPLE_LIMIT = 2;

export async function fetchSkuCodeExamplesAction(
  categoryId: string,
  pattern: string,
): Promise<{ ok: true; examples: SkuCodeExample[] } | { ok: false; examples: [] }> {
  await requireRole("viewer");

  if (!categoryId || !pattern.includes("-")) {
    return { ok: false, examples: [] };
  }

  const supabase = createSupabaseServiceServerClient();
  if (!supabase) {
    return { ok: false, examples: [] };
  }

  const examples: SkuCodeExample[] = [];
  const seen = new Set<string>();

  const { data: generations, error: generationsError } = await supabase
    .from("skus_sku_generations")
    .select("generated_code, designation_pt")
    .eq("category_id", categoryId)
    .ilike("generated_code", pattern)
    .order("created_at", { ascending: false })
    .limit(EXAMPLE_LIMIT * 3);

  if (generationsError) {
    return { ok: false, examples: [] };
  }

  for (const row of generations ?? []) {
    const code = String(row.generated_code ?? "").trim();
    if (!code || seen.has(code)) continue;
    seen.add(code);
    examples.push({
      code,
      designationPt: String(row.designation_pt ?? "").trim(),
      source: "generation",
    });
    if (examples.length >= EXAMPLE_LIMIT) {
      return { ok: true, examples };
    }
  }

  const { data: normalizations, error: normalizationsError } = await supabase
    .from("skus_code_normalizations")
    .select("final_new_code, final_designation_pt")
    .eq("normalization_status", "completed")
    .not("final_new_code", "is", null)
    .ilike("final_new_code", pattern)
    .order("completed_at", { ascending: false })
    .limit(EXAMPLE_LIMIT * 3);

  if (normalizationsError) {
    return { ok: true, examples };
  }

  for (const row of normalizations ?? []) {
    const code = String(row.final_new_code ?? "").trim();
    if (!code || seen.has(code)) continue;
    seen.add(code);
    examples.push({
      code,
      designationPt: String(row.final_designation_pt ?? "").trim(),
      source: "normalization",
    });
    if (examples.length >= EXAMPLE_LIMIT) {
      break;
    }
  }

  return { ok: true, examples };
}
