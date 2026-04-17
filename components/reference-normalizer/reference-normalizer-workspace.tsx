"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { Download, FileSpreadsheet, Play, Plus, RefreshCcw, Save, Search, Settings2, Sparkles, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { detectColumns } from "@/lib/reference-normalizer/column-detection";
import { processRow } from "@/lib/reference-normalizer/row-processor";
import type {
  CatalogEntry,
  NormalizerCategory,
  NormalizerConfig,
  NormalizerRule,
  NormalizerStatus,
  RowProcessResult,
  WorkbookSheetData,
} from "@/lib/reference-normalizer/types";
import { cleanText, countCharacters } from "@/lib/reference-normalizer/normalization";
import { downloadNormalizerTemplate, downloadProcessedWorkbook, readWorkbookFile } from "@/lib/reference-normalizer/xlsx";

type WorkspaceProps = { initialConfig: NormalizerConfig };
type TabId = "process" | "rules" | "simulator" | "catalog";

type RuleDraft = {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  priority: number;
  stage: NormalizerRule["stage"];
  matchType: NormalizerRule["matchType"];
  matchLogic: NormalizerRule["matchLogic"];
  conditionsText: string;
  actionsText: string;
  source: "system" | "user";
  notes: string;
};

type CatalogDraft = {
  id: string;
  category: NormalizerCategory;
  canonicalValue: string;
  code: string;
  usable: boolean;
  enabled: boolean;
  labelPt: string;
  labelEs: string;
  labelEn: string;
  aliasesText: string;
  notes: string;
  sortOrder: number;
};

function statusVariant(status: NormalizerStatus) {
  if (status === "OK") return "success" as const;
  if (status === "MANUAL") return "default" as const;
  return "outline" as const;
}

function summarizeRows(rows: RowProcessResult[]) {
  return {
    total: rows.length,
    OK: rows.filter((row) => row.status === "OK").length,
    REVIEW: rows.filter((row) => row.status === "REVIEW").length,
    ERROR: rows.filter((row) => row.status === "ERROR").length,
    MANUAL: rows.filter((row) => row.status === "MANUAL").length,
  };
}

function makeRuleDraft(rule?: NormalizerRule): RuleDraft {
  return {
    id: rule?.id ?? `rule-${Date.now()}`,
    name: rule?.name ?? "",
    description: rule?.description ?? "",
    enabled: rule?.enabled ?? true,
    priority: rule?.priority ?? 100,
    stage: rule?.stage ?? "designation",
    matchType: rule?.matchType ?? "contains",
    matchLogic: rule?.matchLogic ?? "and",
    conditionsText: JSON.stringify(rule?.conditions ?? [{ field: "oldDesignation", matchType: "contains", value: "" }], null, 2),
    actionsText: JSON.stringify(rule?.actions ?? [{ type: "addValidationWarning", message: "" }], null, 2),
    source: rule?.source ?? "user",
    notes: rule?.notes ?? "",
  };
}

function makeCatalogDraft(entry?: CatalogEntry): CatalogDraft {
  return {
    id: entry?.id ?? `catalog-${Date.now()}`,
    category: entry?.category ?? "brand",
    canonicalValue: entry?.canonicalValue ?? "",
    code: entry?.code ?? "",
    usable: entry?.usable ?? true,
    enabled: entry?.enabled ?? true,
    labelPt: entry?.labels.pt ?? "",
    labelEs: entry?.labels.es ?? "",
    labelEn: entry?.labels.en ?? "",
    aliasesText: (entry?.detectionAliases ?? []).join(", "),
    notes: entry?.notes ?? "",
    sortOrder: entry?.sortOrder ?? 999,
  };
}

function createRuleFromRow(row: RowProcessResult): RuleDraft {
  return {
    id: `rule-${Date.now()}`,
    name: `Regra para ${row.oldReference || "caso manual"}`,
    description: "Criada a partir de um caso processado.",
    enabled: true,
    priority: 120,
    stage: "designation",
    matchType: "contains",
    matchLogic: "and",
    conditionsText: JSON.stringify([{ field: "oldDesignation", matchType: "contains", value: row.oldDesignation }], null, 2),
    actionsText: JSON.stringify([{ type: "addValidationWarning", message: row.observations.join(" | ") || "Ajuste manual" }], null, 2),
    source: "user",
    notes: "Criada desde a tabela/simulador.",
  };
}

async function postJson(url: string, body: unknown) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(String((payload as { error?: string }).error ?? "Erro inesperado."));
  return payload;
}

