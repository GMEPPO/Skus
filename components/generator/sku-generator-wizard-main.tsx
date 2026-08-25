"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { ChevronDown, ChevronRight, ImagePlus, Plus, RotateCcw, Search, Sparkles, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { WordCreateModal } from "@/components/generator/word-create-modal";
import { CombinedNomenclatureAssistant } from "@/components/generator/combined-nomenclature-assistant";
import { buildAbbreviationGlossary } from "@/lib/sku-assistant/build-abbreviation-glossary";
import { generateSkuAction } from "@/lib/sku-actions";
import type { FieldTypeOption } from "@/lib/admin-catalog";
import { fetchSkuCodeExamplesAction, type SkuCodeExample } from "@/lib/generator-code-examples-actions";
import { completeSkuNormalizationSecureAction, generateSkuSecureAction } from "@/lib/sku-secure-actions";
import type { GeneratorCatalog, GeneratorLevel, GeneratorWord } from "@/lib/types";
import {
  buildDesignation,
  buildDesignationByLocale,
  buildEmptySelectionId,
  buildSkuCodeExamplePatterns,
  buildSkuPreview,
  collectSelectedWordDesignationWarnings,
  filterGeneratorWords,
  getAvailableOptions,
  isEmptyReferenceWord,
  isEmptySelection,
  MAX_DESIGNATION_LENGTH,
  sortGeneratorWords,
} from "@/lib/sku";
import { pruneInvalidDownstreamSelections } from "@/lib/word-dependencies";

type Selections = Record<string, string>;
type SearchByLevel = Record<string, string>;
type GeneratedSkuModalData = {
  ok: true;
  message: string;
  generatedCode: string;
  generatedCodeCompact: string;
  productImageUrl?: string;
  designationPt: string;
  designationEs: string;
  designationEn: string;
  unitsPerBox?: number;
  unitsPerBoxStatus?: "real" | "estimated";
  multiples?: number;
  multiplesStatus?: "real" | "estimated";
  weight?: number;
  weightStatus?: "real" | "estimated";
};

function isRequiredLevel(level: GeneratorLevel) {
  if (typeof level.isRequired === "boolean") return level.isRequired;
  return level.fieldType !== "extra";
}

function isLevelSelectionComplete(selectedId?: string) {
  return Boolean(selectedId);
}

function getSelectedWord(level: GeneratorLevel, selectedId?: string) {
  if (!selectedId || isEmptySelection(selectedId)) return null;
  return level.options.find((option) => option.id === selectedId) ?? null;
}

function isLevelSelectionEmpty(level: GeneratorLevel, selectedId?: string) {
  if (!selectedId) return false;
  if (isEmptySelection(selectedId)) return true;
  return isEmptyReferenceWord(getSelectedWord(level, selectedId));
}

function getSelectionDisplayLabel(level: GeneratorLevel, selectedId?: string) {
  if (isEmptySelection(selectedId)) return "Vazio";
  const selectedWord = getSelectedWord(level, selectedId);
  if (isEmptyReferenceWord(selectedWord)) return "Vazio";
  return selectedWord?.label ?? "";
}

function getSelectionDisplayCode(level: GeneratorLevel, selectedId?: string) {
  if (isLevelSelectionEmpty(level, selectedId)) return "000";
  return getSelectedWord(level, selectedId)?.referenceCode ?? "000";
}

function buildSecureSelectionsPayload(catalog: GeneratorCatalog, selections: Selections) {
  const payload: Record<string, { kind: "word"; wordId: string } | { kind: "empty" }> = {};
  for (const level of catalog.levels) {
    const selectedId = selections[level.id];
    if (!selectedId) continue;
    if (isEmptySelection(selectedId)) {
      payload[level.id] = { kind: "empty" };
      continue;
    }
    const option = level.options.find((item) => item.id === selectedId);
    if (!option || isEmptyReferenceWord(option)) {
      payload[level.id] = { kind: "empty" };
      continue;
    }
    payload[level.id] = { kind: "word", wordId: selectedId };
  }
  return payload;
}

function validateSecureSelections(catalog: GeneratorCatalog, selections: Selections): string | null {
  for (const level of catalog.levels) {
    const selectedId = selections[level.id];
    if (!selectedId || isEmptySelection(selectedId)) continue;

    const option = level.options.find((item) => item.id === selectedId);
    if (!option) {
      return `Selecao invalida em "${level.label}". Recarrega a pagina ou usa Limpar tudo.`;
    }
  }
  return null;
}

