import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { buildDictionaryLevelPurgeSql } from "./dictionary-level-purge-sql.mjs";

const require = createRequire(import.meta.url);
const XLSX = require("xlsx");

const EXCEL_PATH =
  "c:\\Users\\mviera\\OneDrive - Groupe GM\\PCsEquipment\\MiguelViera\\Desktop\\Nivel 3.xlsx";
const OUTPUT_PATH =
  "c:\\Users\\mviera\\AppData\\Local\\skus-git-work\\supabase\\migrations\\20260817120300_cosmetica_nivel3_product_dictionary.sql";

const LEVEL = {
  key: "product",
  levelSqlName: "product_level",
  labelCol: "Produto/Modelo",
  abbrCol: "Abreviatura",
  desCol: "Designação PHC",
};

const FULL_TRANSLATIONS = {
  Condicionador: { es: "Acondicionador", en: "Conditioner" },
  Champô: { es: "Champú", en: "Shampoo" },
  "Champô/Cond": { es: "Champú/Acond", en: "Shampoo/Conditioner" },
  Sabonete: { es: "Jabón", en: "Soap" },
  "Sab Líquido": { es: "Jabón Líquido", en: "Liquid Soap" },
  "Sabonete Esfoliante": { es: "Jabón Exfoliante", en: "Exfoliating Soap" },
  "Gel Banho": { es: "Gel de Baño", en: "Shower Gel" },
  "Gel Mãos Corpo": { es: "Gel Manos Cuerpo", en: "Hand Body Gel" },
  "Gel mãos": { es: "Gel de manos", en: "Hand Gel" },
  "Gel Corp Cabelo": { es: "Gel Cuerpo Cabello", en: "Hair and Body Gel" },
  "Gel de Limpeza": { es: "Gel Lavant", en: "Gel Lavant" },
  "Gel Lavant": { es: "Gel Lavant", en: "Gel Lavant" },
  "Bálsamo Corporal": { es: "Bálsamo Corporal", en: "Body Balm" },
  "Loção Mão Corpo": { es: "Loción Manos Cuerpo", en: "Hand Body Lotion" },
  "Loção Mão": { es: "Loción de manos", en: "Hand Lotion" },
  "Sais Banho": { es: "Sales de baño", en: "Bath Salts" },
  Bruma: { es: "Bruma", en: "Mist" },
  Perfume: { es: "Perfume", en: "Perfume" },
  Fragrancia: { es: "Fragancia", en: "Fragrance" },
  Colonia: { es: "Colonia", en: "Cologne" },
  "OLEO PRODIGIOSO": { es: "ACEITE PRODIGIOSO", en: "PRODIGIOUS OIL" },
};

