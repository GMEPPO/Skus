"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { WordDependencyFields, type WordDependencyRuleRow } from "@/components/catalog/word-dependency-fields";
import { WordCombinationWarningsPanel } from "@/components/catalog/word-combination-warnings-panel";
import { checkWordReferenceCodeAction } from "@/lib/word-validation-actions";
import type { FieldTypeOption } from "@/lib/admin-catalog";
import type { ParentLevelOption } from "@/lib/word-dependency-actions";
import { MAX_DESIGNATION_LENGTH } from "@/lib/sku";
import {
  analyzeWordCombinationLimits,
  DRAFT_WORD_ID,
  injectWordIntoCatalog,
} from "@/lib/word-combination-limits";
import {
  collectDesignationLengthWarnings,
  formatDesignationLengthWarning,
} from "@/lib/word-reference-validation";
import type { ParentMatchMode } from "@/lib/word-dependencies";
import type { GeneratorCatalog } from "@/lib/types";

type WordFormInitialValues = {
  wordId?: string;
  label: string;
  referenceCode: string;
  fieldTypeId: string;
  designationPt: string;
  designationEs: string;
  designationEn: string;
  includeInDesignation: boolean;
  visibilityMode?: "always" | "conditional";
  parentWordIds?: string[];
  parentMatchMode?: ParentMatchMode;
  selectionHierarchy?: number | null;
};

type WordFormClientResult = { ok: true; wordId: string } | { ok: false; message: string };

function DesignationField({
  name,
  label,
  value,
  onChange,
  compact = false,
}: {
  name: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  compact?: boolean;
}) {
  const tooLong = value.trim().length > MAX_DESIGNATION_LENGTH;

  return (
    <label className="space-y-2">
      <span className={`${compact ? "text-xs" : "text-sm"} text-slate-300`}>{label}</span>
      <input
        name={name}
        required
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={[
          `flex w-full rounded-lg border bg-slate-950 px-3 text-slate-100 ${compact ? "h-9 text-xs" : "h-11 text-sm"}`,
          tooLong ? "border-amber-400" : "border-slate-700",
        ].join(" ")}
      />
      {tooLong ? (
        <p className="text-xs text-amber-300">
          {value.trim().length}/{MAX_DESIGNATION_LENGTH} caracteres. Esta designacao excede o limite PHC.
        </p>
      ) : null}
    </label>
  );
}

