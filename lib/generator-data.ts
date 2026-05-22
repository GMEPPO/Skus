import { unstable_noStore as noStore } from "next/cache";
import { createSupabaseServiceServerClient } from "@/lib/supabase-service-server";
import type { GeneratorCatalog, GeneratorLevel, GeneratorWord } from "@/lib/types";

const LEVEL_LABELS: Record<string, string> = {
  brand: "Familia/Marca",
  format: "Formato",
  product: "Produto",
  size: "Tamanho/Gramaje",
  packaging: "Embalagem",
  extra: "Extra",
};

const FALLBACK_LEVEL_ORDER = ["brand", "format", "product", "size", "packaging", "extra"];

type FieldTypeRow = {
  id: string;
  code: string;
  name: string;
  sort_order: number | null;
};

type WordRow = {
  id: string;
  label: string;
  reference_code: string;
  default_field_type_id: string;
  designation?: string | null;
  designation_pt?: string | null;
  designation_es?: string | null;
  designation_en?: string | null;
  include_in_designation?: boolean | null;
};

function mapWord(row: WordRow): GeneratorWord {
  return {
    id: row.id,
    label: row.label,
    referenceCode: row.reference_code,
    designation: String(row.designation ?? row.label ?? ""),
    designationPt: String(row.designation_pt ?? row.designation ?? row.label ?? ""),
    designationEs: String(row.designation_es ?? row.designation ?? row.label ?? ""),
    designationEn: String(row.designation_en ?? row.designation ?? row.label ?? ""),
    includeInDesignation: Boolean(row.include_in_designation ?? true),
  };
}

export async function getGeneratorCatalog(): Promise<GeneratorCatalog> {
  noStore();

  const supabase = createSupabaseServiceServerClient();
  if (!supabase) {
    const { getGeneratorCatalog: getDemoGeneratorCatalog } = await import("@/lib/data");
    return getDemoGeneratorCatalog();
  }

  const [fieldTypesResult, wordsResult] = await Promise.all([
    supabase
      .from("skus_field_types")
      .select("id, code, name, sort_order")
      .in("code", FALLBACK_LEVEL_ORDER)
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    supabase
      .from("skus_words")
      .select("id, label, reference_code, default_field_type_id, designation, designation_pt, designation_es, designation_en, include_in_designation")
      .eq("is_active", true)
      .order("label", { ascending: true }),
  ]);

  const fieldTypes = ((fieldTypesResult.data ?? []) as FieldTypeRow[]).sort((left, right) => {
    const leftOrder = left.sort_order ?? FALLBACK_LEVEL_ORDER.indexOf(left.code) + 1;
    const rightOrder = right.sort_order ?? FALLBACK_LEVEL_ORDER.indexOf(right.code) + 1;
    return leftOrder - rightOrder;
  });
  const words = (wordsResult.data ?? []) as WordRow[];

  const levels: GeneratorLevel[] = fieldTypes.map((fieldType, index) => ({
    id: fieldType.id,
    order: index + 1,
    fieldType: fieldType.code,
    label: LEVEL_LABELS[fieldType.code] ?? fieldType.name,
    options: words
      .filter((word) => word.default_field_type_id === fieldType.id)
      .map(mapWord),
  }));

  return { levels };
}

