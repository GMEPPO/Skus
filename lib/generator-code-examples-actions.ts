"use server";

import { requireRole } from "@/lib/auth";
import { createSupabaseServiceServerClient } from "@/lib/supabase-service-server";

export type SkuCodeExample = {
  code: string;
  designationPt: string;
  source: "generation" | "normalization";
  matchedPattern: string;
};

const EXAMPLE_LIMIT = 2;

async function queryGenerations(
  supabase: NonNullable<ReturnType<typeof createSupabaseServiceServerClient>>,
  categoryId: string,
  pattern: string,
  limit: number,
) {
  const scoped = await supabase
    .from("skus_sku_generations")
    .select("generated_code, designation_pt")
    .eq("category_id", categoryId)
    .ilike("generated_code", pattern)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (!scoped.error && (scoped.data?.length ?? 0) > 0) {
    return scoped.data ?? [];
  }

  const global = await supabase
    .from("skus_sku_generations")
    .select("generated_code, designation_pt")
    .ilike("generated_code", pattern)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (global.error) return [];
  return global.data ?? [];
}

async function queryNormalizations(
  supabase: NonNullable<ReturnType<typeof createSupabaseServiceServerClient>>,
  pattern: string,
  limit: number,
) {
  const { data, error } = await supabase
    .from("skus_code_normalizations")
    .select("final_new_code, final_designation_pt")
    .eq("normalization_status", "completed")
    .not("final_new_code", "is", null)
    .ilike("final_new_code", pattern)
    .order("completed_at", { ascending: false })
    .limit(limit);

  if (error) return [];
  return data ?? [];
}

export async function fetchSkuCodeExamplesAction(
  categoryId: string,
  patterns: string[],
): Promise<{ ok: true; examples: SkuCodeExample[] } | { ok: false; examples: [] }> {
  await requireRole("viewer");

  const validPatterns = patterns.filter((pattern) => pattern.includes("-"));
  if (!categoryId || validPatterns.length === 0) {
    return { ok: false, examples: [] };
  }

  const supabase = createSupabaseServiceServerClient();
  if (!supabase) {
    return { ok: false, examples: [] };
  }

  const examples: SkuCodeExample[] = [];
  const seen = new Set<string>();

  for (const pattern of validPatterns) {
    const generations = await queryGenerations(supabase, categoryId, pattern, EXAMPLE_LIMIT * 3);
    for (const row of generations) {
      const code = String(row.generated_code ?? "").trim();
      if (!code || seen.has(code)) continue;
      seen.add(code);
      examples.push({
        code,
        designationPt: String(row.designation_pt ?? "").trim(),
        source: "generation",
        matchedPattern: pattern,
      });
      if (examples.length >= EXAMPLE_LIMIT) {
        return { ok: true, examples };
      }
    }

    const normalizations = await queryNormalizations(supabase, pattern, EXAMPLE_LIMIT * 3);
    for (const row of normalizations) {
      const code = String(row.final_new_code ?? "").trim();
      if (!code || seen.has(code)) continue;
      seen.add(code);
      examples.push({
        code,
        designationPt: String(row.final_designation_pt ?? "").trim(),
        source: "normalization",
        matchedPattern: pattern,
      });
      if (examples.length >= EXAMPLE_LIMIT) {
        return { ok: true, examples };
      }
    }
  }

  return { ok: true, examples };
}
