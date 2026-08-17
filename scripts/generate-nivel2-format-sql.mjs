import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const XLSX = require("xlsx");

const EXCEL_PATH =
  "c:\\Users\\mviera\\OneDrive - Groupe GM\\PCsEquipment\\MiguelViera\\Desktop\\Nivel 2.xlsx";
const OUTPUT_PATH =
  "c:\\Users\\mviera\\AppData\\Local\\skus-git-work\\supabase\\migrations\\20260817120200_cosmetica_nivel2_format_dictionary.sql";

const LEVEL = {
  key: "format",
  levelSqlName: "format_level",
  labelCol: "Formato",
  abbrCol: "Abreviatura",
  desCol: "Designação PHC",
  emptyIncludeInDesignation: false,
  wordIncludeInDesignation: false,
};

const FULL_TRANSLATIONS = {
  Bisnaga: { es: "Bisnaga", en: "Sachet" },
  Frasco: { es: "Frasco", en: "Bottle" },
  "Recarga 5L": { es: "Rec 5L", en: "Ref 5L" },
  Sólido: { es: "Sólido", en: "Solid" },
  Vela: { es: "Vela", en: "Candle" },
  Boião: { es: "Tarro", en: "Jar" },
  ESTOJO: { es: "ESTUCHE", en: "Case" },
  TABULEIRO: { es: "Bandeja", en: "Tray" },
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

  if (obs.includes("no traduzir")) {
    return { pt: designationPt, es: designationPt, en: designationPt };
  }

  if (obs.includes("solo la palabra garrafa")) {
    const suffix = designationPt.replace(/^Garrafa\s*/i, "").trim();
    return {
      pt: designationPt,
      es: suffix ? `Botella ${suffix}` : "Botella",
      en: suffix ? `Bottle ${suffix}` : "Bottle",
    };
  }

  if (obs.includes("solo la palabra recarga")) {
    const suffix = designationPt.replace(/^Recarga\s*/i, "").trim();
    return {
      pt: designationPt,
      es: suffix ? `Recarga ${suffix}` : "Recarga",
      en: suffix ? `Refill ${suffix}` : "Refill",
    };
  }

  const mapped = FULL_TRANSLATIONS[label] ?? FULL_TRANSLATIONS[designationPt];
  if (mapped) {
    return { pt: designationPt, es: mapped.es, en: mapped.en };
  }

  if (obs.includes("traducir")) {
    return { pt: designationPt, es: designationPt, en: designationPt };
  }

  return { pt: designationPt, es: designationPt, en: designationPt };
}

function parseRows() {
  const workbook = XLSX.readFile(EXCEL_PATH);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
  const observationCol = findObservationColumn(Object.keys(rows[0] ?? {}));
  const words = [];
  const seenLabels = new Set();
  const seenRefs = new Set();
  const duplicateRefs = [];

  for (const row of rows) {
    const label = String(row[LEVEL.labelCol] ?? "").trim();
    const referenceCode = normalizeReferenceCode(row[LEVEL.abbrCol]);
    const designationPt = String(row[LEVEL.desCol] ?? label).trim();
    const observation = observationCol ? String(row[observationCol] ?? "").trim() : "";
    if (!label || !referenceCode) continue;

    const normalizedLabel = label.toLowerCase().trim();
    if (seenLabels.has(normalizedLabel)) {
      throw new Error(`Etiqueta duplicada: ${label}`);
    }
    if (seenRefs.has(referenceCode)) {
      duplicateRefs.push({ referenceCode, label });
    }
    if (!/^[A-Z0-9&.]{1,3}$/.test(referenceCode)) {
      throw new Error(`Referencia invalida (${referenceCode}) para ${label}`);
    }

    seenLabels.add(normalizedLabel);
    seenRefs.add(referenceCode);
    const tr = translateDesignations(label, designationPt, observation);
    words.push({
      label,
      normalizedLabel,
      referenceCode,
      designationPt: tr.pt,
      designationEs: tr.es,
      designationEn: tr.en,
      includeInDesignation: LEVEL.wordIncludeInDesignation,
      observation,
    });
  }

  if (duplicateRefs.length > 0) {
    console.warn("AVISO: referencias duplicadas no Excel (mesmo nivel):");
    for (const item of duplicateRefs) {
      console.warn(`  - ${item.referenceCode}: ${item.label}`);
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
    includeInDesignation: LEVEL.emptyIncludeInDesignation,
  };

  const dictionaryRows = [emptyRow, ...words];
  const values = dictionaryRows
    .map(
      (word) =>
        `  ('${escapeSql(word.label)}', '${escapeSql(word.normalizedLabel)}', '${escapeSql(word.referenceCode)}', '${escapeSql(word.designationPt)}', '${escapeSql(word.designationEs)}', '${escapeSql(word.designationEn)}', ${word.includeInDesignation})`,
    )
    .join(",\n");

  return `-- Cosmetica / nivel 2 (format) — dicionario novo
-- Fonte: Nivel 2.xlsx (${words.length} formatos + Vazio)
-- Nivel 2 depende apenas da categoria cosmetica (sem arestas pai-filho)
-- Traducoes conforme coluna de observacoes do Excel
-- ATENCAO: Garrafa Ecofill e Recarga Ecofill partilham referencia ECO (validar antes de aplicar)

begin;

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
removed_edges as (
  delete from public.skus_word_parent_edges e
  using public.skus_words w, ${LEVEL.levelSqlName} ll
  where e.child_word_id = w.id
    and (
      w.category_level_id = ll.id
      or (
        ll.legacy_field_type_id is not null
        and w.default_field_type_id = ll.legacy_field_type_id
      )
    )
  returning e.id
),
removed_words as (
  delete from public.skus_words w
  using ${LEVEL.levelSqlName} ll
  where (
      w.category_level_id = ll.id
      or (
        ll.legacy_field_type_id is not null
        and w.default_field_type_id = ll.legacy_field_type_id
      )
    )
    and coalesce((select 0 from removed_edges limit 1), 0) = 0
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
  ll.id,
  ll.legacy_field_type_id,
  coalesce(nullif(btrim(d.designation_pt), ''), d.label),
  coalesce(nullif(btrim(d.designation_pt), ''), d.label),
  coalesce(nullif(btrim(d.designation_es), ''), coalesce(nullif(btrim(d.designation_pt), ''), d.label)),
  coalesce(nullif(btrim(d.designation_en), ''), coalesce(nullif(btrim(d.designation_pt), ''), d.label)),
  d.include_in_designation,
  true
from dictionary d
cross join ${LEVEL.levelSqlName} ll
where coalesce((select 0 from removed_words limit 1), 0) = 0
returning label, reference_code, designation_pt, designation_es, designation_en;

commit;
`;
}

const words = parseRows();
const sql = buildSql(words);
writeFileSync(OUTPUT_PATH, sql, "utf8");
console.log(`Generated ${words.length + 1} rows (incl. Vazio) -> ${OUTPUT_PATH}`);
for (const word of words) {
  if (word.observation) {
    console.log(`  ${word.label}: PT=${word.designationPt} | ES=${word.designationEs} | EN=${word.designationEn}`);
  }
}