export function SkuGeneratorWizardMain({
  catalog,
  secureGenerationV2Enabled = false,
  normalizationV2Enabled = false,
  categoryId = null,
  fieldTypes = [],
  autoSelectWord = null,
  onAutoSelectWordApplied,
  onWordCreated,
  normalizationTarget = null,
  onClearNormalization,
  onNormalizationComplete,
  normalizationSidebarOpen = false,
  skuAssistantEnabled = false,
}: {
  catalog: GeneratorCatalog;
  /** When true, calls generate_sku_secure (requires categoryId + level selections). Default OFF. */
  secureGenerationV2Enabled?: boolean;
  normalizationV2Enabled?: boolean;
  categoryId?: string | null;
  fieldTypes?: FieldTypeOption[];
  autoSelectWord?: { levelId: string; wordId: string } | null;
  onAutoSelectWordApplied?: () => void;
  onWordCreated?: (levelId: string, wordId: string) => void;
  normalizationTarget?: {
    id: string;
    legacyCode: string | null;
    legacyDesignation: string | null;
    sourceDesignationPt: string | null;
  } | null;
  onClearNormalization?: () => void;
  onNormalizationComplete?: () => void;
  /** When true, offsets the normalization dock to sit beside the pending sidebar. */
  normalizationSidebarOpen?: boolean;
  skuAssistantEnabled?: boolean;
}) {
  const [selections, setSelections] = useState<Selections>({});
  const [selectionOrder, setSelectionOrder] = useState<string[]>([]);
  const [searchByLevel, setSearchByLevel] = useState<SearchByLevel>({});
  const [unitsPerBox, setUnitsPerBox] = useState("");
  const [unitsPerBoxStatus, setUnitsPerBoxStatus] = useState<"real" | "estimated">("estimated");
  const [multiples, setMultiples] = useState("");
  const [multiplesStatus, setMultiplesStatus] = useState<"real" | "estimated">("estimated");
  const [weight, setWeight] = useState("");
  const [weightStatus, setWeightStatus] = useState<"real" | "estimated">("estimated");
  const [logisticsRequired, setLogisticsRequired] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [modalData, setModalData] = useState<GeneratedSkuModalData | null>(null);
  const [productImagePreviewUrl, setProductImagePreviewUrl] = useState<string | null>(null);
  const [productImageName, setProductImageName] = useState("");
  const [secureRequestId, setSecureRequestId] = useState(() => crypto.randomUUID());
  const secureRequestIdRef = useRef(secureRequestId);
  const requestBoundPayloadKeyRef = useRef<string | null>(null);
  const [normalizationCompleted, setNormalizationCompleted] = useState(false);
  const [codeExamples, setCodeExamples] = useState<SkuCodeExample[]>([]);
  const [codeExamplesLoading, setCodeExamplesLoading] = useState(false);
  const [wordCreateLevel, setWordCreateLevel] = useState<GeneratorLevel | null>(null);
  const [expandedLevelIds, setExpandedLevelIds] = useState<Set<string>>(() => {
    const firstLevelId = catalog.levels[0]?.id;
    return firstLevelId ? new Set([firstLevelId]) : new Set();
  });
  const levelRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const isNormalizationMode = Boolean(normalizationTarget);
  const usesSecurePayload = secureGenerationV2Enabled || isNormalizationMode;
  const requiredLevels = useMemo(() => catalog.levels.filter(isRequiredLevel), [catalog.levels]);
  const requiredCompletedCount = requiredLevels.filter((level) =>
    isLevelSelectionComplete(selections[level.id]),
  ).length;
  const allLevelsHaveSelection = catalog.levels.every((level) => isLevelSelectionComplete(selections[level.id]));
  const selectedCount = Object.keys(selections).filter((key) => selections[key]).length;
  const activeLevelIndex = useMemo(() => {
    const index = catalog.levels.findIndex((level) => !selections[level.id]);
    return index === -1 ? catalog.levels.length : index;
  }, [catalog.levels, selections]);

  const firstLevelId = catalog.levels[0]?.id ?? null;

  useEffect(() => {
    setExpandedLevelIds(firstLevelId ? new Set([firstLevelId]) : new Set());
  }, [firstLevelId]);

  useEffect(() => {
    const targetLevel = catalog.levels[activeLevelIndex];
    if (!targetLevel || !expandedLevelIds.has(targetLevel.id)) return;
    levelRefs.current[targetLevel.id]?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [activeLevelIndex, catalog.levels, expandedLevelIds]);

  const designation = buildDesignation(catalog, selections);
  const designationPt = buildDesignationByLocale(catalog, selections, "pt");
  const designationEs = buildDesignationByLocale(catalog, selections, "es");
  const designationEn = buildDesignationByLocale(catalog, selections, "en");
  const designationLength = designation.length;
  const isDesignationTooLong = designationLength > MAX_DESIGNATION_LENGTH;
  const skuPreview = buildSkuPreview(catalog, selections);
  const wordDesignationWarnings = useMemo(
    () => collectSelectedWordDesignationWarnings(catalog, selections),
    [catalog, selections],
  );
  const hasAnyMeasurements = Boolean(unitsPerBox || multiples || weight);
  const hasAllMeasurements = Boolean(unitsPerBox && multiples && weight);
  const hasPartialMeasurements = logisticsRequired && hasAnyMeasurements && !hasAllMeasurements;
  const measurementError = hasPartialMeasurements
    ? "As medidas devem ser enviadas em conjunto: quantidade por caixa, multiplos e peso."
    : null;
  const measurementsValid = !logisticsRequired || hasAllMeasurements;
  const needsCategoryId = secureGenerationV2Enabled || isNormalizationMode;
  const submitBlockReason = useMemo(() => {
    if (catalog.levels.length === 0) return "Catalogo sem niveis.";
    if (!allLevelsHaveSelection) return "Preenche todos os niveis (Vazio conta como escolha).";
    if (requiredCompletedCount !== requiredLevels.length) {
      return "Preenche os niveis obrigatorios.";
    }
    if (isDesignationTooLong) return `Designacao demasiado longa (${designationLength}/${MAX_DESIGNATION_LENGTH}).`;
    if (!measurementsValid) return measurementError ?? "Medidas logisticas incompletas.";
    if (needsCategoryId && !categoryId) return "Categoria em falta.";
    if (isNormalizationMode && !normalizationV2Enabled) return "Normalizacao V2 desactivada.";
    return null;
  }, [
    allLevelsHaveSelection,
    catalog.levels.length,
    categoryId,
    designationLength,
    isDesignationTooLong,
    isNormalizationMode,
    measurementError,
    measurementsValid,
    needsCategoryId,
    normalizationV2Enabled,
    requiredCompletedCount,
    requiredLevels.length,
  ]);
  const canSubmit =
    catalog.levels.length > 0 &&
    allLevelsHaveSelection &&
    requiredCompletedCount === requiredLevels.length &&
    !isDesignationTooLong &&
    measurementsValid &&
    (!needsCategoryId || Boolean(categoryId)) &&
    (!isNormalizationMode || normalizationV2Enabled);

  useEffect(() => {
    return () => {
      if (productImagePreviewUrl) {
        URL.revokeObjectURL(productImagePreviewUrl);
      }
    };
  }, [productImagePreviewUrl]);

  useEffect(() => {
    if (!categoryId) {
      setCodeExamples([]);
      return;
    }

    const patterns = buildSkuCodeExamplePatterns(catalog, selections, selectionOrder);
    if (patterns.length === 0) {
      setCodeExamples([]);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setCodeExamplesLoading(true);
      const result = await fetchSkuCodeExamplesAction(categoryId, patterns);
      if (!cancelled) {
        setCodeExamples(result.ok ? result.examples : []);
        setCodeExamplesLoading(false);
      }
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [catalog, categoryId, selectionOrder, selections]);

  function buildSecurePayloadKey(
    nextSelections: Selections = selections,
    nextUnitsPerBox = unitsPerBox,
    nextUnitsPerBoxStatus = unitsPerBoxStatus,
    nextMultiples = multiples,
    nextMultiplesStatus = multiplesStatus,
    nextWeight = weight,
    nextWeightStatus = weightStatus,
  ) {
    return JSON.stringify({
      categoryId,
      normalizationId: normalizationTarget?.id ?? null,
      selections: nextSelections,
      unitsPerBox: nextUnitsPerBox,
      unitsPerBoxStatus: nextUnitsPerBoxStatus,
      multiples: nextMultiples,
      multiplesStatus: nextMultiplesStatus,
      weight: nextWeight,
      weightStatus: nextWeightStatus,
    });
  }

  function bindOrRenewRequestIdForPayload(payloadKey: string): string {
    if (!usesSecurePayload) {
      return secureRequestIdRef.current;
    }
    if (requestBoundPayloadKeyRef.current === null) {
      requestBoundPayloadKeyRef.current = payloadKey;
      return secureRequestIdRef.current;
    }
    if (requestBoundPayloadKeyRef.current === payloadKey) {
      return secureRequestIdRef.current;
    }
    const nextRequestId = crypto.randomUUID();
    requestBoundPayloadKeyRef.current = payloadKey;
    secureRequestIdRef.current = nextRequestId;
    setSecureRequestId(nextRequestId);
    return nextRequestId;
  }

  function toggleLevelExpanded(levelId: string) {
    setExpandedLevelIds((current) => {
      const next = new Set(current);
      if (next.has(levelId)) next.delete(levelId);
      else next.add(levelId);
      return next;
    });
  }

  function advanceExpandedLevelAfterSelection(levelId: string) {
    const levelIndex = catalog.levels.findIndex((entry) => entry.id === levelId);
    const nextLevel = catalog.levels[levelIndex + 1];
    setExpandedLevelIds((current) => {
      const next = new Set(current);
      next.delete(levelId);
      if (nextLevel) next.add(nextLevel.id);
      return next;
    });
  }

  useEffect(() => {
    if (!autoSelectWord) return;

    const level = catalog.levels.find((entry) => entry.id === autoSelectWord.levelId);
    const word = level?.options.find((option) => option.id === autoSelectWord.wordId);
    if (!level || !word) return;

    setSelections((current) => {
      const nextSelections = {
        ...current,
        [level.id]: isEmptyReferenceWord(word) ? buildEmptySelectionId(level.id) : word.id,
      };
      bindOrRenewRequestIdForPayload(buildSecurePayloadKey(nextSelections));
      return nextSelections;
    });
    setSelectionOrder((current) => [...current.filter((id) => id !== level.id), level.id]);
    advanceExpandedLevelAfterSelection(level.id);
    onAutoSelectWordApplied?.();
  }, [autoSelectWord, catalog, onAutoSelectWordApplied]);

  if (catalog.levels.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/40 p-6 text-sm text-slate-400">
        Ainda nao existem niveis disponiveis. Executa o reset/import global ou cria palavras na Biblioteca.
      </div>
    );
  }

  function handleSelection(level: GeneratorLevel, word?: GeneratorWord | null) {
    const nextValue =
      !word || isEmptyReferenceWord(word) ? buildEmptySelectionId(level.id) : word.id;
    const nextSelections = pruneInvalidDownstreamSelections(catalog, {
      ...selections,
      [level.id]: nextValue,
    }, level.id);
    const nextSelectionOrder = [...selectionOrder.filter((id) => id !== level.id), level.id];
    bindOrRenewRequestIdForPayload(buildSecurePayloadKey(nextSelections));
    setSelectionOrder(nextSelectionOrder);
    setSelections(nextSelections);
    advanceExpandedLevelAfterSelection(level.id);
  }

  function clearSelection(level: GeneratorLevel) {
    const changedIndex = catalog.levels.findIndex((entry) => entry.id === level.id);
    const nextSelections = { ...selections };
    for (const downstream of catalog.levels.slice(changedIndex)) {
      delete nextSelections[downstream.id];
    }
    bindOrRenewRequestIdForPayload(buildSecurePayloadKey(nextSelections));
    setSelectionOrder(selectionOrder.filter((id) => catalog.levels.findIndex((entry) => entry.id === id) < changedIndex));
    setSearchByLevel((current) => {
      const next = { ...current };
      for (const downstream of catalog.levels.slice(changedIndex)) {
        delete next[downstream.id];
      }
      return next;
    });
    setSelections(nextSelections);
    setExpandedLevelIds((current) => {
      const next = new Set(current);
      for (const downstream of catalog.levels.slice(changedIndex + 1)) {
        next.delete(downstream.id);
      }
      next.add(level.id);
      return next;
    });
  }

  const allLevelsCompleted = activeLevelIndex >= catalog.levels.length;

  function renderLevelPanel(level: GeneratorLevel, levelIndex: number) {
    const selectedId = selections[level.id];
    const isExpanded = expandedLevelIds.has(level.id);
    const isSuggestedActive = levelIndex === activeLevelIndex;
    const isCompleted = Boolean(selectedId);
    const emptyOptionSelected = isLevelSelectionEmpty(level, selectedId);
    const allOptions = sortGeneratorWords(getAvailableOptions(catalog, level.id, selections));
    const hasEmptyReferenceWord = allOptions.some((option) => option.referenceCode === "000");
    const query = searchByLevel[level.id] ?? "";
    const options = filterGeneratorWords(allOptions, query).slice(0, 36);
    const showLegacyEmptyOption = !hasEmptyReferenceWord && level.fieldType === "extra";

    return (
      <div
        key={level.id}
        ref={(node) => {
          levelRefs.current[level.id] = node;
        }}
        className={[
          "overflow-hidden rounded-2xl border bg-slate-900/60 shadow-lg shadow-black/10 transition",
          isExpanded && isSuggestedActive
            ? "border-amber-500/40 ring-1 ring-amber-500/20"
            : isCompleted
              ? "border-amber-400/25"
              : "border-slate-700",
        ].join(" ")}
      >
        <div className="flex items-stretch gap-2 p-2">
          <button
            type="button"
            onClick={() => toggleLevelExpanded(level.id)}
            className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-slate-800/60"
            aria-expanded={isExpanded}
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
            ) : (
              <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">
                Nivel {level.order}
                {isSuggestedActive && !allLevelsCompleted ? " · activo" : ""}
              </p>
              <h3 className="truncate text-base font-semibold text-slate-50">{level.label}</h3>
              {!isExpanded ? (
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  {isCompleted ? (
                    <>
                      <Sparkles className="h-3.5 w-3.5 shrink-0 text-amber-300" />
                      <span className="truncate text-sm text-slate-200">
                        {getSelectionDisplayLabel(level, selectedId)}
                      </span>
                      <span className="rounded-md bg-slate-950 px-1.5 py-0.5 font-mono text-xs text-slate-400">
                        {getSelectionDisplayCode(level, selectedId)}
                      </span>
                    </>
                  ) : (
                    <span className="text-sm text-slate-500">Por escolher</span>
                  )}
                </div>
              ) : null}
            </div>
          </button>
          <div className="flex shrink-0 items-center gap-2 self-center pr-2">
            {isCompleted ? (
              <Badge variant="success">preenchido</Badge>
            ) : isSuggestedActive ? (
              <Badge>ativo</Badge>
            ) : (
              <Badge variant="outline">{isRequiredLevel(level) ? "obrigatorio" : "opcional"}</Badge>
            )}
            {isExpanded && fieldTypes.length > 0 ? (
              <Button
                type="button"
                variant="outline"
                className="h-8 w-8 p-0"
                title={`Criar palavra em ${level.label}`}
                aria-label={`Criar palavra em ${level.label}`}
                onClick={() => setWordCreateLevel(level)}
              >
                <Plus className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
        </div>

        {isExpanded ? (
          <div className="border-t border-slate-800 px-4 pb-4 pt-3">
            {isCompleted ? (
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-400/25 bg-amber-400/5 px-3 py-2">
                <div className="flex flex-wrap items-center gap-2 text-sm text-slate-100">
                  <Sparkles className="h-4 w-4 text-amber-300" />
                  <span>{getSelectionDisplayLabel(level, selectedId)}</span>
                  <span className="rounded-md bg-slate-950 px-2 py-0.5 font-mono text-xs text-slate-400">
                    {getSelectionDisplayCode(level, selectedId)}
                  </span>
                </div>
                <Button type="button" variant="outline" className="h-8 px-2.5 text-xs" onClick={() => clearSelection(level)}>
                  Limpar
                </Button>
              </div>
            ) : null}

            <label className="mb-3 flex h-11 items-center gap-2 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100 focus-within:ring-2 focus-within:ring-amber-400">
              <Search className="h-4 w-4 text-slate-500" />
              <input
                value={query}
                onChange={(event) =>
                  setSearchByLevel((current) => ({
                    ...current,
                    [level.id]: event.target.value,
                  }))
                }
                placeholder={`Pesquisar por palavra, código ou designação em ${level.label}`}
                className="h-full flex-1 bg-transparent outline-none placeholder:text-slate-600"
              />
            </label>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {options.map((option) => {
                const isEmptyOption = isEmptyReferenceWord(option);
                const isSelected = selectedId === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => handleSelection(level, option)}
                    className={[
                      "rounded-xl border px-4 py-3 text-left transition",
                      isSelected
                        ? "border-amber-400 bg-amber-400/10"
                        : "border-slate-700 bg-slate-950/40 hover:border-slate-500 hover:bg-slate-800/80",
                    ].join(" ")}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-slate-100">{isEmptyOption ? "Vazio" : option.label}</p>
                        <p className="mt-1 text-xs text-slate-500">{option.referenceCode}</p>
                      </div>
                      {isSelected ? <Sparkles className="h-4 w-4 text-amber-300" /> : null}
                    </div>
                  </button>
                );
              })}
              {showLegacyEmptyOption ? (
                <button
                  type="button"
                  onClick={() => handleSelection(level, null)}
                  className={[
                    "rounded-xl border px-4 py-3 text-left transition",
                    emptyOptionSelected
                      ? "border-amber-400 bg-amber-400/10"
                      : "border-slate-700 bg-slate-950/40 hover:border-slate-500 hover:bg-slate-800/80",
                  ].join(" ")}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-100">Vazio</p>
                      <p className="mt-1 text-xs text-slate-500">000</p>
                    </div>
                    {emptyOptionSelected ? <Sparkles className="h-4 w-4 text-amber-300" /> : null}
                  </div>
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit || isSubmitting) return;
    if (measurementError) {
      setSubmitError(measurementError);
      return;
    }

    const selectionError = validateSecureSelections(catalog, selections);
    if (selectionError) {
      setSubmitError(selectionError);
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    const formData = new FormData(event.currentTarget);
    formData.set("requireLogisticsData", logisticsRequired ? "on" : "off");

    if (!logisticsRequired) {
      formData.delete("unitsPerBox");
      formData.delete("unitsPerBoxStatus");
      formData.delete("multiples");
      formData.delete("multiplesStatus");
      formData.delete("weight");
      formData.delete("weightStatus");
      formData.delete("requestId");
      formData.delete("productImage");
    }

    if (isNormalizationMode && normalizationTarget) {
      if (!normalizationV2Enabled) {
        setSubmitError("Normalização V2 desativada (funcionalidade desligada).");
        setIsSubmitting(false);
        return;
      }

      formData.set("normalizationId", normalizationTarget.id);
      formData.set("categoryId", categoryId ?? "");
      formData.set("selectionsJson", JSON.stringify(buildSecureSelectionsPayload(catalog, selections)));
      formData.set("requireLogisticsData", logisticsRequired ? "on" : "off");

      if (logisticsRequired && hasAllMeasurements) {
        formData.set("requestId", bindOrRenewRequestIdForPayload(buildSecurePayloadKey()));
        formData.set(
          "measuresJson",
          JSON.stringify({
            unitsPerBox: Number(unitsPerBox),
            unitsPerBoxStatus: unitsPerBoxStatus,
            multiples: Number(multiples),
            multiplesStatus: multiplesStatus,
            weight: Number(weight),
            weightStatus: weightStatus,
          }),
        );
      }

      const completeResult = await completeSkuNormalizationSecureAction(formData);
      if (!completeResult.ok) {
        setSubmitError(completeResult.message);
        setModalData(null);
        setIsSubmitting(false);
        return;
      }

      const data = completeResult.data;
      setModalData({
        ok: true,
        message: completeResult.message,
        generatedCode: String(data.generatedCode ?? ""),
        generatedCodeCompact: String(data.generatedCode ?? "").replaceAll("-", ""),
        designationPt: String(data.designationPt ?? ""),
        designationEs: String(data.designationEs ?? ""),
        designationEn: String(data.designationEn ?? ""),
        unitsPerBox: logisticsRequired && hasAllMeasurements ? Number(unitsPerBox) : undefined,
        unitsPerBoxStatus: logisticsRequired && hasAllMeasurements ? unitsPerBoxStatus : undefined,
        multiples: logisticsRequired && hasAllMeasurements ? Number(multiples) : undefined,
        multiplesStatus: logisticsRequired && hasAllMeasurements ? multiplesStatus : undefined,
        weight: logisticsRequired && hasAllMeasurements ? Number(weight) : undefined,
        weightStatus: logisticsRequired && hasAllMeasurements ? weightStatus : undefined,
      });
      setNormalizationCompleted(true);
      setIsSubmitting(false);
      return;
    }

    if (secureGenerationV2Enabled) {
      if (!categoryId) {
        setSubmitError("Geracao V2 requer categoryId (catalogo por categoria).");
        setIsSubmitting(false);
        return;
      }

      formData.set("categoryId", categoryId);
      formData.set("selectionsJson", JSON.stringify(buildSecureSelectionsPayload(catalog, selections)));
      formData.set("requireLogisticsData", logisticsRequired ? "on" : "off");

      if (logisticsRequired) {
        const requestIdForSubmit = bindOrRenewRequestIdForPayload(buildSecurePayloadKey());
        formData.set("requestId", requestIdForSubmit);
      } else {
        formData.delete("requestId");
        formData.delete("unitsPerBox");
        formData.delete("unitsPerBoxStatus");
        formData.delete("multiples");
        formData.delete("multiplesStatus");
        formData.delete("weight");
        formData.delete("weightStatus");
      }

      const secureResult = await generateSkuSecureAction(formData);
      if (!secureResult.ok) {
        setSubmitError(secureResult.message);
        setModalData(null);
        setIsSubmitting(false);
        return;
      }

      setModalData({
        ok: true,
        message: secureResult.message,
        generatedCode: secureResult.generatedCode,
        generatedCodeCompact: secureResult.generatedCodeCompact,
        designationPt: secureResult.designationPt,
        designationEs: secureResult.designationEs,
        designationEn: secureResult.designationEn,
        unitsPerBox: secureResult.unitsPerBox,
        unitsPerBoxStatus: secureResult.unitsPerBoxStatus,
        multiples: secureResult.multiples,
        multiplesStatus: secureResult.multiplesStatus,
        weight: secureResult.weight,
        weightStatus: secureResult.weightStatus,
      });
      // Keep the same requestId after success so retries of the same payload stay idempotent.
      setIsSubmitting(false);
      return;
    }

    const result = await generateSkuAction(formData);
    if (!result.ok) {
      setSubmitError(result.message);
      setModalData(null);
      setIsSubmitting(false);
      return;
    }

    setModalData(result);
    setIsSubmitting(false);
  }

  async function copyValue(value: string) {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      setSubmitError("Nao foi possivel copiar automaticamente. Verifica as permissoes do navegador.");
    }
  }

  function handleProductImageChange(event: ChangeEvent<HTMLInputElement>) {
    // Image is not part of the secure RPC payload; do not rotate requestId.
    const nextFile = event.target.files?.[0];
    setProductImagePreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return nextFile ? URL.createObjectURL(nextFile) : null;
    });
    setProductImageName(nextFile?.name ?? "");
  }

  function clearProductImage(input: HTMLInputElement | null) {
    if (input) {
      input.value = "";
    }
    setProductImagePreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });
    setProductImageName("");
  }

  function closeResultModal() {
    if (normalizationCompleted) {
      setNormalizationCompleted(false);
      onNormalizationComplete?.();
    }
    setModalData(null);
  }

  function handleExtendedDataToggle(enabled: boolean) {
    setLogisticsRequired(enabled);
    if (!enabled) {
      setUnitsPerBox("");
      setMultiples("");
      setWeight("");
      setProductImagePreviewUrl((current) => {
        if (current) URL.revokeObjectURL(current);
        return null;
      });
      setProductImageName("");
    }
  }

  const hasWizardDraft =
    selectedCount > 0 ||
    logisticsRequired ||
    hasAnyMeasurements ||
    Boolean(productImagePreviewUrl) ||
    Object.values(searchByLevel).some(Boolean);

  function resetWizardForNewSku() {
    if (isNormalizationMode) return;

    setSelections({});
    setSelectionOrder([]);
    setSearchByLevel({});
    setUnitsPerBox("");
    setMultiples("");
    setWeight("");
    setUnitsPerBoxStatus("estimated");
    setMultiplesStatus("estimated");
    setWeightStatus("estimated");
    setLogisticsRequired(false);
    setSubmitError(null);
    setCodeExamples([]);
    setProductImagePreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });
    setProductImageName("");
    setExpandedLevelIds(firstLevelId ? new Set([firstLevelId]) : new Set());

    const form = document.getElementById("sku-generator-form");
    const imageInput = form?.querySelector<HTMLInputElement>('input[name="productImage"]') ?? null;
    clearProductImage(imageInput);

    const nextRequestId = crypto.randomUUID();
    requestBoundPayloadKeyRef.current = null;
    secureRequestIdRef.current = nextRequestId;
    setSecureRequestId(nextRequestId);
  }

  function renderSkuReferenceSummary() {
    return (
      <div className="mt-3 space-y-2 border-t border-slate-800 pt-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Referencia</p>
          <p className="text-xs text-slate-500">
            Progresso {selectedCount}/{catalog.levels.length}
          </p>
        </div>
        <p className="break-all font-mono text-lg font-semibold text-amber-300">{skuPreview || "—"}</p>
        <div className="flex flex-wrap items-center gap-1.5">
          {catalog.levels.map((level, index) => {
            const selectedId = selections[level.id];
            const isSelected = Boolean(selectedId);
            const segmentCode = isSelected ? getSelectionDisplayCode(level, selectedId) : "---";
            return (
              <React.Fragment key={level.id}>
                {index > 0 ? <span className="font-mono text-slate-600">-</span> : null}
                <span
                  title={`${level.label}${isSelected ? `: ${getSelectionDisplayLabel(level, selectedId)}` : " (por escolher)"}`}
                  className={[
                    "rounded-md px-1.5 py-0.5 font-mono text-sm",
                    isSelected
                      ? "bg-amber-400/15 font-semibold text-amber-300"
                      : "bg-slate-900 text-slate-500",
                  ].join(" ")}
                >
                  {segmentCode}
                </span>
              </React.Fragment>
            );
          })}
        </div>
        {secureGenerationV2Enabled ? (
          <p className="text-[11px] text-slate-500">
            Pre-visualizacao local. O codigo final vem da resposta do servidor.
          </p>
        ) : null}
      </div>
    );
  }

  function renderNormalizationDock() {
    if (!isNormalizationMode || !normalizationTarget) return null;

    return (
      <div className="rounded-2xl border border-amber-500/40 bg-slate-950/95 p-4 shadow-2xl shadow-black/30 backdrop-blur">
        <p className="text-xs uppercase tracking-[0.2em] text-amber-300">A normalizar</p>
        <p className="mt-2 break-all font-mono text-lg font-semibold text-slate-50">
          {normalizationTarget.legacyCode ?? "—"}
        </p>
        <p className="mt-2 text-sm leading-snug text-slate-300">
          {normalizationTarget.legacyDesignation ??
            normalizationTarget.sourceDesignationPt ??
            "Sem designacao legacy"}
        </p>
        {!normalizationV2Enabled ? (
          <p className="mt-3 text-xs text-amber-200">
            Ativa `NEXT_PUBLIC_SKUS_NORMALIZATION_V2=true` para concluir este registo.
          </p>
        ) : null}
        {onClearNormalization ? (
          <Button
            type="button"
            variant="outline"
            className="mt-4 h-9 w-full px-3 text-sm"
            onClick={onClearNormalization}
          >
            Cancelar normalizacao
          </Button>
        ) : null}
      </div>
    );
  }

  function renderSummaryDock() {
    return (
      <>
        <div className="rounded-2xl border border-amber-500/30 bg-slate-950/95 p-4 shadow-2xl shadow-black/30 backdrop-blur">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-xs uppercase tracking-[0.24em] text-amber-300">Designacao</p>
              <p className={`mt-2 text-base ${isDesignationTooLong ? "text-red-300" : "text-slate-100"}`}>
                {designation || "Seleciona os campos para construir a designacao final."}
              </p>
              {designation ? (
                <p className={`mt-2 text-xs ${isDesignationTooLong ? "text-red-300" : "text-slate-400"}`}>
                  {designationLength}/{MAX_DESIGNATION_LENGTH} caracteres
                  {isDesignationTooLong ? " - limite excedido" : ""}
                </p>
              ) : null}
              {renderSkuReferenceSummary()}
            </div>
            <Button
              type="submit"
              disabled={!canSubmit || isSubmitting}
              title={!canSubmit && submitBlockReason ? submitBlockReason : undefined}
              className="shrink-0"
            >
              {isSubmitting
                ? "A guardar..."
                : isNormalizationMode
                  ? "Concluir normalizacao"
                  : "Gerar SKU"}
            </Button>
          </div>
        </div>
        {!canSubmit && submitBlockReason ? (
          <p className="text-xs text-amber-200/90">{submitBlockReason}</p>
        ) : null}

        {selectionOrder.length > 0 ? (
          <div className="rounded-2xl border border-slate-700/80 bg-slate-950/95 p-4 shadow-xl shadow-black/20 backdrop-blur">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Codigos semelhantes</p>
            <p className="mt-1 text-xs text-slate-600">Histórico de códigos novos e normalizados</p>
            {codeExamplesLoading ? (
              <p className="mt-3 text-sm text-slate-500">A procurar codigos semelhantes...</p>
            ) : codeExamples.length > 0 ? (
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {codeExamples.map((example) => (
                  <li
                    key={`${example.source}-${example.code}`}
                    className="rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2.5"
                  >
                    <p className="break-all text-sm font-semibold text-amber-200">{example.code}</p>
                    {example.designationPt ? (
                      <p className="mt-1 line-clamp-2 text-xs text-slate-400">{example.designationPt}</p>
                    ) : null}
                    <p className="mt-1.5 text-[10px] uppercase tracking-[0.16em] text-slate-600">
                      {example.source === "normalization" ? "Normalização" : "Histórico"}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-slate-500">
                Ainda nao existem codigos criados com esta combinacao de palavras.
              </p>
            )}
          </div>
        ) : null}

        {wordDesignationWarnings.length > 0 ? (
          <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 shadow-xl shadow-black/20 backdrop-blur">
            <p className="text-xs uppercase tracking-[0.2em] text-amber-200">Avisos de designacao</p>
            <ul className="mt-3 space-y-2 text-xs text-amber-100/90">
              {wordDesignationWarnings.map((warning) => (
                <li key={`${warning.levelLabel}-${warning.wordLabel}-${warning.locale}`}>
                  {warning.wordLabel} ({warning.levelLabel}) — {warning.locale.toUpperCase()}: {warning.length}/
                  {MAX_DESIGNATION_LENGTH} caracteres
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </>
    );
  }

  return (
    <>
    <div className="relative space-y-6">
      <form id="sku-generator-form" onSubmit={handleSubmit} className="relative">
        {usesSecurePayload ? (
          <>
            <input type="hidden" name="categoryId" value={categoryId ?? ""} />
            <input type="hidden" name="requestId" value={secureRequestId} />
          </>
        ) : (
          <>
            <input type="hidden" name="generatedCode" value={skuPreview} />
            <input type="hidden" name="designation" value={designation} />
            <input type="hidden" name="designationPt" value={designationPt} />
            <input type="hidden" name="designationEs" value={designationEs} />
            <input type="hidden" name="designationEn" value={designationEn} />
            <input type="hidden" name="selectionSnapshot" value={JSON.stringify(selections)} />
          </>
        )}

        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:gap-6">
        <div className="min-w-0 flex-1 space-y-6">
        {!isNormalizationMode ? (
          <div className="flex justify-end">
            <Button
              type="button"
              variant="outline"
              className="h-9 gap-2 px-3 text-sm"
              disabled={!hasWizardDraft || isSubmitting}
              onClick={resetWizardForNewSku}
            >
              <RotateCcw className="h-4 w-4" />
              Limpar tudo
            </Button>
          </div>
        ) : null}

        <label className="flex items-start gap-3 rounded-xl border border-slate-700 bg-slate-950/60 px-4 py-3">
          <input
            type="checkbox"
            checked={logisticsRequired}
            onChange={(event) => handleExtendedDataToggle(event.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-slate-600 bg-slate-900 text-amber-400 focus:ring-amber-400"
          />
          <div>
            <p className="text-sm font-medium text-slate-100">
              Incluir dados logisticos e imagem do produto
            </p>
            <p className="text-xs text-slate-400">
              Desactivado: gera o codigo apenas com os niveis e a designacao, sem pedir quantidades nem foto.
            </p>
          </div>
        </label>

        {logisticsRequired ? (
          <Card className="space-y-4 p-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Dados logisticos</p>
              <p className="mt-1 text-sm text-slate-400">
                Obrigatorios para gerar: quantidade por caixa, multiplos e peso (real ou estimado).
              </p>
              {measurementError ? <p className="mt-2 text-sm text-amber-300">{measurementError}</p> : null}
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="grid gap-3 md:col-span-1 md:grid-cols-[1fr_auto]">
                <label className="space-y-2">
                  <span className="text-sm text-slate-300">Quantidade por caixa</span>
                  <input
                    name="unitsPerBox"
                    type="number"
                    min="0.01"
                    step="0.01"
                    required={logisticsRequired && !isNormalizationMode}
                    value={unitsPerBox}
                    onChange={(event) => setUnitsPerBox(event.target.value)}
                    onBlur={() => bindOrRenewRequestIdForPayload(buildSecurePayloadKey())}
                    className="flex h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-sm text-slate-300">Estado</span>
                  <select
                    name="unitsPerBoxStatus"
                    value={unitsPerBoxStatus}
                    onChange={(event) => {
                      const next = event.target.value as "real" | "estimated";
                      bindOrRenewRequestIdForPayload(
                        buildSecurePayloadKey(selections, unitsPerBox, next, multiples, multiplesStatus, weight, weightStatus),
                      );
                      setUnitsPerBoxStatus(next);
                    }}
                    className="flex h-11 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
                  >
                    <option value="estimated">Estimado</option>
                    <option value="real">Confirmado</option>
                  </select>
                </label>
              </div>

              <div className="grid gap-3 md:col-span-1 md:grid-cols-[1fr_auto]">
                <label className="space-y-2">
                  <span className="text-sm text-slate-300">Multiplos</span>
                  <input
                    name="multiples"
                    type="number"
                    min="0.01"
                    step="0.01"
                    required={logisticsRequired && !isNormalizationMode}
                    value={multiples}
                    onChange={(event) => setMultiples(event.target.value)}
                    onBlur={() => bindOrRenewRequestIdForPayload(buildSecurePayloadKey())}
                    className="flex h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-sm text-slate-300">Estado</span>
                  <select
                    name="multiplesStatus"
                    value={multiplesStatus}
                    onChange={(event) => {
                      const next = event.target.value as "real" | "estimated";
                      bindOrRenewRequestIdForPayload(
                        buildSecurePayloadKey(selections, unitsPerBox, unitsPerBoxStatus, multiples, next, weight, weightStatus),
                      );
                      setMultiplesStatus(next);
                    }}
                    className="flex h-11 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
                  >
                    <option value="estimated">Estimado</option>
                    <option value="real">Confirmado</option>
                  </select>
                </label>
              </div>

              <div className="grid gap-3 md:col-span-1 md:grid-cols-[1fr_auto]">
                <label className="space-y-2">
                  <span className="text-sm text-slate-300">Peso</span>
                  <input
                    name="weight"
                    type="number"
                    min="0.01"
                    step="0.01"
                    required={logisticsRequired && !isNormalizationMode}
                    value={weight}
                    onChange={(event) => setWeight(event.target.value)}
                    onBlur={() => bindOrRenewRequestIdForPayload(buildSecurePayloadKey())}
                    className="flex h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-sm text-slate-300">Estado</span>
                  <select
                    name="weightStatus"
                    value={weightStatus}
                    onChange={(event) => {
                      const next = event.target.value as "real" | "estimated";
                      bindOrRenewRequestIdForPayload(
                        buildSecurePayloadKey(selections, unitsPerBox, unitsPerBoxStatus, multiples, multiplesStatus, weight, next),
                      );
                      setWeightStatus(next);
                    }}
                    className="flex h-11 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
                  >
                    <option value="estimated">Estimado</option>
                    <option value="real">Confirmado</option>
                  </select>
                </label>
              </div>
            </div>

            <div className="border-t border-slate-800 pt-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Imagem do produto</p>
              <p className="mt-1 text-sm text-slate-400">Opcional. JPG, PNG ou WEBP ate 5 MB.</p>
              <div className="mt-3 grid gap-4 md:grid-cols-[1fr_auto] md:items-start">
                <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-slate-600 bg-slate-950/50 px-4 py-6 text-center transition hover:border-amber-400/70 hover:bg-slate-900/70">
                  <input
                    name="productImage"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={handleProductImageChange}
                  />
                  <ImagePlus className="h-7 w-7 text-amber-300" />
                  <p className="mt-2 text-sm font-medium text-slate-100">
                    {productImageName || "Selecionar imagem"}
                  </p>
                </label>
                {productImagePreviewUrl ? (
                  <div className="rounded-xl border border-slate-700 bg-slate-950/50 p-3">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <p className="text-sm text-slate-300">Pre-visualizacao</p>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-8 px-2 text-xs"
                        onClick={(event) => {
                          const form = event.currentTarget.closest("form");
                          const input = form?.querySelector<HTMLInputElement>('input[name="productImage"]') ?? null;
                          clearProductImage(input);
                        }}
                      >
                        <X className="mr-1 h-3.5 w-3.5" />
                        Remover
                      </Button>
                    </div>
                    <img
                      src={productImagePreviewUrl}
                      alt="Pre-visualizacao da imagem do produto"
                      className="h-32 w-full rounded-lg object-cover md:w-48"
                    />
                  </div>
                ) : null}
              </div>
            </div>
          </Card>
        ) : null}

        <div
          className="space-y-3"
        >
          {catalog.levels.map((level, levelIndex) => renderLevelPanel(level, levelIndex))}
          {allLevelsCompleted ? (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 text-sm text-emerald-100">
              Todos os niveis foram preenchidos. Revê o resumo e conclui a geracao.
            </div>
          ) : null}
        </div>

        {submitError ? (
          <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {submitError}
          </div>
        ) : null}
        </div>

        <aside
          className="w-full shrink-0 space-y-2 xl:sticky xl:top-4 xl:w-[min(22rem,100%)] xl:max-h-[calc(100vh-2rem)] xl:self-start"
          aria-label="Resumo de designacao e referencia"
        >
          <div className="space-y-2 xl:max-h-[calc(100vh-2rem)] xl:overflow-y-auto">
            {renderSummaryDock()}
          </div>
        </aside>
        </div>
      </form>

      {modalData ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-slate-700 bg-slate-950 p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold text-slate-50">
                {modalData.message?.includes("reutilizado") ? "SKU reutilizado" : "SKU gerado com sucesso"}
              </h3>
              <Button type="button" variant="outline" onClick={closeResultModal}>
                Fechar
              </Button>
            </div>
            <div className="grid gap-3">
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-100">
                {modalData.message}
              </div>
              {modalData.productImageUrl ? (
                <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-3">
                  <p className="mb-3 text-sm text-slate-200">
                    <span className="text-slate-400">Imagem do produto:</span>
                  </p>
                  <img
                    src={modalData.productImageUrl}
                    alt={`Imagem do produto ${modalData.generatedCodeCompact}`}
                    className="h-64 w-full rounded-xl object-cover"
                  />
                </div>
              ) : null}
              <div className="grid gap-2 rounded-xl border border-slate-700 bg-slate-900/60 p-3 md:grid-cols-[1fr_auto] md:items-center">
                <p className="text-sm text-slate-200">
                  <span className="text-slate-400">Referencia final:</span> {modalData.generatedCodeCompact}
                </p>
                <Button type="button" variant="outline" onClick={() => copyValue(modalData.generatedCodeCompact)}>
                  Copiar
                </Button>
              </div>
              <div className="grid gap-2 rounded-xl border border-slate-700 bg-slate-900/60 p-3 md:grid-cols-[1fr_auto] md:items-center">
                <p className="text-sm text-slate-200">
                  <span className="text-slate-400">Designacao PT:</span> {modalData.designationPt}
                </p>
                <Button type="button" variant="outline" onClick={() => copyValue(modalData.designationPt)}>
                  Copiar
                </Button>
              </div>
              <div className="grid gap-2 rounded-xl border border-slate-700 bg-slate-900/60 p-3 md:grid-cols-[1fr_auto] md:items-center">
                <p className="text-sm text-slate-200">
                  <span className="text-slate-400">Designacao ES:</span> {modalData.designationEs}
                </p>
                <Button type="button" variant="outline" onClick={() => copyValue(modalData.designationEs)}>
                  Copiar
                </Button>
              </div>
              <div className="grid gap-2 rounded-xl border border-slate-700 bg-slate-900/60 p-3 md:grid-cols-[1fr_auto] md:items-center">
                <p className="text-sm text-slate-200">
                  <span className="text-slate-400">Designacao EN:</span> {modalData.designationEn}
                </p>
                <Button type="button" variant="outline" onClick={() => copyValue(modalData.designationEn)}>
                  Copiar
                </Button>
              </div>
              {skuAssistantEnabled ? (
                <CombinedNomenclatureAssistant
                  key={modalData.generatedCodeCompact}
                  referenceCode={modalData.generatedCodeCompact}
                  designationPt={modalData.designationPt}
                  designationEs={modalData.designationEs}
                  designationEn={modalData.designationEn}
                  abbreviationGlossary={buildAbbreviationGlossary(catalog, selections)}
                />
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>

    {isNormalizationMode && normalizationTarget ? (
      <div
        className={`fixed bottom-4 z-50 w-[min(18rem,calc(100vw-2rem))] max-h-[calc(100vh-6rem)] overflow-y-auto ${
          normalizationSidebarOpen ? "left-4 lg:left-[calc(18rem+1rem)] xl:left-[calc(20rem+1rem)]" : "left-4"
        }`}
        aria-live="polite"
        aria-label="Referencia em normalizacao"
      >
        {renderNormalizationDock()}
      </div>
    ) : null}

    <WordCreateModal
      open={Boolean(wordCreateLevel)}
      level={wordCreateLevel}
      catalog={catalog}
      fieldTypes={fieldTypes}
      onClose={() => setWordCreateLevel(null)}
      onCreated={(wordId, levelId) => {
        onWordCreated?.(levelId, wordId);
      }}
    />
    </>
  );
}

