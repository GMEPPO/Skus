import type { createSupabaseServiceServerClient } from "@/lib/supabase-service-server";
import { normalizeSkuReference } from "@/lib/sku-reference-uniqueness";

type ServiceSupabase = NonNullable<ReturnType<typeof createSupabaseServiceServerClient>>;

const REFERENCE_LOOKUP_PAGE_SIZE = 1000;

export function findDuplicateSkuReferencesWithinList(references: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const reference of references) {
    const normalized = normalizeSkuReference(reference);
    if (!normalized) continue;
    if (seen.has(normalized)) duplicates.add(normalized);
    seen.add(normalized);
  }

  return [...duplicates];
}

async function collectTakenReferencesFromGenerations(
  supabase: ServiceSupabase,
  wantedSet: Set<string>,
  taken: Set<string>,
) {
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from("skus_sku_generations")
      .select("generated_code")
      .range(offset, offset + REFERENCE_LOOKUP_PAGE_SIZE - 1);

    if (error) throw new Error(error.message);

    const page = data ?? [];
    for (const row of page) {
      const normalized = normalizeSkuReference(String(row.generated_code ?? ""));
      if (normalized && wantedSet.has(normalized)) taken.add(normalized);
    }

    if (page.length < REFERENCE_LOOKUP_PAGE_SIZE) break;
    offset += REFERENCE_LOOKUP_PAGE_SIZE;
  }
}

async function collectTakenReferencesFromCompletedNormalizations(
  supabase: ServiceSupabase,
  wantedSet: Set<string>,
  taken: Set<string>,
) {
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from("skus_code_normalizations")
      .select("final_new_code, source_new_code")
      .eq("normalization_status", "completed")
      .not("generation_id", "is", null)
      .range(offset, offset + REFERENCE_LOOKUP_PAGE_SIZE - 1);

    if (error) throw new Error(error.message);

    const page = data ?? [];
    for (const row of page) {
      const normalized = normalizeSkuReference(String(row.final_new_code ?? row.source_new_code ?? ""));
      if (normalized && wantedSet.has(normalized)) taken.add(normalized);
    }

    if (page.length < REFERENCE_LOOKUP_PAGE_SIZE) break;
    offset += REFERENCE_LOOKUP_PAGE_SIZE;
  }
}

export async function findTakenSkuReferences(
  supabase: ServiceSupabase,
  references: Array<string | null | undefined>,
): Promise<string[]> {
  const wanted = [...new Set(references.map(normalizeSkuReference).filter(Boolean))];
  if (wanted.length === 0) return [];

  const wantedSet = new Set(wanted);
  const taken = new Set<string>();

  await collectTakenReferencesFromGenerations(supabase, wantedSet, taken);
  await collectTakenReferencesFromCompletedNormalizations(supabase, wantedSet, taken);

  return [...taken];
}

export function formatTakenSkuReferenceMessage(references: string[]): string {
  if (references.length === 0) {
    return "Este codigo SKU ja existe no historico. Nao e possivel criar a mesma referencia duas vezes.";
  }
  const preview = references.slice(0, 3).join(", ");
  const suffix = references.length > 3 ? ` (+${references.length - 3})` : "";
  return `Este codigo SKU ja existe no historico: ${preview}${suffix}. Nao e possivel criar a mesma referencia duas vezes.`;
}
