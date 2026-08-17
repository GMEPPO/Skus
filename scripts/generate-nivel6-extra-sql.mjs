import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { buildDictionaryLevelPurgeSql } from "./dictionary-level-purge-sql.mjs";

const require = createRequire(import.meta.url);
const XLSX = require("xlsx");

const EXCEL_PATH =
  "c:\\Users\\mviera\\OneDrive - Groupe GM\\PCsEquipment\\MiguelViera\\Desktop\\nivel 6.xlsx";
const NIVEL5_EXCEL_PATH =
  "c:\\Users\\mviera\\OneDrive - Groupe GM\\PCsEquipment\\MiguelViera\\Desktop\\Nivel 5.xlsx";
const OUTPUT_PATH =
  "c:\\Users\\mviera\\AppData\\Local\\skus-git-work\\supabase\\migrations\\20260817120700_cosmetica_nivel6_extra_dictionary.sql";

const LEVEL = {
  key: "extra",
  levelSqlName: "extra_level",
  labelCol: "Outros",
  abbrCol: "Abreviatura",
  desCol: "Designação PHC",
  rulesCol: "Regras - Sempre no Fim da Referência",
  emptyIncludeInDesignation: true,
  wordIncludeInDesignation: true,
};

const NIVEL5_H2 = {
  labelCol: "1. Tipo embalagem",
  abbrCol: "Abreviatura",
  desCol: "Designação PHC",
  hierarchyCol: "Hierarquia",
};

const FULL_TRANSLATIONS = {
  Bordeaux: { es: "Burdeos", en: "Bordeaux" },
  Branco: { es: "Blanco", en: "White" },
  "CREME DE NOITE": { es: "CREMA DE NOCHE", en: "NIGHT CREAM" },
  "CREME FACIAL": { es: "CREMA FACIAL", en: "FACE CREAM" },
  ALGODÃO: { es: "ALGODÓN", en: "COTTON" },
  AMENDOA: { es: "ALMENDRA", en: "ALMOND" },
  TANGERINA: { es: "MANDARINA", en: "TANGERINE" },
  Limão: { es: "Limón", en: "Lemon" },
  "CREME LIMPEZA ROSTO": { es: "CREMA LIMPIEZA ROSTRO", en: "FACE CLEANSING CREAM" },
  "CREME DE CORPO": { es: "CREMA DE CUERPO", en: "BODY CREAM" },
  "Creme Mãos": { es: "CREMA DE MANOS", en: "HAND CREAM" },
};