export function WordForm({
  action,
  clientAction,
  submitLabel,
  cancelHref,
  onCancel,
  onSuccess,
  fieldTypes,
  initialValues,
  categoryLevelId,
  lockFieldType = false,
  lockedFieldTypeLabel,
  parentLevels = [],
  showHierarchyField = false,
  variant = "page",
  generatorCatalog,
  analysisLevelId,
  showCombinationAnalysis = false,
}: {
  action?: (formData: FormData) => void | Promise<void>;
  clientAction?: (formData: FormData) => Promise<WordFormClientResult>;
  submitLabel: string;
  cancelHref?: string;
  onCancel?: () => void;
  onSuccess?: (wordId: string) => void;
  fieldTypes: FieldTypeOption[];
  initialValues: WordFormInitialValues;
  categoryLevelId?: string;
  lockFieldType?: boolean;
  lockedFieldTypeLabel?: string;
  parentLevels?: ParentLevelOption[];
  showHierarchyField?: boolean;
  variant?: "page" | "modal";
  generatorCatalog?: GeneratorCatalog;
  analysisLevelId?: string;
  showCombinationAnalysis?: boolean;
}) {
  const [label, setLabel] = useState(initialValues.label);
  const [referenceCode, setReferenceCode] = useState(initialValues.referenceCode);
  const [fieldTypeId, setFieldTypeId] = useState(initialValues.fieldTypeId);
  const [designationPt, setDesignationPt] = useState(initialValues.designationPt);
  const [designationEs, setDesignationEs] = useState(initialValues.designationEs);
  const [designationEn, setDesignationEn] = useState(initialValues.designationEn);
  const [includeInDesignation, setIncludeInDesignation] = useState(initialValues.includeInDesignation);
  const [referenceMessage, setReferenceMessage] = useState<string | null>(null);
  const [referenceAvailable, setReferenceAvailable] = useState<boolean | null>(null);
  const [referenceWarning, setReferenceWarning] = useState(false);
  const [checkingReference, setCheckingReference] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [visibilityMode, setVisibilityMode] = useState<"always" | "conditional">(
    initialValues.visibilityMode ?? (initialValues.parentWordIds?.length ? "conditional" : "always"),
  );
  const [parentMatchMode, setParentMatchMode] = useState<ParentMatchMode>(initialValues.parentMatchMode ?? "any");
  const [selectionHierarchy, setSelectionHierarchy] = useState<number | null>(initialValues.selectionHierarchy ?? null);
  const [dependencyRules, setDependencyRules] = useState<WordDependencyRuleRow[]>([]);

  const isModal = variant === "modal";
  const gridClassName = isModal ? "grid gap-3" : "grid gap-4 md:grid-cols-2 xl:grid-cols-3";

  const designationWarnings = useMemo(
    () =>
      collectDesignationLengthWarnings(
        { pt: designationPt, es: designationEs, en: designationEn },
        { wordLabel: label.trim() || "Designacao", maxLength: MAX_DESIGNATION_LENGTH },
      ),
    [designationEn, designationEs, designationPt, label],
  );

  const resolvedAnalysisLevelId = analysisLevelId ?? categoryLevelId ?? null;

  const parentWordIdsForAnalysis = useMemo(
    () =>
      visibilityMode === "conditional"
        ? dependencyRules.map((rule) => rule.parentWordId).filter(Boolean)
        : [],
    [dependencyRules, visibilityMode],
  );

  const combinationAnalysis = useMemo(() => {
    if (!showCombinationAnalysis || !generatorCatalog || !resolvedAnalysisLevelId) return null;

    const normalizedReference = referenceCode.trim().toUpperCase();
    if (!normalizedReference || normalizedReference === "000") return null;
    if (!designationPt.trim() || !designationEs.trim() || !designationEn.trim()) return null;

    const wordId = initialValues.wordId ?? DRAFT_WORD_ID;
    const catalogWithWord = injectWordIntoCatalog(generatorCatalog, resolvedAnalysisLevelId, {
      id: wordId,
      label: label.trim() || "Nova palavra",
      referenceCode: normalizedReference,
      designationPt: designationPt.trim(),
      designationEs: designationEs.trim(),
      designationEn: designationEn.trim(),
      includeInDesignation,
      parentWordIds: parentWordIdsForAnalysis,
      parentMatchMode,
      selectionHierarchy,
    });

    return analyzeWordCombinationLimits(catalogWithWord, resolvedAnalysisLevelId, wordId);
  }, [
    designationEn,
    designationEs,
    designationPt,
    generatorCatalog,
    includeInDesignation,
    initialValues.wordId,
    label,
    parentMatchMode,
    parentWordIdsForAnalysis,
    referenceCode,
    resolvedAnalysisLevelId,
    selectionHierarchy,
    showCombinationAnalysis,
  ]);

  const selectedFieldType = useMemo(
    () => fieldTypes.find((fieldType) => fieldType.id === fieldTypeId) ?? null,
    [fieldTypeId, fieldTypes],
  );

  useEffect(() => {
    setLabel(initialValues.label);
    setReferenceCode(initialValues.referenceCode);
    setFieldTypeId(initialValues.fieldTypeId);
    setDesignationPt(initialValues.designationPt);
    setDesignationEs(initialValues.designationEs);
    setDesignationEn(initialValues.designationEn);
    setIncludeInDesignation(initialValues.includeInDesignation);
    setVisibilityMode(
      initialValues.visibilityMode ?? (initialValues.parentWordIds?.length ? "conditional" : "always"),
    );
    setParentMatchMode(initialValues.parentMatchMode ?? "any");
    setSelectionHierarchy(initialValues.selectionHierarchy ?? null);
    setSubmitError(null);
  }, [initialValues]);

  useEffect(() => {
    const parentWordIds = initialValues.parentWordIds ?? [];
    if (parentWordIds.length === 0 || parentLevels.length === 0) {
      setDependencyRules([]);
      return;
    }

    const nextRules: WordDependencyRuleRow[] = [];
    for (const parentWordId of parentWordIds) {
      for (const level of parentLevels) {
        if (level.words.some((word) => word.id === parentWordId)) {
          nextRules.push({ levelId: level.levelId, parentWordId });
          break;
        }
      }
    }
    setDependencyRules(nextRules);
  }, [initialValues.parentWordIds, parentLevels]);

  useEffect(() => {
    const normalized = referenceCode.trim().toUpperCase();
    if (!normalized) {
      setReferenceMessage(null);
      setReferenceAvailable(null);
      return;
    }

    if (normalized === "000") {
      setReferenceMessage("000 e reservado para Vazio e pode repetir-se em cada nivel.");
      setReferenceAvailable(true);
      setReferenceWarning(false);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setCheckingReference(true);
      const result = await checkWordReferenceCodeAction(
        normalized,
        initialValues.wordId,
        fieldTypeId || undefined,
        label.trim() || undefined,
      );
      if (cancelled) return;

      if (!result.ok) {
        setReferenceAvailable(null);
        setReferenceWarning(false);
        setReferenceMessage(result.message);
      } else if (result.sharedReferenceCount && result.sharedReferenceCount > 0) {
        setReferenceAvailable(true);
        setReferenceWarning(true);
        setReferenceMessage(result.message ?? null);
      } else {
        setReferenceAvailable(true);
        setReferenceWarning(false);
        setReferenceMessage(result.message ?? "Referencia valida neste nivel.");
      }
      setCheckingReference(false);
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [fieldTypeId, initialValues.wordId, label, referenceCode]);

  const canSubmit = referenceAvailable !== false && !isSubmitting;

  async function handleClientSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!clientAction || !canSubmit) return;

    setIsSubmitting(true);
    setSubmitError(null);

    const formData = new FormData(event.currentTarget);
    const result = await clientAction(formData);

    setIsSubmitting(false);
    if (!result.ok) {
      setSubmitError(result.message);
      return;
    }

    onSuccess?.(result.wordId);
  }

  return (
    <form
      action={clientAction ? undefined : action}
      onSubmit={clientAction ? handleClientSubmit : undefined}
      className={gridClassName}
    >
      {initialValues.wordId ? <input type="hidden" name="wordId" value={initialValues.wordId} /> : null}
      {categoryLevelId ? <input type="hidden" name="categoryLevelId" value={categoryLevelId} /> : null}

      <label className="space-y-2">
        <span className={`${isModal ? "text-xs" : "text-sm"} text-slate-300`}>Palavra</span>
        <input
          name="label"
          required
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          className={`flex w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-slate-100 ${isModal ? "h-9 text-xs" : "h-11 text-sm"}`}
        />
      </label>

      <label className="space-y-2">
        <span className={`${isModal ? "text-xs" : "text-sm"} text-slate-300`}>Referencia</span>
        <input
          name="referenceCode"
          required
          minLength={1}
          maxLength={3}
          value={referenceCode}
          onChange={(event) => setReferenceCode(event.target.value.toUpperCase())}
          className={[
            `flex w-full rounded-lg border bg-slate-950 px-3 uppercase text-slate-100 ${isModal ? "h-9 text-xs" : "h-11 text-sm"}`,
            referenceAvailable === false ? "border-red-400" : referenceWarning ? "border-amber-400/80" : referenceAvailable ? "border-emerald-500/60" : "border-slate-700",
          ].join(" ")}
        />
        {checkingReference ? <p className="text-xs text-slate-500">A verificar referencia...</p> : null}
        {referenceMessage ? (
          <p className={`text-xs ${referenceAvailable === false ? "text-red-300" : referenceWarning ? "text-amber-300" : "text-slate-400"}`}>{referenceMessage}</p>
        ) : null}
      </label>

      {lockFieldType ? (
        <>
          <input type="hidden" name="fieldTypeId" value={fieldTypeId} />
          <div className="space-y-2">
            <span className={`${isModal ? "text-xs" : "text-sm"} text-slate-300`}>Nivel</span>
            <div
              className={`flex w-full items-center rounded-lg border border-slate-700 bg-slate-950 px-3 text-slate-100 ${isModal ? "h-9 text-xs" : "h-11 text-sm"}`}
            >
              {lockedFieldTypeLabel ?? selectedFieldType?.name ?? "Nivel"}
            </div>
          </div>
        </>
      ) : (
        <label className="space-y-2">
          <span className={`${isModal ? "text-xs" : "text-sm"} text-slate-300`}>Nivel</span>
          <select
            name="fieldTypeId"
            required
            value={fieldTypeId}
            onChange={(event) => setFieldTypeId(event.target.value)}
            className={`flex w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-slate-100 ${isModal ? "h-9 text-xs" : "h-11 text-sm"}`}
          >
            <option value="">Selecionar...</option>
            {fieldTypes.map((fieldType) => (
              <option key={fieldType.id} value={fieldType.id}>
                {fieldType.name}
              </option>
            ))}
          </select>
        </label>
      )}

      <DesignationField
        compact={isModal}
        name="designationPt"
        label="Designacao PT"
        value={designationPt}
        onChange={setDesignationPt}
      />
      <DesignationField
        compact={isModal}
        name="designationEs"
        label="Designação ES"
        value={designationEs}
        onChange={setDesignationEs}
      />
      <DesignationField
        compact={isModal}
        name="designationEn"
        label="Designação EN"
        value={designationEn}
        onChange={setDesignationEn}
      />

      {designationWarnings.length > 0 ? (
        <div
          className={`rounded-xl border border-amber-400/30 bg-amber-400/10 p-4 ${isModal ? "" : "md:col-span-2 xl:col-span-3"}`}
        >
          <p className="text-sm font-medium text-amber-200">Avisos de designacao (palavra isolada)</p>
          <ul className="mt-2 space-y-1 text-xs text-amber-100/90">
            {designationWarnings.map((warning) => (
              <li key={`${warning.locale}-${warning.label}`}>{formatDesignationLengthWarning(warning)}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {showCombinationAnalysis ? (
        <WordCombinationWarningsPanel
          compact={isModal}
          analysis={combinationAnalysis}
          title="Combinacoes SKU que excedem limites com esta palavra"
        />
      ) : null}

      {parentLevels.length > 0 ? (
        <WordDependencyFields
          compact={isModal}
          parentLevels={parentLevels}
          visibilityMode={visibilityMode}
          onVisibilityModeChange={setVisibilityMode}
          rules={dependencyRules}
          onRulesChange={setDependencyRules}
          parentMatchMode={parentMatchMode}
          onParentMatchModeChange={setParentMatchMode}
          selectionHierarchy={selectionHierarchy}
          onSelectionHierarchyChange={setSelectionHierarchy}
          showHierarchyField={showHierarchyField}
        />
      ) : null}

      <label
        className={`flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-950/60 px-4 py-3 ${isModal ? "" : "md:col-span-2 xl:col-span-3"}`}
      >
        <input
          type="checkbox"
          name="includeInDesignation"
          checked={includeInDesignation}
          onChange={(event) => setIncludeInDesignation(event.target.checked)}
          className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-amber-400 focus:ring-amber-400"
        />
        <div>
          <p className={`${isModal ? "text-xs" : "text-sm"} font-medium text-slate-100`}>Incluir na designacao final</p>
          <p className="text-xs text-slate-400">Desativa quando a palavra so deve entrar na referencia/codigo.</p>
        </div>
      </label>

      {submitError ? <p className="text-xs text-red-300">{submitError}</p> : null}

      <div className={`flex gap-3 ${isModal ? "" : "md:col-span-2 xl:col-span-3"}`}>
        <Button type="submit" disabled={!canSubmit} className={isModal ? "h-8 px-3 text-xs" : undefined}>
          {isSubmitting ? "A guardar..." : submitLabel}
        </Button>
        {onCancel ? (
          <Button type="button" variant="outline" onClick={onCancel} className={isModal ? "h-8 px-3 text-xs" : undefined}>
            Cancelar
          </Button>
        ) : cancelHref ? (
          <Button asChild variant="outline">
            <Link href={cancelHref}>Cancelar</Link>
          </Button>
        ) : null}
      </div>
    </form>
  );
}
