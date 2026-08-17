import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const XLSX = require("xlsx");

const EXCEL_PATH =
  "c:\\Users\\mviera\\OneDrive - Groupe GM\\PCsEquipment\\MiguelViera\\Desktop\\Nivel 5.xlsx";
const OUTPUT_PATH =
  "c:\\Users\\mviera\\AppData\\Local\\skus-git-work\\supabase\\migrations\\20260817120600_cosmetica_nivel5_packaging_dictionary.sql";
const NIVEL6_DATA_PATH =
  "c:\\Users\\mviera\\AppData\\Local\\skus-git-work\\scripts\\nivel6-extra-words-data.json";

const LEVEL = {
  key: "packaging",
  levelSqlName: "packaging_level",
  labelCol: "1. Tipo embalagem",
  abbrCol: "Abreviatura",
  desCol: "Designação PHC",
  hierarchyCol: "Hierarquia",
  rulesCol: "Regras",
  emptyIncludeInDesignation: true,
  wordIncludeInDesignation: true,
};

const FULL_TRANSLATIONS = {
  Caixa: { es: "Caja", en: "Box" },
  Papel: { es: "Papel", en: "Paper" },
  Polipropileno: { es: "PP", en: "PP" },
  Policarbonato: { es: "PC", en: "PC" },
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

/**
 * Dependencias embalagem -> palavra(s) pai.
 * parentMatch: "any" = OR (basta uma pai); "all" = AND (futuro).
 */
const PACKAGING_DEPENDENCY_RULES = [
  {
    childNormalizedLabel: "caixa",
    parentMatch: "any",
    parents: [
      { levelKey: "product", normalizedLabel: "sabonete", referenceCode: "SAB" },
      { levelKey: "product", normalizedLabel: "sabonete esfoliante", referenceCode: "SAB" },
    ],
  },
  {
    childNormalizedLabel: "flowpack",
    parentMatch: "any",
    parents: [
      { levelKey: "product", normalizedLabel: "sabonete", referenceCode: "SAB" },
      { levelKey: "product", normalizedLabel: "sabonete esfoliante", referenceCode: "SAB" },
    ],
  },
  {
    childNormalizedLabel: "allegro",
    parentMatch: "any",
    parents: [
      { levelKey: "product", normalizedLabel: "sabonete", referenceCode: "SAB" },
      { levelKey: "product", normalizedLabel: "sabonete esfoliante", referenceCode: "SAB" },
    ],
  },
  {
    childNormalizedLabel: "papel",
    parentMatch: "any",
    parents: [{ levelKey: "product", normalizedLabel: "sais de banho", referenceCode: "SAI" }],
  },
  {
    childNormalizedLabel: "aluminio cls",
    parentMatch: "any",
    parents: [
      { levelKey: "format", normalizedLabel: "garrafa ecofill", referenceCode: "ECO" },
      { levelKey: "format", normalizedLabel: "recarga ecofill", referenceCode: "ECO" },
    ],
  },
  {
    childNormalizedLabel: "aluminio slm",
    parentMatch: "any",
    parents: [
      { levelKey: "format", normalizedLabel: "garrafa ecofill", referenceCode: "ECO" },
      { levelKey: "format", normalizedLabel: "recarga ecofill", referenceCode: "ECO" },
    ],
  },
  {
    childNormalizedLabel: "polipropileno",
    parentMatch: "any",
    parents: [
      { levelKey: "format", normalizedLabel: "garrafa ecofill", referenceCode: "ECO" },
      { levelKey: "format", normalizedLabel: "recarga ecofill", referenceCode: "ECO" },
    ],
  },
  {
    childNormalizedLabel: "policarbonato",
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
  return String(raw ?? "").trim().toUpperCase();
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

  if (obs.includes("traducir só aluminio") || obs.includes("traducir so aluminio")) {
    const suffix = designationPt.replace(/^Aluminio\s*/i, "").trim();
    return {
      designationPt,
      designationEs: suffix ? `Aluminio ${suffix}` : "Aluminio",
      designationEn: suffix ? `Aluminum ${suffix}` : "Aluminum",
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

function parseRows() {
  const workbook = XLSX.readFile(EXCEL_PATH);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
  const observationCol = findObservationColumn(Object.keys(rows[0] ?? {}));
  const words = [];
  const hierarchyTwoWords = [];
  const seenLabels = new Set();
  let currentHierarchy = null;

  for (const row of rows) {
    currentHierarchy = parseHierarchy(row[LEVEL.hierarchyCol], currentHierarchy);

    const label = String(row[LEVEL.labelCol] ?? "").trim();
    const referenceCode = normalizeReferenceCode(row[LEVEL.abbrCol]);
    const designationPtRaw = String(row[LEVEL.desCol] ?? "").trim();
    const observation = observationCol ? String(row[observationCol] ?? "").trim() : "";
    const rules = String(row[LEVEL.rulesCol] ?? "").trim();

    if (!label || !referenceCode || label.includes("Outro Dados")) continue;
    if (!currentHierarchy) continue;

    const normalizedLabel = label.toLowerCase().trim();
    if (seenLabels.has(normalizedLabel)) {
      throw new Error(`Etiqueta duplicada: ${label}`);
    }
    if (!/^[A-Z0-9&.]{1,3}$/.test(referenceCode)) {
      throw new Error(`Referencia invalida (${referenceCode}) para ${label}`);
    }

    seenLabels.add(normalizedLabel);
    const tr = translateDesignations(label, designationPtRaw, observation);
    const word = {
      label,
      normalizedLabel,
      referenceCode,
      selectionHierarchy: currentHierarchy,
      designationPt: tr.designationPt,
      designationEs: tr.designationEs,
      designationEn: tr.designationEn,
      emptyDesignation: tr.emptyDesignation,
      includeInDesignation: tr.includeInDesignation,
      rules,
      observation,
    };

    if (currentHierarchy === 1) {
      words.push(word);
    } else if (currentHierarchy === 2) {
      hierarchyTwoWords.push(word);
    }
  }

  words.sort((left, right) => left.label.localeCompare(right.label, "pt"));
  hierarchyTwoWords.sort((left, right) => left.label.localeCompare(right.label, "pt"));
  return { words, hierarchyTwoWords };
}

function resolveDependencies(words) {
  const byLabel = new Map(words.map((word) => [word.normalizedLabel, word]));
  const resolved = [];

  for (const rule of PACKAGING_DEPENDENCY_RULES) {
    const child = byLabel.get(rule.childNormalizedLabel);
    if (!child) {
      throw new Error(`Dependencia definida para embalagem inexistente: ${rule.childNormalizedLabel}`);
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
  if (dependencies.length === 0) return "-- sem dependencias";

  return dependencies
    .map(
      (dep) => `  select
    c.id as category_id,
    child_w.id as child_word_id,
    parent_w.id as parent_word_id
  from cosmetica c
  cross join packaging_level pl
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
  const orGroups = [
    ...new Set(dependencies.filter((dep) => dep.parentMatch === "any").map((dep) => dep.childLabel)),
  ];

  return `-- Cosmetica / nivel 5 (packaging) — dicionario novo
-- Fonte: Nivel 5.xlsx hierarquia 1 (${words.length} embalagens + Vazio)
-- Hierarquia 2 ("Outros Dados") -> nivel 6 / extra (ver scripts/nivel6-extra-words-data.json)
-- Dependencias:
--   Caixa/Flowpack/ALLEGRO -> Sabonete(s) solidos (product / Nivel 3.xlsx)
--   Papel -> Sais de Banho (product / SAI)
--   Aluminio/Policarbonato/Polipropileno -> Ecofill (format / ECO, Garrafa ou Recarga)
-- NOTA gerador: arestas multiplas pais com OR para ${orGroups.join(", ")}
-- Executar apos 20260817120500_cosmetica_word_selection_hierarchy.sql

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
  using public.skus_words w, ${LEVEL.levelSqlName} ll, cosmetica c
  where e.child_word_id = w.id
    and (
      w.category_level_id = ll.id
      or (
        ll.legacy_field_type_id is not null
        and w.default_field_type_id = ll.legacy_field_type_id
        and (
          w.category_level_id is null
          or exists (
            select 1
            from public.skus_category_levels cl
            where cl.category_id = c.id
              and cl.key = '${LEVEL.key}'
              and cl.id = w.category_level_id
          )
        )
      )
    )
  returning e.id
),
removed_words as (
  delete from public.skus_words w
  using ${LEVEL.levelSqlName} ll, cosmetica c
  where w.category_level_id = ll.id
     or (
       ll.legacy_field_type_id is not null
       and w.default_field_type_id = ll.legacy_field_type_id
       and (
         w.category_level_id is null
         or exists (
           select 1
           from public.skus_category_levels cl
           where cl.category_id = c.id
             and cl.key = '${LEVEL.key}'
             and cl.id = w.category_level_id
         )
       )
     )
  returning w.id
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
on conflict (child_word_id, parent_word_id) do nothing;

commit;
`;
}

const { words, hierarchyTwoWords } = parseRows();
const dependencies = resolveDependencies(words);
const sql = buildSql(words, dependencies);
writeFileSync(OUTPUT_PATH, sql, "utf8");
writeFileSync(
  NIVEL6_DATA_PATH,
  JSON.stringify(
    {
      source: "Nivel 5.xlsx",
      targetLevelKey: "extra",
      selectionHierarchy: 2,
      fallbackRule:
        "Mostrar palavras hierarquia 2 no nivel 6 (extra) apenas se nenhuma palavra hierarquia 1 aplicavel estiver selecionada.",
      words: hierarchyTwoWords,
    },
    null,
    2,
  ),
  "utf8",
);

console.log(`Generated ${words.length + 1} packaging rows -> ${OUTPUT_PATH}`);
console.log(`Exported ${hierarchyTwoWords.length} hierarchy-2 words -> ${NIVEL6_DATA_PATH}`);
console.log("Dependencias:");
for (const rule of PACKAGING_DEPENDENCY_RULES) {
  console.log(
    `  ${rule.childNormalizedLabel} (${rule.parentMatch}) -> ${rule.parents.map((p) => `${p.levelKey}/${p.normalizedLabel}`).join(", ")}`,
  );
}
for (const word of words) {
  console.log(
    `  [H${word.selectionHierarchy}] ${word.label} (${word.referenceCode}) PT=${word.designationPt} ES=${word.designationEs} EN=${word.designationEn}`,
  );
}
