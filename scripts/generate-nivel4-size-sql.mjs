import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { buildDictionaryLevelPurgeSql } from "./dictionary-level-purge-sql.mjs";

const require = createRequire(import.meta.url);
const XLSX = require("xlsx");

const EXCEL_PATH =
  "c:\\Users\\mviera\\OneDrive - Groupe GM\\PCsEquipment\\MiguelViera\\Desktop\\Nivel 4.xlsx";
const OUTPUT_PATH =
  "c:\\Users\\mviera\\AppData\\Local\\skus-git-work\\supabase\\migrations\\20260817120400_cosmetica_nivel4_size_dictionary.sql";

const LEVEL = {
  key: "size",
  levelSqlName: "size_level",
  labelCol: "Tamanho Formato",
  abbrCol: "Abreviatura",
  desCol: "Designação PHC",
  rulesCol: "Regras",
};

/** Numero do ficheiro Excel (nivel 1.xlsx, Nivel 2.xlsx, ...) -> chave do nivel na app */
const EXCEL_FILE_NIVEL_TO_LEVEL_KEY = {
  1: "brand",
  2: "format",
  3: "product",
  4: "size",
};

/**
 * Dependencias explicitas tamanho -> palavra pai no Nivel 2.xlsx (format).
 * Nota: nas regras do Excel, "nivel 1" (ex.: 5L) refere-se ao Formato (ficheiro Nivel 2.xlsx),
 * nao a Marcas (nivel 1.xlsx). Marca so depende da categoria cosmetica.
 * Duas palavras-pai distintas:
 * - 375ml -> Recarga Ecosouc (ECS)  [regra Excel: nivel 2 + ECS]
 * - 5L    -> Recarga 5L (REC)       [5L so faz sentido com formato Recarga 5L]
 */
const EXPLICIT_SIZE_DEPENDENCIES = [
  {
    childNormalizedLabel: "375ml",
    parentLevelKey: "format",
    parentNormalizedLabel: "recarga ecosouc",
    parentReferenceCode: "ECS",
  },
  {
    childNormalizedLabel: "5l",
    parentLevelKey: "format",
    parentNormalizedLabel: "recarga 5l",
    parentReferenceCode: "REC",
  },
];

