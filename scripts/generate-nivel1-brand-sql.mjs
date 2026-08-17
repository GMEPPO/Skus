import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const XLSX = require("xlsx");

const EXCEL_PATH =
  "c:\\Users\\mviera\\OneDrive - Groupe GM\\PCsEquipment\\MiguelViera\\Desktop\\nivel 1.xlsx";
const OUTPUT_PATH =
  "c:\\Users\\mviera\\AppData\\Local\\skus-git-work\\supabase\\migrations\\20260817120100_cosmetica_nivel1_brand_dictionary.sql";

const LEVEL = {
  key: "brand",
  labelCol: "Marca/Linha",
  abbrCol: "Abreviatura",
  desCol: "Designação PHC",
};

function escapeSql(value) {
  return String(value ?? "").replace(/'/g, "''");
}

function normalizeReferenceCode(raw) {
  return String(raw ?? "").trim().toUpperCase();
}

function parseRows() {
  const workbook = XLSX.readFile(EXCEL_PATH);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
  const words = [];
  const seenLabels = new Set();
  const seenRefs = new Set();

  for (const row of rows) {
    const label = String(row[LEVEL.labelCol] ?? "").trim();
    const referenceCode = normalizeReferenceCode(row[LEVEL.abbrCol]);
    const designationPt = String(row[LEVEL.desCol] ?? label).trim();
    if (!label || !referenceCode) continue;

    const normalizedLabel = label.toLowerCase().trim();
    if (seenLabels.has(normalizedLabel)) {
      throw new Error(`Etiqueta duplicada: ${label}`);
    }
    if (seenRefs.has(referenceCode)) {
      throw new Error(`Referencia duplicada: ${referenceCode}`);
    }
    if (!/^[A-Z0-9&.]{1,3}$/.test(referenceCode)) {
      throw new Error(`Referencia invalida (${referenceCode}) para ${label}`);
    }

    seenLabels.add(normalizedLabel);
    seenRefs.add(referenceCode);
    words.push({
      label,
      normalizedLabel,
      referenceCode,
      designationPt,
      designationEs: designationPt,
      designationEn: designationPt,
      includeInDesignation: true,
    });
  }

  words.sort((left, right) => left.label.localeCompare(right.label, "pt"));
  return words;
}

function buildSql(words) {
  const emptyRow = {
    label: "Vazio",
    normalizedLabel: "vazio",
    referenceCode: "000",
    designationPt: "",
    designationEs: "",
    designationEn: "",
    includeInDesignation: true,
  };

  const dictionaryRows = [emptyRow, ...words];
  const values = dictionaryRows
    .map(
      (word) =>
        `  ('${escapeSql(word.label)}', '${escapeSql(word.normalizedLabel)}', '${escapeSql(word.referenceCode)}', '${escapeSql(word.designationPt)}', '${escapeSql(word.designationEs)}', '${escapeSql(word.designationEn)}', ${word.includeInDesignation})`,
    )
    .join(",\n");

  return `-- Cosmetica / nivel 1 (brand) — dicionario novo
-- Fonte: nivel 1.xlsx (${words.length} marcas + Vazio)
-- Nivel 1 depende apenas da categoria cosmetica (sem arestas pai-filho)
-- Executar apos 20260817120000_cosmetica_dictionary_dependencies.sql

begin;

with cosmetica as (
  select id from public.skus_categories where slug = 'cosmetica' limit 1
),
brand_level as (
  select cl.id, cl.legacy_field_type_id
  from public.skus_category_levels cl
  join cosmetica c on c.id = cl.category_id
  where cl.key = 'brand'
  limit 1
),
removed_edges as (
  delete from public.skus_word_parent_edges e
  using public.skus_words w, brand_level bl
  where e.child_word_id = w.id
    and w.category_level_id = bl.id
  returning e.id
),
removed_words as (
  delete from public.skus_words w
  using brand_level bl
  where w.category_level_id = bl.id
  returning w.id
),
dictionary(label, normalized_label, reference_code, designation_pt, designation_es, designation_en, include_in_designation) as (
  values
${values}
)
insert into public.skus_words (
  label,
  normalized_label,
  reference_code,
  category_level_id,
  default_field_type_id,
  designation,
  designation_pt,
  designation_es,
  designation_en,
  include_in_designation,
  is_active
)
select
  d.label,
  d.normalized_label,
  d.reference_code,
  bl.id,
  bl.legacy_field_type_id,
  coalesce(nullif(btrim(d.designation_pt), ''), d.label),
  coalesce(nullif(btrim(d.designation_pt), ''), d.label),
  coalesce(nullif(btrim(d.designation_es), ''), coalesce(nullif(btrim(d.designation_pt), ''), d.label)),
  coalesce(nullif(btrim(d.designation_en), ''), coalesce(nullif(btrim(d.designation_pt), ''), d.label)),
  d.include_in_designation,
  true
from dictionary d
cross join brand_level bl
returning d.label, d.reference_code;

commit;
`;
}

const words = parseRows();
const sql = buildSql(words);
writeFileSync(OUTPUT_PATH, sql, "utf8");
console.log(`Generated ${words.length + 1} rows (incl. Vazio) -> ${OUTPUT_PATH}`);