function escapeSql(value) {
  return String(value ?? "").replace(/'/g, "''");
}

function normalizeReferenceCode(raw) {
  return String(raw ?? "").trim().toUpperCase();
}

function findObservationColumn(columns) {
  return (
    columns.find((column) => column.toLowerCase().includes("observ")) ??
    columns.find((column) => column === "__EMPTY") ??
    null
  );
}

function translateDesignations(label, designationPt, observation) {
  const obs = String(observation ?? "").trim().toLowerCase();

  if (obs.includes("sem design") || obs.includes("fica vazio")) {
    return { pt: "", es: "", en: "", emptyDesignation: true };
  }

  if (obs.includes("não traduzir") || obs.includes("nao traduzir") || obs.includes("no traduzir")) {
    return { pt: designationPt, es: designationPt, en: designationPt, emptyDesignation: false };
  }

  const mapped =
    FULL_TRANSLATIONS[designationPt] ??
    FULL_TRANSLATIONS[label] ??
    (obs.includes("traduc") ? null : null);

  if (mapped) {
    return { pt: designationPt, es: mapped.es, en: mapped.en, emptyDesignation: false };
  }

  if (obs.includes("traduc")) {
    return { pt: designationPt, es: designationPt, en: designationPt, emptyDesignation: false };
  }

  return { pt: designationPt, es: designationPt, en: designationPt, emptyDesignation: false };
}

function parseRows() {
  const workbook = XLSX.readFile(EXCEL_PATH);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
  const observationCol = findObservationColumn(Object.keys(rows[0] ?? {}));
  const words = [];
  const seenLabels = new Set();
  const refsByCode = new Map();

  for (const row of rows) {
    const label = String(row[LEVEL.labelCol] ?? "").trim();
    const referenceCode = normalizeReferenceCode(row[LEVEL.abbrCol]);
    const designationPtRaw = String(row[LEVEL.desCol] ?? "").trim();
    const designationPt = designationPtRaw || label;
    const observation = observationCol ? String(row[observationCol] ?? "").trim() : "";
    if (!label || !referenceCode) continue;

    const normalizedLabel = label.toLowerCase().trim();
    if (seenLabels.has(normalizedLabel)) {
      throw new Error(`Etiqueta duplicada: ${label}`);
    }
    if (!/^[A-Z0-9&.]{1,3}$/.test(referenceCode)) {
      throw new Error(`Referencia invalida (${referenceCode}) para ${label}`);
    }

    seenLabels.add(normalizedLabel);
    const bucket = refsByCode.get(referenceCode) ?? [];
    bucket.push(label);
    refsByCode.set(referenceCode, bucket);

    const tr = translateDesignations(label, designationPtRaw || designationPt, observation);
    words.push({
      label,
      normalizedLabel,
      referenceCode,
      designationPt: tr.emptyDesignation ? "" : tr.pt || designationPt,
      designationEs: tr.emptyDesignation ? "" : tr.es,
      designationEn: tr.emptyDesignation ? "" : tr.en,
      emptyDesignation: tr.emptyDesignation,
      includeInDesignation: !tr.emptyDesignation,
      observation,
    });
  }

  const duplicateRefs = [...refsByCode.entries()].filter(([, labels]) => labels.length > 1);
  if (duplicateRefs.length > 0) {
    console.warn("AVISO: referencias partilhadas no Excel (varias palavras, mesma abreviatura):");
    for (const [referenceCode, labels] of duplicateRefs) {
      console.warn(`  - ${referenceCode}: ${labels.join(", ")}`);
    }
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
    emptyDesignation: true,
    includeInDesignation: true,
  };

  const dictionaryRows = [emptyRow, ...words];
  const values = dictionaryRows
    .map(
      (word) =>
        `  ('${escapeSql(word.label)}', '${escapeSql(word.normalizedLabel)}', '${escapeSql(word.referenceCode)}', '${escapeSql(word.designationPt)}', '${escapeSql(word.designationEs)}', '${escapeSql(word.designationEn)}', ${word.emptyDesignation}, ${word.includeInDesignation})`,
    )
    .join(",\n");

  const refCounts = new Map();
  for (const word of words) {
    refCounts.set(word.referenceCode, (refCounts.get(word.referenceCode) ?? 0) + 1);
  }
  const sharedRefs = [...refCounts.entries()]
    .filter(([, count]) => count > 1)
    .map(([code, count]) => `${code}(${count})`)
    .join(", ");

  return `-- Cosmetica / nivel 3 (product) — dicionario novo
-- Fonte: Nivel 3.xlsx (${words.length} produtos + Vazio)
-- Nivel 3 depende apenas da categoria cosmetica (sem arestas pai-filho)
-- Traducoes conforme coluna de observacoes do Excel
-- ATENCAO: varias palavras partilham a mesma abreviatura (${sharedRefs || "n/a"})

begin;
${buildDictionaryLevelPurgeSql(LEVEL.key)}

with cosmetica as (
  select id from public.skus_categories where slug = 'cosmetica' limit 1
),
${LEVEL.levelSqlName} as (
  select cl.id, cl.legacy_field_type_id
  from public.skus_category_levels cl
  join cosmetica c on c.id = cl.category_id
  where cl.key = '${LEVEL.key}'
  limit 1
),
dictionary(label, normalized_label, reference_code, designation_pt, designation_es, designation_en, empty_designation, include_in_designation) as (
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
  ll.id,
  ll.legacy_field_type_id,
  case
    when d.empty_designation then ''
    else coalesce(nullif(btrim(d.designation_pt), ''), d.label)
  end,
  case when d.empty_designation then '' else coalesce(nullif(btrim(d.designation_pt), ''), d.label) end,
  case
    when d.empty_designation then ''
    else coalesce(nullif(btrim(d.designation_es), ''), coalesce(nullif(btrim(d.designation_pt), ''), d.label))
  end,
  case
    when d.empty_designation then ''
    else coalesce(nullif(btrim(d.designation_en), ''), coalesce(nullif(btrim(d.designation_pt), ''), d.label))
  end,
  d.include_in_designation,
  true
from dictionary d
cross join ${LEVEL.levelSqlName} ll
returning label, reference_code, designation_pt, designation_es, designation_en;

commit;
`;
}

const words = parseRows();
const sql = buildSql(words);
writeFileSync(OUTPUT_PATH, sql, "utf8");
console.log(`Generated ${words.length + 1} rows (incl. Vazio) -> ${OUTPUT_PATH}`);
for (const word of words) {
  console.log(
    `  ${word.label} [${word.referenceCode}]: PT="${word.designationPt}" ES="${word.designationEs}" EN="${word.designationEn}"${word.emptyDesignation ? " (sem designacao)" : ""}`,
  );
}
