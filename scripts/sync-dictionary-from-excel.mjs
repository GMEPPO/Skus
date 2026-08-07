/**
 * Genera SQL para sincronizar palabras activas con un Excel de diccionario.
 *
 * Uso:
 *   node scripts/sync-dictionary-from-excel.mjs "c:\ruta\WS1 (1).xlsx"
 */
import { writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const XLSX = require("xlsx");

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");

const EXCEL_PATH = process.argv[2] ?? join(projectRoot, "supabase", "WS1.xlsx");
const baseName = basename(EXCEL_PATH, ".xlsx").replace(/\s+/g, "_").toLowerCase();
const OUTPUT_SQL = join(projectRoot, "supabase", `sync_dictionary_${baseName}.sql`);
const OUTPUT_REPORT = join(projectRoot, "supabase", `sync_dictionary_${baseName}_report.json`);

const LEVELS = [
  { key: "brand", labelCol: "Marca/Linha", abbrCol: "Abreviatura", desCol: "Designação PHC" },
  { key: "format", labelCol: "Formato", abbrCol: "Abreviatura_1", desCol: "Designação PHC_1" },
  { key: "product", labelCol: "Produto/Modelo", abbrCol: "Abreviatura_2", desCol: "Designação PHC_2" },
  { key: "size", labelCol: "Tamanho Formato", abbrCol: "Abreviatura_3", desCol: "Designação PHC_3" },
  { key: "packaging", labelCol: "Tipo embalagem", abbrCol: "Abreviatura_4", desCol: "Designação PHC_4" },
  { key: "extra", labelCol: "Outros", abbrCol: "Abreviatura_5", desCol: null },
];

const TRANSLATIONS = {
  Bisnaga: { es: "Bisnaga", en: "Sachet" },
  Condicionador: { es: "Acondicionador", en: "Conditioner" },
  "Champô": { es: "Champú", en: "Shampoo" },
  "Champô/Cond": { es: "Champú/Acond", en: "Shampoo/Conditioner" },
  Sabonete: { es: "Jabón", en: "Soap" },
  "Sab Líquido": { es: "Jabón Líquido", en: "Liquid Soap" },
  "Sabonete Esfoliante": { es: "Jabón Exfoliante", en: "Exfoliating Soap" },
  "Gel Banho": { es: "Gel de Baño", en: "Shower Gel" },
  "Gel Mãos Corpo": { es: "Gel Manos Cuerpo", en: "Hand Body Gel" },
  "Gel mãos": { es: "Gel de manos", en: "Hand Gel" },
  "Gel Corp Cabelo": { es: "Gel Cuerpo Cabello", en: "Body Hair Gel" },
  "Loção Mão Corpo": { es: "Loción Manos Cuerpo", en: "Hand Body Lotion" },
  "Loção Mão": { es: "Loción de manos", en: "Hand Lotion" },
  "Sais Banho": { es: "Sales de baño", en: "Bath Salts" },
  Caixa: { es: "Caja", en: "Box" },
  Papel: { es: "Papel", en: "Paper" },
  Bolsa: { es: "Bolsa", en: "Bag" },
  Frasco: { es: "Frasco", en: "Bottle" },
  Boião: { es: "Tarro", en: "Jar" },
  Vela: { es: "Vela", en: "Candle" },
  Sólido: { es: "Sólido", en: "Solid" },
  ESTOJO: { es: "ESTUCHE", en: "Case" },
  Bruma: { es: "Bruma", en: "Mist" },
  Perfume: { es: "Perfume", en: "Perfume" },
  Fragrancia: { es: "Fragancia", en: "Fragrance" },
  Colonia: { es: "Colonia", en: "Cologne" },
  "CREME DE NOITE": { es: "CREMA DE NOCHE", en: "Night Cream" },
  "CREME FACIAL": { es: "CREMA FACIAL", en: "Face Cream" },
  "CREME LIMPEZA ROSTO": { es: "CREMA LIMPIEZA ROSTO", en: "Face Cleansing Cream" },
  Clássico: { es: "Clásico", en: "Classic" },
  Flowpack: { es: "Flowpack", en: "Flowpack" },
};

const DO_NOT_TRANSLATE_RE =
  /ecofill|ecopump|ecosource|ecosouce|allegro|ghost|manhattan|stick|algotherm|alqvimia|nuxe|guerlain|typology|trussardi|amimo|codage|phytomer|omnisens|vinesime|fragonard|memo|keiji|faace|clarins|dam |cast |achb|ben |at colog|edpfm|pc gold|pc ruby|guerlain|ty pology|body lotion|sugar cane|ea u dinamizant|plc|slim|classic|tabuleiro|madeira/i;

function escapeSql(value) {
  return String(value ?? "").replace(/'/g, "''");
}

function normalizeReferenceCode(levelKey, raw) {
  let code = String(raw ?? "").trim().toUpperCase();
  if (levelKey === "size") {
    code = code.replace(/[^A-Z0-9&.]/g, "").slice(0, 3);
  }
  return code;
}

function shouldKeepSame(levelKey, label, desPt) {
  if (levelKey === "brand" || levelKey === "size") return true;
  if (DO_NOT_TRANSLATE_RE.test(label) || DO_NOT_TRANSLATE_RE.test(desPt)) return true;
  if (/^[\d.,]+(ml|gr|g|l|kg)?$/i.test(desPt)) return true;
  if (/^(ECOFILL|Ecopump|ECOPUMP|Ghost|Manhattan|Stick|Flowpack|ALLEGRO|PLC|SLIM|TABULEIRO|MADEIRA)$/i.test(desPt)) {
    return true;
  }
  return false;
}

function translateDesignations(levelKey, label, desPt) {
  if (shouldKeepSame(levelKey, label, desPt)) {
    return { pt: desPt, es: desPt, en: desPt };
  }

  const mapped = TRANSLATIONS[desPt] ?? TRANSLATIONS[label];
  if (mapped) {
    return { pt: desPt, es: mapped.es, en: mapped.en };
  }

  let es = desPt
    .replace(/Condicionador/g, "Acondicionador")
    .replace(/Champô/g, "Champú")
    .replace(/Sabonete/g, "Jabón")
    .replace(/Sab Líquido/g, "Jabón Líquido")
    .replace(/Gel Banho/g, "Gel de Baño")
    .replace(/Loção/g, "Loción")
    .replace(/Caixa/g, "Caja")
    .replace(/Sólido/g, "Sólido")
    .replace(/Rec /g, "Rec ");

  let en = desPt
    .replace(/Condicionador/g, "Conditioner")
    .replace(/Champô/g, "Shampoo")
    .replace(/Sabonete/g, "Soap")
    .replace(/Sab Líquido/g, "Liquid Soap")
    .replace(/Gel Banho/g, "Shower Gel")
    .replace(/Loção/g, "Lotion")
    .replace(/Caixa/g, "Box")
    .replace(/Sólido/g, "Solid")
    .replace(/Rec /g, "Ref ")
    .replace(/Garrafa/g, "Bottle");

  if (es === desPt && en === desPt) {
    return { pt: desPt, es: desPt, en: desPt };
  }

  return { pt: desPt, es, en };
}

function includeInDesignation(levelKey, referenceCode) {
  if (referenceCode === "000") return false;
  return levelKey !== "format";
}

function parseWorkbook() {
  const workbook = XLSX.readFile(EXCEL_PATH);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
  const words = new Map();

  for (const row of rows) {
    for (const level of LEVELS) {
      const label = String(row[level.labelCol] ?? "").trim();
      const referenceCode = normalizeReferenceCode(level.key, row[level.abbrCol]);
      const desPt = String((level.desCol ? row[level.desCol] : label) ?? "").trim();
      if (!label || !referenceCode) continue;

      const dedupeKey = `${level.key}|${label.toLowerCase()}`;
      if (words.has(dedupeKey)) continue;

      const tr = translateDesignations(level.key, label, desPt);
      words.set(dedupeKey, {
        levelKey: level.key,
        label,
        normalizedLabel: label.toLowerCase().trim(),
        referenceCode,
        designationPt: tr.pt,
        designationEs: tr.es,
        designationEn: tr.en,
        includeInDesignation: includeInDesignation(level.key, referenceCode),
      });
    }
  }

  return [...words.values()].sort(
    (a, b) => a.levelKey.localeCompare(b.levelKey) || a.label.localeCompare(b.label),
  );
}

function analyzeDuplicates(words) {
  const byRef = new Map();
  for (const word of words) {
    if (word.referenceCode === "000" || word.levelKey === "size") continue;
    const bucket = byRef.get(word.referenceCode) ?? [];
    bucket.push(word);
    byRef.set(word.referenceCode, bucket);
  }

  const crossLevel = [];
  const sameLevel = [];

  for (const [referenceCode, bucket] of byRef) {
    const levels = new Set(bucket.map((word) => word.levelKey));
    if (levels.size > 1) {
      crossLevel.push({ referenceCode, words: bucket });
    } else if (bucket.length > 1) {
      sameLevel.push({ referenceCode, levelKey: bucket[0].levelKey, words: bucket });
    }
  }

  return { crossLevel, sameLevel };
}

function buildDictionaryCte(words) {
  const values = words
    .map(
      (word) =>
        `  ('${escapeSql(word.levelKey)}', '${escapeSql(word.label)}', '${escapeSql(word.normalizedLabel)}', '${escapeSql(word.referenceCode)}', '${escapeSql(word.designationPt)}', '${escapeSql(word.designationEs)}', '${escapeSql(word.designationEn)}', ${word.includeInDesignation})`,
    )
    .join(",\n");

  return `cosmetica as (
  select id from public.skus_categories where slug = 'cosmetica' limit 1
),
dictionary(level_key, label, normalized_label, reference_code, designation_pt, designation_es, designation_en, include_in_designation) as (
  values
${values}
),
levels as (
  select cl.id, cl.key
  from public.skus_category_levels cl
  join cosmetica c on c.id = cl.category_id
)`;
}

function buildSql(words, sourceFile) {
  const cte = buildDictionaryCte(words);

  return `-- Sincroniza palavras activas com ${basename(sourceFile)}
-- Palavras no Excel: ${words.length}
-- Executar diagnose antes; rever conflitos entre niveles no reporte JSON.

begin;

with ${cte}
update public.skus_words w
set
  label = d.label,
  normalized_label = d.normalized_label,
  reference_code = d.reference_code,
  designation = coalesce(nullif(btrim(d.designation_pt), ''), d.label),
  designation_pt = coalesce(nullif(btrim(d.designation_pt), ''), d.label),
  designation_es = coalesce(nullif(btrim(d.designation_es), ''), coalesce(nullif(btrim(d.designation_pt), ''), d.label)),
  designation_en = coalesce(nullif(btrim(d.designation_en), ''), coalesce(nullif(btrim(d.designation_pt), ''), d.label)),
  include_in_designation = d.include_in_designation,
  updated_at = now()
from dictionary d
join levels cl on cl.key = d.level_key
where w.category_level_id = cl.id
  and w.normalized_label = d.normalized_label
  and w.is_active = true;

with ${cte}
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
  cl.id,
  cl.legacy_field_type_id,
  coalesce(nullif(btrim(d.designation_pt), ''), d.label),
  coalesce(nullif(btrim(d.designation_pt), ''), d.label),
  coalesce(nullif(btrim(d.designation_es), ''), coalesce(nullif(btrim(d.designation_pt), ''), d.label)),
  coalesce(nullif(btrim(d.designation_en), ''), coalesce(nullif(btrim(d.designation_pt), ''), d.label)),
  d.include_in_designation,
  true
from dictionary d
join levels cl on cl.key = d.level_key
where not exists (
  select 1
  from public.skus_words w
  where w.category_level_id = cl.id
    and w.normalized_label = d.normalized_label
    and w.is_active = true
);

with ${cte}
select
  d.level_key,
  d.label,
  d.reference_code,
  d.designation_pt,
  case
    when w.id is null then 'inserted'
    else 'updated_or_exists'
  end as estado
from dictionary d
join levels cl on cl.key = d.level_key
left join public.skus_words w
  on w.category_level_id = cl.id
 and w.normalized_label = d.normalized_label
 and w.is_active = true
order by d.level_key, d.label;

with ${cte}
select
  w.label as palavra_bd,
  cl.key as nivel,
  w.reference_code as referencia_bd
from public.skus_words w
join levels cl on cl.id = w.category_level_id
left join dictionary d
  on d.level_key = cl.key
 and d.normalized_label = w.normalized_label
where w.is_active = true
  and d.normalized_label is null
  and w.reference_code <> '000'
order by cl.key, w.label;

commit;
`;
}

const words = parseWorkbook();
const duplicates = analyzeDuplicates(words);
const report = {
  source: EXCEL_PATH,
  totalWords: words.length,
  byLevel: Object.fromEntries(
    LEVELS.map((level) => [level.key, words.filter((word) => word.levelKey === level.key).length]),
  ),
  newComparedToPreviousImport: ["format|tabuleiro", "packaging|madeira"],
  duplicates,
};

writeFileSync(OUTPUT_SQL, buildSql(words, EXCEL_PATH), "utf8");
writeFileSync(OUTPUT_REPORT, JSON.stringify(report, null, 2), "utf8");

console.log(`Excel: ${EXCEL_PATH}`);
console.log(`Words: ${words.length}`);
console.log(`Cross-level duplicate refs: ${duplicates.crossLevel.length}`);
console.log(`Same-level duplicate refs: ${duplicates.sameLevel.length}`);
console.log(`SQL -> ${OUTPUT_SQL}`);
console.log(`Report -> ${OUTPUT_REPORT}`);