function escapeSql(value) {
  return String(value ?? "").replace(/'/g, "''");
}

function normalizeReferenceCode(raw) {
  const text = String(raw ?? "").trim().toUpperCase();
  if (/^\d+$/.test(text)) {
    return text.padStart(3, "0").slice(-3);
  }
  return text.replace(/[^A-Z0-9&.]/g, "").slice(0, 3);
}

function parseExcelRuleNivel(rules) {
  const match = String(rules ?? "").match(/nivel\s*(\d)/i);
  return match ? Number(match[1]) : null;
}

function parseRowRules(label, designationPtRaw, rules) {
  const rulesText = String(rules ?? "").trim().toLowerCase();
  const emptyDesignation =
    rulesText.includes("queda vacio") ||
    rulesText.includes("fica vazio") ||
    (!designationPtRaw && rulesText.includes("vacio"));

  const designationPt = emptyDesignation ? "" : String(designationPtRaw || label).trim();

  return {
    designationPt,
    designationEs: designationPt,
    designationEn: designationPt,
    emptyDesignation,
    includeInDesignation: !emptyDesignation,
    rules,
    excelRuleNivel: parseExcelRuleNivel(rules),
  };
}

function resolveDependencies(words) {
  const byLabel = new Map(words.map((word) => [word.normalizedLabel, word]));

  return EXPLICIT_SIZE_DEPENDENCIES.map((dep) => {
    const child = byLabel.get(dep.childNormalizedLabel);
    if (!child) {
      throw new Error(`Dependencia definida para tamanho inexistente: ${dep.childNormalizedLabel}`);
    }
    return { ...dep, childLabel: child.label };
  });
}

function parseRows() {
  const workbook = XLSX.readFile(EXCEL_PATH);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
  const words = [];
  const seenLabels = new Set();

  for (const row of rows) {
    const label = String(row[LEVEL.labelCol] ?? "").trim();
    const referenceCode = normalizeReferenceCode(row[LEVEL.abbrCol]);
    const designationPtRaw = String(row[LEVEL.desCol] ?? "").trim();
    const rules = String(row[LEVEL.rulesCol] ?? "").trim();
    if (!label || !referenceCode) continue;

    const normalizedLabel = label.toLowerCase().trim();
    if (seenLabels.has(normalizedLabel)) {
      throw new Error(`Etiqueta duplicada: ${label}`);
    }
    if (!/^[A-Z0-9&.]{1,3}$/.test(referenceCode)) {
      throw new Error(`Referencia invalida (${referenceCode}) para ${label}`);
    }

    seenLabels.add(normalizedLabel);
    words.push({
      label,
      normalizedLabel,
      referenceCode,
      ...parseRowRules(label, designationPtRaw, rules),
    });
  }

  words.sort((left, right) => left.label.localeCompare(right.label, "pt"));
  return words;
}

function buildDependencyInserts(dependencies) {
  if (dependencies.length === 0) return "-- sem dependencias";

  return dependencies
    .map(
      (dep) => `  select
    c.id as category_id,
    child_w.id as child_word_id,
    parent_w.id as parent_word_id
  from cosmetica c
  cross join size_level sl
  join public.skus_category_levels parent_level
    on parent_level.category_id = c.id
   and parent_level.key = '${dep.parentLevelKey}'
  join inserted_words child_w
    on child_w.normalized_label = '${escapeSql(dep.childNormalizedLabel)}'
  join public.skus_words parent_w
    on parent_w.category_level_id = parent_level.id
   and parent_w.normalized_label = '${escapeSql(dep.parentNormalizedLabel)}'
   and parent_w.reference_code = '${escapeSql(dep.parentReferenceCode)}'
   and parent_w.is_active = true`,
    )
    .join("\n  union all\n");
}

function buildSql(words, dependencies) {
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

  const dependencySelect = buildDependencyInserts(dependencies);

  return `-- Cosmetica / nivel 4 (size) — dicionario novo
-- Fonte: Nivel 4.xlsx (${words.length} tamanhos + Vazio)
-- Dependencias (2 tamanhos -> 2 palavras pai no Nivel 2.xlsx / formato):
--   375ml -> Recarga Ecosouc (ECS)
--   5L    -> Recarga 5L (REC)
-- Executar apos 20260817114500_allow_duplicate_word_references.sql

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
),
inserted_words as (
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
  returning id, normalized_label, label
),
dependency_pairs as (
${dependencySelect}
)
insert into public.skus_word_parent_edges (category_id, child_word_id, parent_word_id)
select category_id, child_word_id, parent_word_id
from dependency_pairs
on conflict (child_word_id, parent_word_id) do nothing;

commit;
`;
}

const words = parseRows();
const dependencies = resolveDependencies(words);
const sql = buildSql(words, dependencies);
writeFileSync(OUTPUT_PATH, sql, "utf8");

console.log(`Generated ${words.length + 1} rows (incl. Vazio) -> ${OUTPUT_PATH}`);
console.log("Dependencias:");
for (const dep of dependencies) {
  console.log(
    `  ${dep.childLabel} -> ${dep.parentLevelKey}/${dep.parentNormalizedLabel} (${dep.parentReferenceCode})`,
  );
}
for (const word of words) {
  if (word.excelRuleNivel) {
    const mapped = EXCEL_FILE_NIVEL_TO_LEVEL_KEY[word.excelRuleNivel] ?? "?";
    console.log(`  Regra Excel ${word.label}: nivel ${word.excelRuleNivel} -> ${mapped}`);
  }
}
