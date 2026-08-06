"use client";

import React, { useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { CheckCircle2, Search, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { completeSkuNormalizationSecureAction } from "@/lib/sku-secure-actions";
import type { GeneratorCatalog, GeneratorLevel, GeneratorWord, NormalizationRecord } from "@/lib/types";
import {
  buildDesignation,
  buildDesignationByLocale,
  buildEmptySelectionId,
  buildSkuPreview,
  filterGeneratorWords,
  getAvailableOptions,
  isEmptySelection,
  MAX_DESIGNATION_LENGTH,
} from "@/lib/sku";

type Selections = Record<string, string>;

function isRequiredLevel(level: GeneratorLevel) {
  return level.fieldType !== "extra";
}

function buildSecureSelectionsPayload(catalog: GeneratorCatalog, selections: Selections) {
  const payload: Record<string, { kind: "word"; wordId: string } | { kind: "empty" }> = {};
  for (const level of catalog.levels) {
    const selectedId = selections[level.id];
    if (!selectedId) continue;
    payload[level.id] = isEmptySelection(selectedId) ? { kind: "empty" } : { kind: "word", wordId: selectedId };
  }
  return payload;
}

export function NormalizationWorkWizard({
  record,
  catalog,
  categoryId,
  categoryLabel,
  normalizationV2Enabled,
}: {
  record: NormalizationRecord;
  catalog: GeneratorCatalog;
  categoryId: string;
  categoryLabel: string;
  normalizationV2Enabled: boolean;
}) {
  const [selections, setSelections] = useState<Selections>({});
  const [searchByLevel, setSearchByLevel] = useState<Record<string, string>>({});
  const [unitsPerBox, setUnitsPerBox] = useState("");
  const [unitsPerBoxStatus, setUnitsPerBoxStatus] = useState<"real" | "estimated">("estimated");
  const [multiples, setMultiples] = useState("");
  const [multiplesStatus, setMultiplesStatus] = useState<"real" | "estimated">("estimated");
  const [weight, setWeight] = useState("");
  const [weightStatus, setWeightStatus] = useState<"real" | "estimated">("estimated");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<Record<string, unknown> | null>(null);
  const [secureRequestId] = useState(() => crypto.randomUUID());
  const requestBoundPayloadKeyRef = useRef<string | null>(null);
  const secureRequestIdRef = useRef(secureRequestId);

  const requiredLevels = useMemo(() => catalog.levels.filter(isRequiredLevel), [catalog.levels]);
  const requiredCompletedCount = requiredLevels.filter((level) => selections[level.id] && !isEmptySelection(selections[level.id])).length;
  const designation = buildDesignation(catalog, selections);
  const designationPt = buildDesignationByLocale(catalog, selections, "pt");
  const designationEs = buildDesignationByLocale(catalog, selections, "es");
  const designationEn = buildDesignationByLocale(catalog, selections, "en");
  const isDesignationTooLong = designation.length > MAX_DESIGNATION_LENGTH;
  const skuPreview = buildSkuPreview(catalog, selections);
  const hasAnyMeasurements = Boolean(unitsPerBox || multiples || weight);
  const hasAllMeasurements = Boolean(unitsPerBox && multiples && weight);
  const hasPartialMeasurements = hasAnyMeasurements && !hasAllMeasurements;
  const measurementError = hasPartialMeasurements
    ? "As medidas devem ser enviadas em conjunto ou deixadas todas vazias."
    : null;

  const canSubmit =
    normalizationV2Enabled &&
    catalog.levels.length > 0 &&
    requiredCompletedCount === requiredLevels.length &&
    !isDesignationTooLong &&
    !hasPartialMeasurements &&
    Boolean(categoryId);

  function buildPayloadKey(
    nextSelections: Selections = selections,
    nextUnitsPerBox = unitsPerBox,
    nextUnitsPerBoxStatus = unitsPerBoxStatus,
    nextMultiples = multiples,
    nextMultiplesStatus = multiplesStatus,
    nextWeight = weight,
    nextWeightStatus = weightStatus,
  ) {
    return JSON.stringify({
      normalizationId: record.id,
      categoryId,
      selections: nextSelections,
      unitsPerBox: nextUnitsPerBox,
      unitsPerBoxStatus: nextUnitsPerBoxStatus,
      multiples: nextMultiples,
      multiplesStatus: nextMultiplesStatus,
      weight: nextWeight,
      weightStatus: nextWeightStatus,
    });
  }

  function bindOrRenewRequestId(payloadKey: string): string {
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
    return nextRequestId;
  }

  function handleSelection(level: GeneratorLevel, word?: GeneratorWord | null) {
    const nextValue = word === null ? buildEmptySelectionId(level.id) : word?.id ?? "";
    const nextSelections = { ...selections, [level.id]: nextValue };
    bindOrRenewRequestId(buildPayloadKey(nextSelections));
    setSelections(nextSelections);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit || isSubmitting) return;
    if (measurementError) {
      setSubmitError(measurementError);
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    const formData = new FormData(event.currentTarget);
    formData.set("normalizationId", record.id);
    formData.set("categoryId", categoryId);
    formData.set("selectionsJson", JSON.stringify(buildSecureSelectionsPayload(catalog, selections)));
    formData.set("requestId", bindOrRenewRequestId(buildPayloadKey()));

    if (hasAllMeasurements) {
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

    const result = await completeSkuNormalizationSecureAction(formData);
    if (!result.ok) {
      setSubmitError(result.message);
      setIsSubmitting(false);
      return;
    }

    setSuccessData(result.data);
    setIsSubmitting(false);
  }

  if (successData) {
    return (
      <Card className="space-y-4 border-emerald-500/30 bg-emerald-500/5 p-6">
        <div className="flex items-center gap-2 text-emerald-200">
          <CheckCircle2 className="h-5 w-5" />
          <p className="font-medium">Normalizacao concluida</p>
        </div>
        <dl className="grid gap-3 text-sm">
          <div>
            <dt className="text-slate-500">Codigo final</dt>
            <dd className="font-mono text-slate-100">{String(successData.generatedCode ?? record.finalNewCode ?? "")}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Designacao PT</dt>
            <dd>{String(successData.designationPt ?? "")}</dd>
          </div>
        </dl>
      </Card>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card className="space-y-3 p-4">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Origem legacy</p>
        <dl className="grid gap-2 text-sm md:grid-cols-2">
          <div>
            <dt className="text-slate-500">Codigo antigo</dt>
            <dd className="font-mono">{record.legacyCode ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Designacao antiga</dt>
            <dd>{record.legacyDesignation ?? record.sourceDesignationPt ?? "—"}</dd>
          </div>
          {record.sourceNewCode ? (
            <div>
              <dt className="text-slate-500">Codigo sugerido (import)</dt>
              <dd className="font-mono">{record.sourceNewCode}</dd>
            </div>
          ) : null}
        </dl>
        <p className="text-xs text-slate-500">
          Categoria: {categoryLabel} · Fila {record.sourceRowNumber} · {record.batchFileName}
        </p>
      </Card>

      {!normalizationV2Enabled ? (
        <Card className="border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-100">
          Normalizacao V2 desativada. Ativa `NEXT_PUBLIC_SKUS_NORMALIZATION_V2=true` para concluir registos.
        </Card>
      ) : null}

      {catalog.levels.map((level) => {
        const query = searchByLevel[level.id] ?? "";
        const options = filterGeneratorWords(getAvailableOptions(catalog, level.id), query);
        const selectedId = selections[level.id];
        return (
          <Card key={level.id} className="space-y-4 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                  Nivel {level.order} — {level.label}
                </p>
                {isRequiredLevel(level) ? (
                  <Badge variant="outline" className="mt-1">
                    Obrigatorio
                  </Badge>
                ) : null}
              </div>
              <div className="relative w-full max-w-xs">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  type="search"
                  placeholder="Procurar..."
                  value={query}
                  onChange={(event) => setSearchByLevel((current) => ({ ...current, [level.id]: event.target.value }))}
                  className="flex h-10 w-full rounded-lg border border-slate-700 bg-slate-950 py-2 pl-9 pr-3 text-sm"
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {options.map((word) => {
                const isSelected = selectedId === word.id;
                return (
                  <Button
                    key={word.id}
                    type="button"
                    variant={isSelected ? "default" : "outline"}
                    onClick={() => handleSelection(level, word)}
                    className={isSelected ? "border-amber-400/50 bg-amber-500/20 text-amber-100" : ""}
                  >
                    {isSelected ? <Sparkles className="mr-1 h-3 w-3" /> : null}
                    {word.label}
                  </Button>
                );
              })}
              <Button type="button" variant="outline" onClick={() => handleSelection(level, null)}>
                Sem valor
              </Button>
            </div>
          </Card>
        );
      })}

      <Card className="space-y-4 p-4">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Medidas logisticas (opcional)</p>
        {measurementError ? <p className="text-sm text-amber-300">{measurementError}</p> : null}
        <div className="grid gap-4 md:grid-cols-3">
          <label className="space-y-2">
            <span className="text-sm text-slate-300">Quantidade por caixa</span>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={unitsPerBox}
              onChange={(event) => setUnitsPerBox(event.target.value)}
              onBlur={() => bindOrRenewRequestId(buildPayloadKey())}
              className="flex h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm"
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm text-slate-300">Multiplos</span>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={multiples}
              onChange={(event) => setMultiples(event.target.value)}
              onBlur={() => bindOrRenewRequestId(buildPayloadKey())}
              className="flex h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm"
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm text-slate-300">Peso</span>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={weight}
              onChange={(event) => setWeight(event.target.value)}
              onBlur={() => bindOrRenewRequestId(buildPayloadKey())}
              className="flex h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm"
            />
          </label>
        </div>
      </Card>

      <Card className="space-y-3 p-4">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Preview</p>
        <p className="font-mono text-lg text-amber-200">{skuPreview || "—"}</p>
        <p className="text-sm text-slate-300">{designationPt || "—"}</p>
        {isDesignationTooLong ? (
          <p className="text-sm text-red-300">Designacao demasiado longa ({designation.length}/{MAX_DESIGNATION_LENGTH}).</p>
        ) : null}
      </Card>

      {submitError ? <p className="text-sm text-red-300">{submitError}</p> : null}

      <div className="flex justify-end">
        <Button type="submit" disabled={!canSubmit || isSubmitting}>
          {isSubmitting ? "A concluir..." : "Concluir normalizacao"}
        </Button>
      </div>
    </form>
  );
}