/** Dependencias explicitas extra -> pai (format/product). parentMatch any = OR. */
const EXTRA_DEPENDENCY_RULES = [
  {
    childNormalizedLabel: "1.8",
    parentMatch: "any",
    parents: [
      { levelKey: "format", normalizedLabel: "garrafa ecofill", referenceCode: "ECO" },
      { levelKey: "format", normalizedLabel: "recarga ecofill", referenceCode: "ECO" },
    ],
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

function findObservationColumn(columns) {
  return (
    columns.find((column) => column.toLowerCase().includes("observ")) ??
    columns.find((column) => column === "__EMPTY") ??
    null
  );
}

function parseHierarchy(raw, currentHierarchy) {
  const text = String(raw ?? "").trim();
  if (!text) return currentHierarchy;
  if (/^1\./.test(text)) return 1;
  if (/^2\./.test(text)) return 2;
  return currentHierarchy;
}

function translateDesignations(label, designationPtRaw, observation) {
  const obs = String(observation ?? "").trim().toLowerCase();
  const designationPt = String(designationPtRaw || label).trim();

  if (obs.includes("queda vacio") || obs.includes("fica vazio") || obs.includes("sem design")) {
    return {
      designationPt: "",
      designationEs: "",
      designationEn: "",
      emptyDesignation: true,
      includeInDesignation: false,
    };
  }

  if (obs.includes("não traduzir") || obs.includes("nao traduzir") || obs.includes("no traduzir")) {
    return {
      designationPt,
      designationEs: designationPt,
      designationEn: designationPt,
      emptyDesignation: false,
      includeInDesignation: LEVEL.wordIncludeInDesignation,
    };
  }

  const mapped = FULL_TRANSLATIONS[label] ?? FULL_TRANSLATIONS[designationPt];
  if (mapped) {
    return {
      designationPt,
      designationEs: mapped.es,
      designationEn: mapped.en,
      emptyDesignation: false,
      includeInDesignation: LEVEL.wordIncludeInDesignation,
    };
  }

  if (obs.includes("traduc")) {
    return {
      designationPt,
      designationEs: designationPt,
      designationEn: designationPt,
      emptyDesignation: false,
      includeInDesignation: LEVEL.wordIncludeInDesignation,
    };
  }

  return {
    designationPt,
    designationEs: designationPt,
    designationEn: designationPt,
    emptyDesignation: false,
    includeInDesignation: LEVEL.wordIncludeInDesignation,
  };
}

function parseNivel6Rows() {
  const workbook = XLSX.readFile(EXCEL_PATH);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
  const observationCol = findObservationColumn(Object.keys(rows[0] ?? {}));
  const words = [];

  for (const row of rows) {
    const label = String(row[LEVEL.labelCol] ?? "").trim();
    const referenceCode = normalizeReferenceCode(row[LEVEL.abbrCol]);
    const designationPtRaw = String(row[LEVEL.desCol] ?? "").trim();
    const observation = observationCol ? String(row[observationCol] ?? "").trim() : "";
    const rules = String(row[LEVEL.rulesCol] ?? "").trim();
    if (!label || !referenceCode) continue;

    const normalizedLabel = label.toLowerCase().trim();
    const tr = translateDesignations(label, designationPtRaw, observation);
    words.push({
      label,
      normalizedLabel,
      referenceCode,
      selectionHierarchy: null,
      source: "nivel 6.xlsx",
      designationPt: tr.designationPt,
      designationEs: tr.designationEs,
      designationEn: tr.designationEn,
      emptyDesignation: tr.emptyDesignation,
      includeInDesignation: tr.includeInDesignation,
      rules,
      observation,
    });
  }

  return words;
}

function parseNivel5HierarchyTwoRows() {
  const workbook = XLSX.readFile(NIVEL5_EXCEL_PATH);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
  const observationCol = findObservationColumn(Object.keys(rows[0] ?? {}));
  const words = [];
  let currentHierarchy = null;

  for (const row of rows) {
    currentHierarchy = parseHierarchy(row[NIVEL5_H2.hierarchyCol], currentHierarchy);
    if (currentHierarchy !== 2) continue;

    const label = String(row[NIVEL5_H2.labelCol] ?? "").trim();
    const referenceCode = normalizeReferenceCode(row[NIVEL5_H2.abbrCol]);
    const designationPtRaw = String(row[NIVEL5_H2.desCol] ?? "").trim();
    const observation = observationCol ? String(row[observationCol] ?? "").trim() : "";
    if (!label || !referenceCode || label.includes("Outro Dados")) continue;

    const normalizedLabel = label.toLowerCase().trim();
    const tr = translateDesignations(label, designationPtRaw, observation);
    words.push({
      label,
      normalizedLabel,
      referenceCode,
      selectionHierarchy: 2,
      source: "Nivel 5.xlsx H2",
      designationPt: tr.designationPt,
      designationEs: tr.designationEs,
      designationEn: tr.designationEn,
      emptyDesignation: tr.emptyDesignation,
      includeInDesignation: tr.includeInDesignation,
      rules: "",
      observation,
    });
  }

  return words;
}

function parseRows() {
  const nivel6 = parseNivel6Rows();
  const nivel5h2 = parseNivel5HierarchyTwoRows();
  const seenLabels = new Set();
  const merged = [];

  for (const word of [...nivel6, ...nivel5h2]) {
    if (seenLabels.has(word.normalizedLabel)) {
      throw new Error(`Etiqueta duplicada entre fontes: ${word.label}`);
    }
    if (!/^[A-Z0-9&.]{1,3}$/.test(word.referenceCode)) {
      throw new Error(`Referencia invalida (${word.referenceCode}) para ${word.label}`);
    }
    seenLabels.add(word.normalizedLabel);
    merged.push(word);
  }

  merged.sort((left, right) => left.label.localeCompare(right.label, "pt"));
  return merged;
}

function resolveDependencies(words) {
  const byLabel = new Map(words.map((word) => [word.normalizedLabel, word]));
  const resolved = [];

  for (const rule of EXTRA_DEPENDENCY_RULES) {
    const child = byLabel.get(rule.childNormalizedLabel);
    if (!child) {
      throw new Error(`Dependencia definida para extra inexistente: ${rule.childNormalizedLabel}`);
    }
    for (const parent of rule.parents) {
      resolved.push({
        childNormalizedLabel: rule.childNormalizedLabel,
        childLabel: child.label,
        parentLevelKey: parent.levelKey,
        parentNormalizedLabel: parent.normalizedLabel,
        parentReferenceCode: parent.referenceCode,
        parentMatch: rule.parentMatch,
      });
    }
  }

  return resolved;
}

function buildDependencyInserts(dependencies) {
  if (dependencies.length === 0) return "  select null::uuid, null::uuid, null::uuid where false";

  return dependencies
    .map(
      (dep) => `  select
    c.id as category_id,
    child_w.id as child_word_id,
    parent_w.id as parent_word_id
  from cosmetica c
  cross join extra_level el
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
    selectionHierarchy: null,
    designationPt: "",
    designationEs: "",
    designationEn: "",
    emptyDesignation: true,
    includeInDesignation: LEVEL.emptyIncludeInDesignation,
  };

  const dictionaryRows = [emptyRow, ...words];
  const values = dictionaryRows
    .map(
      (word) =>
        `  ('${escapeSql(word.label)}', '${escapeSql(word.normalizedLabel)}', '${escapeSql(word.referenceCode)}', ${word.selectionHierarchy ?? "null"}, '${escapeSql(word.designationPt)}', '${escapeSql(word.designationEs)}', '${escapeSql(word.designationEn)}', ${word.emptyDesignation}, ${word.includeInDesignation})`,
    )
    .join(",\n");

  const dependencySelect = buildDependencyInserts(dependencies);
  const h2Count = words.filter((word) => word.selectionHierarchy === 2).length;
  const nivel6Count = words.filter((word) => word.source === "nivel 6.xlsx").length;

  return `-- Cosmetica / nivel 6 (extra / Outros) — dicionario novo
-- Fonte: nivel 6.xlsx (${nivel6Count} palavras) + Nivel 5.xlsx hierarquia 2 (${h2Count} palavras) + Vazio
-- Segmento sempre no fim da referencia SKU
-- Hierarquia 2 (Nivel 5): mostrar no extra se nenhuma embalagem H1 aplicavel (logica UI pendente)
-- Dependencias: 1.8 -> Ecofill (format / ECO)
-- Executar apos 20260817120500_cosmetica_word_selection_hierarchy.sql e 20260817120600_...nivel5...

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
dictionary(label, normalized_label, reference_code, selection_hierarchy, designation_pt, designation_es, designation_en, empty_designation, include_in_designation) as (
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
    selection_hierarchy,
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
    d.selection_hierarchy,
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
where child_word_id is not null
on conflict (child_word_id, parent_word_id) do nothing;

commit;
`;
}

const words = parseRows();
const dependencies = resolveDependencies(words);
const sql = buildSql(words, dependencies);
writeFileSync(OUTPUT_PATH, sql, "utf8");

console.log(`Generated ${words.length + 1} rows (incl. Vazio) -> ${OUTPUT_PATH}`);
console.log(`  nivel 6.xlsx: ${words.filter((w) => w.source === "nivel 6.xlsx").length}`);
console.log(`  Nivel 5 H2: ${words.filter((w) => w.source === "Nivel 5.xlsx H2").length}`);
for (const dep of dependencies) {
  console.log(`  dep: ${dep.childLabel} -> ${dep.parentLevelKey}/${dep.parentNormalizedLabel}`);
}
for (const word of words) {
  const h = word.selectionHierarchy ? ` H${word.selectionHierarchy}` : "";
  console.log(
    `  [${word.source}${h}] ${word.label} (${word.referenceCode}) ES=${word.designationEs || "(vazio)"}`,
  );
}