export function ReferenceNormalizerWorkspace({ initialConfig }: WorkspaceProps) {
  const [activeTab, setActiveTab] = useState<TabId>("process");
  const [config, setConfig] = useState(initialConfig);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [sheets, setSheets] = useState<WorkbookSheetData[]>([]);
  const [selectedSheetName, setSelectedSheetName] = useState("");
  const [referenceColumn, setReferenceColumn] = useState("");
  const [designationColumn, setDesignationColumn] = useState("");
  const [keepExtraColumns, setKeepExtraColumns] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState({ completed: 0, total: 0 });
  const [processedRows, setProcessedRows] = useState<RowProcessResult[]>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<NormalizerStatus | "ALL">("ALL");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [selectedTraceRow, setSelectedTraceRow] = useState<RowProcessResult | null>(null);
  const [savingMessage, setSavingMessage] = useState("");
  const [ruleDraft, setRuleDraft] = useState(makeRuleDraft());
  const [catalogDraft, setCatalogDraft] = useState(makeCatalogDraft());
  const [catalogCategoryFilter, setCatalogCategoryFilter] = useState<NormalizerCategory | "all">("all");
  const [catalogSearch, setCatalogSearch] = useState("");
  const [ruleSearch, setRuleSearch] = useState("");
  const [settingsDraft, setSettingsDraft] = useState(initialConfig.settings);
  const [simReference, setSimReference] = useState("");
  const [simDesignation, setSimDesignation] = useState("");
  const workerRef = useRef<Worker | null>(null);

  const selectedSheet = useMemo(
    () => sheets.find((sheet) => sheet.sheetName === selectedSheetName) ?? null,
    [selectedSheetName, sheets],
  );

  const deferredSimReference = useDeferredValue(simReference);
  const deferredSimDesignation = useDeferredValue(simDesignation);
  const simulatorResult = useMemo(() => {
    if (!deferredSimReference && !deferredSimDesignation) return null;
    return processRow(
      { rowNumber: 1, originalRow: {}, oldReference: deferredSimReference, oldDesignation: deferredSimDesignation, keepExtraColumns: false },
      config,
    );
  }, [config, deferredSimDesignation, deferredSimReference]);

  const filteredRows = useMemo(() => {
    return processedRows.filter((row) => {
      if (statusFilter !== "ALL" && row.status !== statusFilter) return false;
      if (!globalFilter.trim()) return true;
      const haystack = `${row.oldReference} ${row.oldDesignation} ${row.newReference} ${row.designationPt} ${row.designationEs} ${row.designationEn}`.toLowerCase();
      return haystack.includes(globalFilter.toLowerCase());
    });
  }, [globalFilter, processedRows, statusFilter]);

  const filteredRules = useMemo(() => {
    if (!ruleSearch.trim()) return config.rules;
    return config.rules.filter((rule) => `${rule.name} ${rule.description} ${rule.stage}`.toLowerCase().includes(ruleSearch.toLowerCase()));
  }, [config.rules, ruleSearch]);

  const filteredCatalog = useMemo(() => {
    return config.catalog.filter((entry) => {
      if (catalogCategoryFilter !== "all" && entry.category !== catalogCategoryFilter) return false;
      if (!catalogSearch.trim()) return true;
      return `${entry.canonicalValue} ${entry.code} ${entry.detectionAliases.join(" ")}`.toLowerCase().includes(catalogSearch.toLowerCase());
    });
  }, [catalogCategoryFilter, catalogSearch, config.catalog]);

  useEffect(() => () => workerRef.current?.terminate(), []);

  async function refreshConfig() {
    const response = await fetch("/api/reference-normalizer/config", { cache: "no-store" });
    const payload = (await response.json()) as NormalizerConfig;
    setConfig(payload);
    setSettingsDraft(payload.settings);
  }

  async function handleFile(file: File | null) {
    if (!file) return;
    setSelectedFile(file);
    const workbookSheets = await readWorkbookFile(file);
    setSheets(workbookSheets);
    const firstSheet = workbookSheets[0];
    setSelectedSheetName(firstSheet?.sheetName ?? "");
    if (firstSheet) {
      const detection = detectColumns(firstSheet.columns);
      setReferenceColumn(detection.referenceColumn ?? "");
      setDesignationColumn(detection.designationColumn ?? "");
    }
  }

  function updateRowManually(rowNumber: number, field: "newReference" | "designationPt" | "designationEs" | "designationEn", value: string) {
    setProcessedRows((current) =>
      current.map((row) => {
        if (row.rowNumber !== rowNumber) return row;
        const next = { ...row, [field]: value, status: "MANUAL" as const, manualEdited: true };
        next.charactersPt = countCharacters(next.designationPt);
        next.charactersEs = countCharacters(next.designationEs);
        next.charactersEn = countCharacters(next.designationEn);
        return next;
      }),
    );
  }

  const columns = useMemo<ColumnDef<RowProcessResult>[]>(
    () => [
      { accessorKey: "rowNumber", header: "#", cell: (info) => info.getValue<number>() },
      { accessorKey: "oldReference", header: "Referencia antiga" },
      { accessorKey: "oldDesignation", header: "Designacao antiga", cell: (info) => <span className="line-clamp-2">{String(info.getValue())}</span> },
      {
        accessorKey: "newReference",
        header: "Referencia nova",
        cell: ({ row }) => <input value={row.original.newReference} onChange={(event) => updateRowManually(row.original.rowNumber, "newReference", event.target.value)} className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100" />,
      },
      {
        accessorKey: "designationPt",
        header: "PT",
        cell: ({ row }) => <input value={row.original.designationPt} onChange={(event) => updateRowManually(row.original.rowNumber, "designationPt", event.target.value)} className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100" />,
      },
      {
        accessorKey: "designationEs",
        header: "ES",
        cell: ({ row }) => <input value={row.original.designationEs} onChange={(event) => updateRowManually(row.original.rowNumber, "designationEs", event.target.value)} className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100" />,
      },
      {
        accessorKey: "designationEn",
        header: "EN",
        cell: ({ row }) => <input value={row.original.designationEn} onChange={(event) => updateRowManually(row.original.rowNumber, "designationEn", event.target.value)} className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100" />,
      },
      { accessorKey: "status", header: "Status", cell: ({ row }) => <Badge variant={statusVariant(row.original.status)}>{row.original.status}</Badge> },
      {
        id: "actions",
        header: "Acoes",
        cell: ({ row }) => (
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="h-9 px-3 text-xs" onClick={() => setSelectedTraceRow(row.original)}>Detalhe</Button>
            <Button type="button" variant="outline" className="h-9 px-3 text-xs" onClick={() => { setRuleDraft(createRuleFromRow(row.original)); setActiveTab("rules"); }}>Criar regra</Button>
          </div>
        ),
      },
    ],
    [],
  );

  const table = useReactTable({
    data: filteredRows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  async function runProcessing() {
    if (!selectedSheet || !referenceColumn || !designationColumn) return;

    const rowsToProcess = selectedSheet.rows.map((row, index) => ({
      rowNumber: index + 1,
      originalRow: row,
      oldReference: cleanText(row[referenceColumn]),
      oldDesignation: cleanText(row[designationColumn]),
      keepExtraColumns,
    }));

    setProcessing(true);
    setProgress({ completed: 0, total: rowsToProcess.length });
    setProcessedRows([]);
    setSelectedTraceRow(null);

    const worker = new Worker(new URL("./processor.worker.ts", import.meta.url));
    workerRef.current = worker;

    worker.onmessage = (event: MessageEvent) => {
      if (event.data.type === "progress") {
        setProgress({ completed: event.data.completed, total: event.data.total });
      }
      if (event.data.type === "done") {
        setProcessedRows(event.data.rows as RowProcessResult[]);
        setProcessing(false);
        worker.terminate();
        workerRef.current = null;
      }
    };

    worker.postMessage({ config, rows: rowsToProcess });
  }

  async function saveRuleDraft() {
    await postJson("/api/reference-normalizer/rules", {
      action: "save",
      rule: {
        id: ruleDraft.id,
        name: ruleDraft.name,
        description: ruleDraft.description,
        enabled: ruleDraft.enabled,
        priority: Number(ruleDraft.priority),
        stage: ruleDraft.stage,
        matchType: ruleDraft.matchType,
        matchLogic: ruleDraft.matchLogic,
        conditions: JSON.parse(ruleDraft.conditionsText),
        actions: JSON.parse(ruleDraft.actionsText),
        source: ruleDraft.source,
        notes: ruleDraft.notes,
      },
    });
    setSavingMessage("Regra guardada com sucesso.");
    await refreshConfig();
  }

  async function saveCatalogDraft() {
    await postJson("/api/reference-normalizer/catalog", {
      action: "save",
      entry: {
        id: catalogDraft.id,
        category: catalogDraft.category,
        canonicalValue: catalogDraft.canonicalValue,
        code: catalogDraft.code,
        usable: catalogDraft.usable,
        enabled: catalogDraft.enabled,
        labels: { pt: catalogDraft.labelPt, es: catalogDraft.labelEs, en: catalogDraft.labelEn },
        detectionAliases: catalogDraft.aliasesText.split(",").map((item) => item.trim()).filter(Boolean),
        notes: catalogDraft.notes,
        metadata: {},
        sortOrder: Number(catalogDraft.sortOrder),
      },
    });
    setSavingMessage("Catalogo guardado com sucesso.");
    await refreshConfig();
  }

  async function saveSettings() {
    await postJson("/api/reference-normalizer/settings", { settings: settingsDraft });
    setSavingMessage("Limites guardados com sucesso.");
    await refreshConfig();
  }

  async function importJsonFile(file: File, type: "rules" | "catalog") {
    const text = await file.text();
    const payload = JSON.parse(text);
    await postJson(`/api/reference-normalizer/${type}`, {
      action: "import",
      [type === "rules" ? "rules" : "catalog"]: payload,
    });
    setSavingMessage(type === "rules" ? "Regras importadas." : "Catalogo importado.");
    await refreshConfig();
  }

  function exportJsonFile(filename: string, payload: unknown) {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-50">Normalizador de Referencias</h1>
        <p className="mt-2 max-w-4xl text-sm text-slate-400">
          Carrega ficheiros, recodifica referencias, gera designacoes PT/ES/EN e permite afinar regras e catalogo sem tocar em codigo.
        </p>
      </div>

      {savingMessage ? (
        <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          {savingMessage}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {[
          { id: "process", label: "Processar Excel", icon: FileSpreadsheet },
          { id: "rules", label: "Editor de regras", icon: Settings2 },
          { id: "simulator", label: "Simulador", icon: Sparkles },
          { id: "catalog", label: "Catalogo mestre", icon: Search },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <Button key={tab.id} type="button" variant={activeTab === tab.id ? "default" : "outline"} onClick={() => setActiveTab(tab.id as TabId)}>
              <Icon className="mr-2 h-4 w-4" />
              {tab.label}
            </Button>
          );
        })}
      </div>

      {activeTab === "process" ? (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Carga de ficheiro</CardTitle>
              <CardDescription>Suporta `.xlsx`, `.xls` e `.csv` e deteta automaticamente a folha e as colunas principais.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <label className="flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-slate-700 bg-slate-950/50 px-6 py-8 text-center">
                <Upload className="mb-3 h-8 w-8 text-amber-300" />
                <div className="font-medium text-slate-100">Arrasta o ficheiro aqui ou clica para selecionar</div>
                <div className="mt-2 text-sm text-slate-400">Colunas minimas: Referencia_antiga e Designacao_antiga.</div>
                <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(event) => void handleFile(event.target.files?.[0] ?? null)} />
              </label>

              <div className="flex flex-wrap gap-3">
                <Button type="button" variant="outline" onClick={() => downloadNormalizerTemplate()}>
                  <Download className="mr-2 h-4 w-4" />
                  Descarregar plantilla
                </Button>
                {selectedFile ? <Badge variant="outline">{selectedFile.name} - {(selectedFile.size / 1024).toFixed(1)} KB</Badge> : null}
              </div>

              {sheets.length > 0 ? (
                <label className="space-y-2">
                  <span className="text-sm text-slate-300">Folha</span>
                  <select
                    value={selectedSheetName}
                    onChange={(event) => {
                      const nextSheet = sheets.find((sheet) => sheet.sheetName === event.target.value);
                      setSelectedSheetName(event.target.value);
                      if (nextSheet) {
                        const detection = detectColumns(nextSheet.columns);
                        setReferenceColumn(detection.referenceColumn ?? "");
                        setDesignationColumn(detection.designationColumn ?? "");
                      }
                    }}
                    className="flex h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
                  >
                    {sheets.map((sheet) => (
                      <option key={sheet.sheetName} value={sheet.sheetName}>
                        {sheet.sheetName}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Mapeamento de colunas</CardTitle>
              <CardDescription>Podes confirmar ou corrigir o mapeamento antes do processamento.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm text-slate-300">Referencia antiga</span>
                <select value={referenceColumn} onChange={(event) => setReferenceColumn(event.target.value)} className="flex h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100">
                  <option value="">Selecionar...</option>
                  {(selectedSheet?.columns ?? []).map((column) => (
                    <option key={column} value={column}>
                      {column}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-sm text-slate-300">Designacao antiga</span>
                <select value={designationColumn} onChange={(event) => setDesignationColumn(event.target.value)} className="flex h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100">
                  <option value="">Selecionar...</option>
                  {(selectedSheet?.columns ?? []).map((column) => (
                    <option key={column} value={column}>
                      {column}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-950/60 px-4 py-3 md:col-span-2">
                <input type="checkbox" checked={keepExtraColumns} onChange={(event) => setKeepExtraColumns(event.target.checked)} className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-amber-400" />
                <div>
                  <p className="text-sm font-medium text-slate-100">Conservar colunas adicionais no export</p>
                  <p className="text-xs text-slate-400">Mantem os dados originais no `.xlsx` final.</p>
                </div>
              </label>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Processamento</CardTitle>
              <CardDescription>O processamento corre em background no navegador para evitar bloquear a pagina.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-3">
                <Button type="button" onClick={() => void runProcessing()} disabled={!selectedSheet || !referenceColumn || !designationColumn || processing}>
                  <Play className="mr-2 h-4 w-4" />
                  {processing ? "A processar..." : "Processar ficheiro"}
                </Button>
                <Button type="button" variant="outline" disabled={processedRows.length === 0} onClick={() => downloadProcessedWorkbook(processedRows, selectedSheetName || "Resultados", keepExtraColumns)}>
                  <Download className="mr-2 h-4 w-4" />
                  Exportar XLSX
                </Button>
              </div>

              {progress.total > 0 ? (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm text-slate-300">
                    <span>Progresso</span>
                    <span>{progress.completed}/{progress.total}</span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-slate-800">
                    <div className="h-full bg-amber-400 transition-all" style={{ width: `${Math.round((progress.completed / progress.total) * 100)}%` }} />
                  </div>
                </div>
              ) : null}

              {processedRows.length > 0 ? (
                <div className="grid gap-3 md:grid-cols-5">
                  {Object.entries(summarizeRows(processedRows)).map(([label, value]) => (
                    <div key={label} className="rounded-xl border border-slate-700 bg-slate-950/50 p-4">
                      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
                      <div className="mt-2 text-2xl font-semibold text-slate-50">{value}</div>
                    </div>
                  ))}
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Tabela de resultados</CardTitle>
              <CardDescription>Podes pesquisar, filtrar, editar manualmente e abrir o detalhe tecnico de cada linha.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-3">
                <label className="relative min-w-[18rem]">
                  <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-500" />
                  <input value={globalFilter} onChange={(event) => setGlobalFilter(event.target.value)} placeholder="Pesquisar referencia ou texto..." className="h-11 w-full rounded-lg border border-slate-700 bg-slate-950 pl-10 pr-3 text-sm text-slate-100" />
                </label>
                <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as NormalizerStatus | "ALL")} className="h-11 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100">
                  <option value="ALL">Todos os estados</option>
                  <option value="OK">OK</option>
                  <option value="REVIEW">REVIEW</option>
                  <option value="ERROR">ERROR</option>
                  <option value="MANUAL">MANUAL</option>
                </select>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-700">
                <table className="min-w-full divide-y divide-slate-800 text-sm">
                  <thead className="bg-slate-950/80">
                    {table.getHeaderGroups().map((headerGroup) => (
                      <tr key={headerGroup.id}>
                        {headerGroup.headers.map((header) => (
                          <th key={header.id} className="px-3 py-3 text-left font-medium text-slate-300">
                            {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                          </th>
                        ))}
                      </tr>
                    ))}
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {table.getRowModel().rows.map((row) => (
                      <tr key={row.id} className="align-top">
                        {row.getVisibleCells().map((cell) => (
                          <td key={cell.id} className="px-3 py-3 text-slate-200">
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {processedRows.length > 0 ? (
                <div className="flex items-center justify-between">
                  <div className="text-sm text-slate-400">Pagina {table.getState().pagination.pageIndex + 1} de {table.getPageCount() || 1}</div>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" disabled={!table.getCanPreviousPage()} onClick={() => table.previousPage()}>Anterior</Button>
                    <Button type="button" variant="outline" disabled={!table.getCanNextPage()} onClick={() => table.nextPage()}>Seguinte</Button>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>

          {selectedTraceRow ? (
            <Card>
              <CardHeader>
                <CardTitle>Detalhe da linha #{selectedTraceRow.rowNumber}</CardTitle>
                <CardDescription>Mostra segmentos, regras disparadas e observacoes geradas.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <pre className="overflow-auto rounded-xl border border-slate-700 bg-slate-950 p-4 text-xs text-slate-300">
                  {JSON.stringify(
                    {
                      segments: {
                        brand: selectedTraceRow.segments.brand?.canonicalValue ?? "",
                        format: selectedTraceRow.segments.format?.canonicalValue ?? "",
                        product: selectedTraceRow.segments.product?.canonicalValue ?? "",
                        size: selectedTraceRow.segments.size?.canonicalValue ?? "",
                        packaging: selectedTraceRow.segments.packaging?.canonicalValue ?? "",
                        extra: selectedTraceRow.segments.extra?.canonicalValue ?? "",
                      },
                      parsedReferenceSegments: selectedTraceRow.trace.parsedReferenceSegments,
                      descriptionMatches: selectedTraceRow.trace.descriptionMatches,
                    },
                    null,
                    2,
                  )}
                </pre>
                <div className="space-y-3">
                  <div>
                    <div className="text-xs uppercase tracking-wide text-slate-500">Regras disparadas</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {selectedTraceRow.trace.triggeredRules.length > 0 ? selectedTraceRow.trace.triggeredRules.map((rule) => <Badge key={rule} variant="outline">{rule}</Badge>) : <span className="text-sm text-slate-400">Sem regras disparadas.</span>}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wide text-slate-500">Observacoes</div>
                    <ul className="mt-2 space-y-2 text-sm text-slate-300">
                      {selectedTraceRow.observations.length > 0 ? selectedTraceRow.observations.map((item, index) => <li key={`${item}-${index}`}>{item}</li>) : <li>Sem observacoes.</li>}
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>Limites por idioma</CardTitle>
              <CardDescription>Define o teto maximo por idioma para destacar linhas perto do limite.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-4">
              <label className="space-y-2"><span className="text-sm text-slate-300">PT</span><input type="number" value={settingsDraft.charLimitPt} onChange={(event) => setSettingsDraft((current) => ({ ...current, charLimitPt: Number(event.target.value) }))} className="h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100" /></label>
              <label className="space-y-2"><span className="text-sm text-slate-300">ES</span><input type="number" value={settingsDraft.charLimitEs} onChange={(event) => setSettingsDraft((current) => ({ ...current, charLimitEs: Number(event.target.value) }))} className="h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100" /></label>
              <label className="space-y-2"><span className="text-sm text-slate-300">EN</span><input type="number" value={settingsDraft.charLimitEn} onChange={(event) => setSettingsDraft((current) => ({ ...current, charLimitEn: Number(event.target.value) }))} className="h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100" /></label>
              <div className="flex items-end"><Button type="button" onClick={() => void saveSettings()}><Save className="mr-2 h-4 w-4" />Guardar limites</Button></div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {activeTab === "simulator" ? (
        <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
          <Card>
            <CardHeader>
              <CardTitle>Simulador de regras</CardTitle>
              <CardDescription>Testa a referencia e a designacao antiga em tempo real.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <label className="space-y-2"><span className="text-sm text-slate-300">Referencia antiga</span><input value={simReference} onChange={(event) => setSimReference(event.target.value)} className="h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100" /></label>
              <label className="space-y-2"><span className="text-sm text-slate-300">Designacao antiga</span><textarea value={simDesignation} onChange={(event) => setSimDesignation(event.target.value)} className="min-h-36 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-slate-100" /></label>
              <Button type="button" variant="outline" onClick={() => { if (!simulatorResult) return; setRuleDraft(createRuleFromRow(simulatorResult)); setActiveTab("rules"); }}><Plus className="mr-2 h-4 w-4" />Criar regra a partir deste caso</Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Resultado em tempo real</CardTitle>
              <CardDescription>Mostra a referencia nova, designacoes por idioma e regras disparadas.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {simulatorResult ? (
                <>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-xl border border-slate-700 bg-slate-950/50 p-4"><div className="text-xs uppercase tracking-wide text-slate-500">Referencia nova</div><div className="mt-2 text-lg font-semibold text-slate-50">{simulatorResult.newReference || "-"}</div></div>
                    <div className="rounded-xl border border-slate-700 bg-slate-950/50 p-4"><div className="text-xs uppercase tracking-wide text-slate-500">Status</div><div className="mt-2"><Badge variant={statusVariant(simulatorResult.status)}>{simulatorResult.status}</Badge></div></div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-3">
                    {[
                      ["PT", simulatorResult.designationPt, simulatorResult.charactersPt],
                      ["ES", simulatorResult.designationEs, simulatorResult.charactersEs],
                      ["EN", simulatorResult.designationEn, simulatorResult.charactersEn],
                    ].map(([label, value, count]) => (
                      <div key={label} className="rounded-xl border border-slate-700 bg-slate-950/50 p-4">
                        <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
                        <div className="mt-2 text-sm text-slate-100">{String(value) || "-"}</div>
                        <div className="mt-3 text-xs text-slate-500">{count} caracteres</div>
                      </div>
                    ))}
                  </div>
                  <pre className="overflow-auto rounded-xl border border-slate-700 bg-slate-950 p-4 text-xs text-slate-300">
                    {JSON.stringify({ triggeredRules: simulatorResult.trace.triggeredRules, warnings: simulatorResult.observations }, null, 2)}
                  </pre>
                </>
              ) : (
                <div className="rounded-xl border border-slate-700 bg-slate-950/50 p-6 text-sm text-slate-400">Introduz uma referencia e uma designacao para ver o resultado.</div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {activeTab === "rules" ? (
        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.2fr]">
          <Card>
            <CardHeader><CardTitle>Editor de regras</CardTitle><CardDescription>Guarda, importa/exporta JSON e restaura os defaults do motor.</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-3">
                <Button type="button" variant="outline" onClick={() => setRuleDraft(makeRuleDraft())}><Plus className="mr-2 h-4 w-4" />Nova regra</Button>
                <Button type="button" variant="outline" onClick={() => exportJsonFile("normalizer-rules.json", config.rules)}><Download className="mr-2 h-4 w-4" />Exportar JSON</Button>
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-100">
                  <Upload className="h-4 w-4" />Importar JSON
                  <input type="file" accept=".json" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importJsonFile(file, "rules"); }} />
                </label>
                <Button type="button" variant="outline" onClick={() => void postJson("/api/reference-normalizer/rules", { action: "restore-defaults" }).then(refreshConfig)}><RefreshCcw className="mr-2 h-4 w-4" />Restaurar defaults</Button>
              </div>

              <label className="space-y-2"><span className="text-sm text-slate-300">Nome</span><input value={ruleDraft.name} onChange={(event) => setRuleDraft((current) => ({ ...current, name: event.target.value }))} className="h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100" /></label>
              <label className="space-y-2"><span className="text-sm text-slate-300">Descricao</span><input value={ruleDraft.description} onChange={(event) => setRuleDraft((current) => ({ ...current, description: event.target.value }))} className="h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100" /></label>
              <div className="grid gap-4 md:grid-cols-3">
                <label className="space-y-2"><span className="text-sm text-slate-300">Stage</span><select value={ruleDraft.stage} onChange={(event) => setRuleDraft((current) => ({ ...current, stage: event.target.value as NormalizerRule["stage"] }))} className="h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"><option value="preprocess">preprocess</option><option value="detect">detect</option><option value="reference">reference</option><option value="designation">designation</option><option value="validation">validation</option></select></label>
                <label className="space-y-2"><span className="text-sm text-slate-300">Prioridade</span><input type="number" value={ruleDraft.priority} onChange={(event) => setRuleDraft((current) => ({ ...current, priority: Number(event.target.value) }))} className="h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100" /></label>
                <label className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-950/60 px-4 py-3"><input type="checkbox" checked={ruleDraft.enabled} onChange={(event) => setRuleDraft((current) => ({ ...current, enabled: event.target.checked }))} className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-amber-400" /><span className="text-sm text-slate-100">Ativa</span></label>
              </div>
              <label className="space-y-2"><span className="text-sm text-slate-300">Conditions JSON</span><textarea value={ruleDraft.conditionsText} onChange={(event) => setRuleDraft((current) => ({ ...current, conditionsText: event.target.value }))} className="min-h-36 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-slate-100" /></label>
              <label className="space-y-2"><span className="text-sm text-slate-300">Actions JSON</span><textarea value={ruleDraft.actionsText} onChange={(event) => setRuleDraft((current) => ({ ...current, actionsText: event.target.value }))} className="min-h-40 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-slate-100" /></label>
              <div className="flex gap-3"><Button type="button" onClick={() => void saveRuleDraft()}><Save className="mr-2 h-4 w-4" />Guardar regra</Button><Button type="button" variant="outline" onClick={() => setRuleDraft(makeRuleDraft())}>Limpar</Button></div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Regras atuais</CardTitle><CardDescription>Seleciona uma regra para editar, duplicar ou eliminar.</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <label className="relative"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-500" /><input value={ruleSearch} onChange={(event) => setRuleSearch(event.target.value)} placeholder="Pesquisar regra..." className="h-11 w-full rounded-lg border border-slate-700 bg-slate-950 pl-10 pr-3 text-sm text-slate-100" /></label>
              <div className="space-y-3">
                {filteredRules.map((rule) => (
                  <div key={rule.id} className="rounded-xl border border-slate-700 bg-slate-950/50 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div><div className="font-medium text-slate-100">{rule.name}</div><div className="mt-1 text-sm text-slate-400">{rule.description}</div></div>
                      <div className="flex gap-2"><Badge variant="outline">{rule.stage}</Badge><Badge variant={rule.enabled ? "success" : "outline"}>{rule.enabled ? "Ativa" : "Inativa"}</Badge></div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button type="button" variant="outline" onClick={() => setRuleDraft(makeRuleDraft(rule))}>Editar</Button>
                      <Button type="button" variant="outline" onClick={() => void postJson("/api/reference-normalizer/rules", { action: "duplicate", ruleId: rule.id }).then(refreshConfig)}>Duplicar</Button>
                      <Button type="button" variant="outline" onClick={() => void postJson("/api/reference-normalizer/rules", { action: "delete", ruleId: rule.id }).then(refreshConfig)}>Eliminar</Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {activeTab === "catalog" ? (
        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.2fr]">
          <Card>
            <CardHeader><CardTitle>Editor do catalogo</CardTitle><CardDescription>Gere abreviaturas, labels, aliases e ativacao por categoria.</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-3">
                <Button type="button" variant="outline" onClick={() => setCatalogDraft(makeCatalogDraft())}><Plus className="mr-2 h-4 w-4" />Nova entrada</Button>
                <Button type="button" variant="outline" onClick={() => exportJsonFile("normalizer-catalog.json", config.catalog)}><Download className="mr-2 h-4 w-4" />Exportar JSON</Button>
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-100">
                  <Upload className="h-4 w-4" />Importar JSON
                  <input type="file" accept=".json" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importJsonFile(file, "catalog"); }} />
                </label>
                <Button type="button" variant="outline" onClick={() => void postJson("/api/reference-normalizer/catalog", { action: "restore-defaults" }).then(refreshConfig)}><RefreshCcw className="mr-2 h-4 w-4" />Restaurar defaults</Button>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2"><span className="text-sm text-slate-300">Categoria</span><select value={catalogDraft.category} onChange={(event) => setCatalogDraft((current) => ({ ...current, category: event.target.value as NormalizerCategory }))} className="h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"><option value="brand">brand</option><option value="format">format</option><option value="product">product</option><option value="size">size</option><option value="packaging">packaging</option><option value="extra">extra</option></select></label>
                <label className="space-y-2"><span className="text-sm text-slate-300">Codigo</span><input value={catalogDraft.code} onChange={(event) => setCatalogDraft((current) => ({ ...current, code: event.target.value }))} className="h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100" /></label>
              </div>
              <label className="space-y-2"><span className="text-sm text-slate-300">Valor canonico</span><input value={catalogDraft.canonicalValue} onChange={(event) => setCatalogDraft((current) => ({ ...current, canonicalValue: event.target.value }))} className="h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100" /></label>
              <div className="grid gap-4 md:grid-cols-3">
                <label className="space-y-2"><span className="text-sm text-slate-300">Label PT</span><input value={catalogDraft.labelPt} onChange={(event) => setCatalogDraft((current) => ({ ...current, labelPt: event.target.value }))} className="h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100" /></label>
                <label className="space-y-2"><span className="text-sm text-slate-300">Label ES</span><input value={catalogDraft.labelEs} onChange={(event) => setCatalogDraft((current) => ({ ...current, labelEs: event.target.value }))} className="h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100" /></label>
                <label className="space-y-2"><span className="text-sm text-slate-300">Label EN</span><input value={catalogDraft.labelEn} onChange={(event) => setCatalogDraft((current) => ({ ...current, labelEn: event.target.value }))} className="h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100" /></label>
              </div>
              <label className="space-y-2"><span className="text-sm text-slate-300">Aliases (separados por virgula)</span><textarea value={catalogDraft.aliasesText} onChange={(event) => setCatalogDraft((current) => ({ ...current, aliasesText: event.target.value }))} className="min-h-32 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-slate-100" /></label>
              <div className="grid gap-4 md:grid-cols-3">
                <label className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-950/60 px-4 py-3"><input type="checkbox" checked={catalogDraft.usable} onChange={(event) => setCatalogDraft((current) => ({ ...current, usable: event.target.checked }))} className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-amber-400" /><span className="text-sm text-slate-100">Usavel</span></label>
                <label className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-950/60 px-4 py-3"><input type="checkbox" checked={catalogDraft.enabled} onChange={(event) => setCatalogDraft((current) => ({ ...current, enabled: event.target.checked }))} className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-amber-400" /><span className="text-sm text-slate-100">Ativa</span></label>
                <label className="space-y-2"><span className="text-sm text-slate-300">Ordem</span><input type="number" value={catalogDraft.sortOrder} onChange={(event) => setCatalogDraft((current) => ({ ...current, sortOrder: Number(event.target.value) }))} className="h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100" /></label>
              </div>
              <label className="space-y-2"><span className="text-sm text-slate-300">Notas</span><textarea value={catalogDraft.notes} onChange={(event) => setCatalogDraft((current) => ({ ...current, notes: event.target.value }))} className="min-h-28 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-slate-100" /></label>
              <div className="flex gap-3"><Button type="button" onClick={() => void saveCatalogDraft()}><Save className="mr-2 h-4 w-4" />Guardar entrada</Button><Button type="button" variant="outline" onClick={() => setCatalogDraft(makeCatalogDraft())}>Limpar</Button></div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Entradas atuais</CardTitle><CardDescription>Podes pesquisar, filtrar por categoria e editar rapidamente.</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-3">
                <label className="relative min-w-[18rem]"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-500" /><input value={catalogSearch} onChange={(event) => setCatalogSearch(event.target.value)} placeholder="Pesquisar entrada..." className="h-11 w-full rounded-lg border border-slate-700 bg-slate-950 pl-10 pr-3 text-sm text-slate-100" /></label>
                <select value={catalogCategoryFilter} onChange={(event) => setCatalogCategoryFilter(event.target.value as NormalizerCategory | "all")} className="h-11 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"><option value="all">Todas as categorias</option><option value="brand">brand</option><option value="format">format</option><option value="product">product</option><option value="size">size</option><option value="packaging">packaging</option><option value="extra">extra</option></select>
              </div>
              <div className="space-y-3">
                {filteredCatalog.map((entry) => (
                  <div key={entry.id} className="rounded-xl border border-slate-700 bg-slate-950/50 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div><div className="font-medium text-slate-100">{entry.canonicalValue || "(vazio)"}</div><div className="mt-1 text-sm text-slate-400">{entry.category} - {entry.code} - {entry.labels.pt} / {entry.labels.es} / {entry.labels.en}</div></div>
                      <div className="flex gap-2"><Badge variant="outline">{entry.category}</Badge><Badge variant={entry.enabled ? "success" : "outline"}>{entry.enabled ? "Ativa" : "Inativa"}</Badge></div>
                    </div>
                    <div className="mt-3 text-xs text-slate-500">{entry.detectionAliases.join(", ")}</div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button type="button" variant="outline" onClick={() => setCatalogDraft(makeCatalogDraft(entry))}>Editar</Button>
                      <Button type="button" variant="outline" onClick={() => void postJson("/api/reference-normalizer/catalog", { action: "delete", entryId: entry.id }).then(refreshConfig)}>Eliminar</Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
