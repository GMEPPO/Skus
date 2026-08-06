import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const XLSX = require("xlsx");

const EXCEL_PATH =
  "c:\\Users\\mviera\\OneDrive - Groupe GM\\PCsEquipment\\MiguelViera\\Desktop\\diccionario.xlsx";
const OUTPUT_PATH =
  "c:\\Users\\mviera\\OneDrive - Groupe GM\\PCsEquipment\\MiguelViera\\Desktop\\Skus administrator\\supabase\\import_diccionario_cosmetica.sql";

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
  "Flowpack": { es: "Flowpack", en: "Flowpack" },
};

const DO_NOT_TRANSLATE_RE =
  /ecofill|ecopump|ecosource|ecosouce|allegro|ghost|manhattan|stick|algotherm|alqvimia|nuxe|guerlain|typology|trussardi|amimo|codage|phytomer|omnisens|vinesime|fragonard|memo|keiji|faace|clarins|dam |cast |achb|ben |at colog|edpfm|pc gold|pc ruby|guerlain|ty pology|body lotion|sugar cane|ea u dinamizant|plc|slim|classic/i;

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
  if (/^(ECOFILL|Ecopump|ECOPUMP|Ghost|Manhattan|Stick|Flowpack|ALLEGRO|PLC|SLIM)$/i.test(desPt)) return true;
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

  // Generic fallbacks for common PT tokens
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
      });
    }
  }

  return [...words.values()].sort((a, b) =>
    a.levelKey.localeCompare(b.levelKey) || a.label.localeCompare(b.label),
  );
}

function buildEmptyReferenceRows() {
  return LEVELS.map((level) => ({
    levelKey: level.key,
    label: "Vazio",
    normalizedLabel: "vazio",
    referenceCode: "000",
    designationPt: "",
    designationEs: "",
    designationEn: "",
  }));
}

function includeInDesignation(levelKey, referenceCode) {
  if (referenceCode === "000") return false;
  return levelKey !== "format";
}

function buildSql(words) {
  const values = words
    .map(
      (w) =>
        `  ('${escapeSql(w.levelKey)}', '${escapeSql(w.label)}', '${escapeSql(w.normalizedLabel)}', '${escapeSql(w.referenceCode)}', '${escapeSql(w.designationPt)}', '${escapeSql(w.designationEs)}', '${escapeSql(w.designationEn)}', ${includeInDesignation(w.levelKey, w.referenceCode)})`,
    )
    .join(",\n");

  const dictionaryCte = `with cosmetica as (
  select id from public.skus_categories where slug = 'cosmetica' limit 1
),
dictionary(level_key, label, normalized_label, reference_code, designation_pt, designation_es, designation_en, include_in_designation) as (
  values
${values}
)`;

  return `-- Generated from diccionario.xlsx
-- Words: ${words.length}
-- INSERT palavras cosmética por nivel (brand, format, product, size, packaging, extra)
-- Marcas, tamanhos, Ecofill/Ecopump y nombres propios: mismo texto en PT/ES/EN
-- Executar no Supabase SQL Editor apos eliminar palavras antigas

begin;

${dictionaryCte}
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
join public.skus_category_levels cl on cl.key = d.level_key
join cosmetica c on c.id = cl.category_id
where not exists (
  select 1
  from public.skus_words w
  where w.category_level_id = cl.id
    and w.normalized_label = d.normalized_label
    and w.is_active = true
);

${dictionaryCte}
select
  d.level_key,
  count(*) as filas_excel
from dictionary d
group by d.level_key
order by d.level_key;

${dictionaryCte},
levels as (
  select cl.id, cl.key
  from public.skus_category_levels cl
  join cosmetica c on c.id = cl.category_id
)
select
  d.level_key,
  d.label,
  d.reference_code,
  d.designation_pt,
  case when w.id is null then 'missing' else 'inserted' end as estado
from dictionary d
join levels cl on cl.key = d.level_key
left join public.skus_words w
  on w.category_level_id = cl.id
 and w.normalized_label = d.normalized_label
 and w.is_active = true
order by d.level_key, d.label;

commit;
`;
}

const words = [...buildEmptyReferenceRows(), ...parseWorkbook()];
const sql = buildSql(words);
writeFileSync(OUTPUT_PATH, sql, "utf8");

const byLevel = Object.groupBy(words, (word) => word.levelKey);
for (const level of LEVELS.map((item) => item.key)) {
  console.log(`  ${level}: ${byLevel[level]?.length ?? 0}`);
}
console.log(`Generated ${words.length} words -> ${OUTPUT_PATH}`);
