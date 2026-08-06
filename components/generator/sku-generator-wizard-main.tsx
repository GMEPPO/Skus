"use client";

import React from "react";
import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { ArrowRight, CheckCircle2, ImagePlus, Search, Sparkles, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { generateSkuAction, type GenerateSkuActionResult } from "@/lib/sku-actions";
import { generateSkuSecureAction } from "@/lib/sku-secure-actions";
import type { GeneratorCatalog, GeneratorLevel, GeneratorWord } from "@/lib/types";
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
type SearchByLevel = Record<string, string>;
type GeneratedSkuModalData = Extract<GenerateSkuActionResult, { ok: true }>;

function isRequiredLevel(level: GeneratorLevel) {
  return level.fieldType !== "extra";
}

function getSelectedWord(level: GeneratorLevel, selectedId?: string) {
  if (!selectedId || isEmptySelection(selectedId)) return null;
  return level.options.find((option) => option.id === selectedId) ?? null;
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

export function SkuGeneratorWizardMain({
  catalog,
  secureGenerationV2Enabled = false,
  categoryId = null,
}: {
  catalog: GeneratorCatalog;
  /** When true, calls generate_sku_secure (requires categoryId + level selections). Default OFF. */
  secureGenerationV2Enabled?: boolean;
  categoryId?: string | null;
}) {
  const [selections, setSelections] = useState<Selections>({});
  const [searchByLevel, setSearchByLevel] = useState<SearchByLevel>({});
  const [unitsPerBox, setUnitsPerBox] = useState("");
  const [unitsPerBoxStatus, setUnitsPerBoxStatus] = useState<"real" | "estimated">("estimated");
  const [multiples, setMultiples] = useState("");
  const [multiplesStatus, setMultiplesStatus] = useState<"real" | "estimated">("estimated");
  const [weight, setWeight] = useState("");
  const [weightStatus, setWeightStatus] = useState<"real" | "estimated">("estimated");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [modalData, setModalData] = useState<GeneratedSkuModalData | null>(null);
  const [productImagePreviewUrl, setProductImagePreviewUrl] = useState<string | null>(null);
  const [productImageName, setProductImageName] = useState("");
  const [secureRequestId, setSecureRequestId] = useState(() => crypto.randomUUID());

  const requiredLevels = useMemo(() => catalog.levels.filter(isRequiredLevel), [catalog.levels]);
  const requiredCompletedCount = requiredLevels.filter((level) => selections[level.id] && !isEmptySelection(selections[level.id])).length;
  const selectedCount = Object.keys(selections).filter((key) => selections[key]).length;
  const designation = buildDesignation(catalog, selections);
  const designationPt = buildDesignationByLocale(catalog, selections, "pt");
  const designationEs = buildDesignationByLocale(catalog, selections, "es");
  const designationEn = buildDesignationByLocale(catalog, selections, "en");
  const designationLength = designation.length;
  const isDesignationTooLong = designationLength > MAX_DESIGNATION_LENGTH;
  const skuPreview = buildSkuPreview(catalog, selections);
  const hasAnyMeasurements = Boolean(unitsPerBox || multiples || weight);
  const hasAllMeasurements = Boolean(unitsPerBox && multiples && weight);
  const hasPartialMeasurements = hasAnyMeasurements && !hasAllMeasurements;
  const measurementError = hasPartialMeasurements
    ? "As medidas devem ser enviadas em conjunto: quantidade por caixa, multiplos e peso."
    : null;
  const canSubmit =
    catalog.levels.length > 0 &&
    requiredCompletedCount === requiredLevels.length &&
    !isDesignationTooLong &&
    hasAllMeasurements &&
    (!secureGenerationV2Enabled || Boolean(categoryId));

  useEffect(() => {
    return () => {
      if (productImagePreviewUrl) {
        URL.revokeObjectURL(productImagePreviewUrl);
      }
    };
  }, [productImagePreviewUrl]);

  function renewSecureRequestId() {
    if (secureGenerationV2Enabled) {
      setSecureRequestId(crypto.randomUUID());
    }
  }

  if (catalog.levels.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/40 p-6 text-sm text-slate-400">
        Ainda nao existem niveis disponiveis. Executa o reset/import global ou cria palavras na Biblioteca.
      </div>
    );
  }

  function handleSelection(level: GeneratorLevel, word?: GeneratorWord | null) {
    renewSecureRequestId();
    setSelections((current) => ({
      ...current,
      [level.id]: word === null ? buildEmptySelectionId(level.id) : word?.id ?? "",
    }));
  }

  function clearSelection(level: GeneratorLevel) {
    setSelections((current) => {
      const next = { ...current };
      delete next[level.id];
      return next;
    });
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

    if (secureGenerationV2Enabled) {
      if (!categoryId) {
        setSubmitError("Geracao V2 requer categoryId (catalogo por categoria).");
        setIsSubmitting(false);
        return;
      }

      formData.set("categoryId", categoryId);
      formData.set("selectionsJson", JSON.stringify(buildSecureSelectionsPayload(catalog, selections)));
      formData.set("requestId", secureRequestId);

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
      setSecureRequestId(crypto.randomUUID());
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
    renewSecureRequestId();
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

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        {secureGenerationV2Enabled ? (
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

        <div className="grid gap-4 lg:grid-cols-[1.35fr_0.85fr]">
          <div className="space-y-4">
            {catalog.levels.map((level) => {
              const selectedId = selections[level.id];
              const selectedWord = getSelectedWord(level, selectedId);
              const emptyOptionSelected = isEmptySelection(selectedId);
              const allOptions = getAvailableOptions(catalog, level.id);
              const query = searchByLevel[level.id] ?? "";
              const options = filterGeneratorWords(allOptions, query).slice(0, 36);
              const showEmptyOption = level.fieldType === "extra";

              return (
                <div
                  key={level.id}
                  className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4 shadow-lg shadow-black/10"
                >
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Nivel {level.order}</p>
                      <h3 className="text-lg font-semibold text-slate-50">{level.label}</h3>
                    </div>
                    {selectedId ? (
                      <Badge variant="success">
                        <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                        preenchido
                      </Badge>
                    ) : isRequiredLevel(level) ? (
                      <Badge>ativo</Badge>
                    ) : (
                      <Badge variant="outline">opcional</Badge>
                    )}
                  </div>

                  {selectedWord || emptyOptionSelected ? (
                    <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-amber-400/40 bg-amber-400/10 px-3 py-2">
                      <Sparkles className="h-4 w-4 text-amber-300" />
                      <span className="text-sm text-slate-100">
                        {emptyOptionSelected ? "Vazio" : selectedWord?.label}
                      </span>
                      <span className="rounded-md bg-slate-950 px-2 py-1 text-xs text-slate-400">
                        {emptyOptionSelected ? "000" : selectedWord?.referenceCode}
                      </span>
                      <Button type="button" variant="outline" onClick={() => clearSelection(level)}>
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
                      placeholder={`Buscar por palavra, codigo ou designacao em ${level.label}`}
                      className="h-full flex-1 bg-transparent outline-none placeholder:text-slate-600"
                    />
                  </label>

                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {options.map((option) => {
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
                              <p className="font-medium text-slate-100">{option.label}</p>
                              <p className="mt-1 text-xs text-slate-500">{option.referenceCode}</p>
                            </div>
                            {isSelected ? <Sparkles className="h-4 w-4 text-amber-300" /> : null}
                          </div>
                        </button>
                      );
                    })}
                    {showEmptyOption ? (
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
              );
            })}
          </div>

          <div className="space-y-4">
            <Card className="space-y-4 p-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Resumo</p>
                <h3 className="mt-1 text-xl font-semibold text-slate-50">SKU global</h3>
                <p className="mt-2 text-sm text-slate-400">
                  {secureGenerationV2Enabled
                    ? "Fluxo V2 seguro: o servidor e a fonte autoritativa para codigo e designacoes."
                    : "Biblioteca livre por nivel."}
                </p>
              </div>
              <div className="rounded-xl border border-slate-700 bg-slate-950/50 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Progressao</p>
                <p className="mt-2 text-3xl font-semibold text-slate-50">
                  {selectedCount}/{catalog.levels.length}
                </p>
              </div>
              <div className="rounded-xl border border-slate-700 bg-slate-950/50 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Preview SKU</p>
                <p className="mt-2 break-all text-lg font-semibold text-amber-300">{skuPreview}</p>
                {secureGenerationV2Enabled ? (
                  <p className="mt-2 text-xs text-slate-500">
                    Preview local apenas para orientacao. O resultado final vem exclusivamente da resposta do RPC.
                  </p>
                ) : null}
              </div>
            </Card>

            <Card className="p-4">
              <p className="mb-3 text-xs uppercase tracking-[0.2em] text-slate-500">Fluxo ativo</p>
              <p className="mb-3 text-sm text-slate-400">
                {secureGenerationV2Enabled ? "generateSkuSecureAction -> generate_sku_secure" : "generateSkuAction legacy"}
              </p>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                {catalog.levels.map((level, index) => (
                  <div
                    key={level.id}
                    className="flex items-center gap-2 rounded-full border border-slate-700 bg-slate-800 px-3 py-1"
                  >
                    <span>{level.label}</span>
                    {index < catalog.levels.length - 1 ? <ArrowRight className="h-3.5 w-3.5" /> : null}
                  </div>
                ))}
              </div>
            </Card>

            <Card className="space-y-4 p-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Dados logisticos</p>
                <p className="mt-1 text-sm text-slate-400">
                  Estes campos sao obrigatorios e cada um pode ser marcado como real ou estimado.
                </p>
                {measurementError ? <p className="mt-2 text-sm text-amber-300">{measurementError}</p> : null}
              </div>
              <div className="grid gap-4">
                <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                  <label className="space-y-2">
                    <span className="text-sm text-slate-300">Quantidade por caixa</span>
                    <input
                      name="unitsPerBox"
                      type="number"
                      min="0.01"
                      step="0.01"
                      required
                      value={unitsPerBox}
                      onChange={(event) => {
                        renewSecureRequestId();
                        setUnitsPerBox(event.target.value);
                      }}
                      className="flex h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm text-slate-300">Estado</span>
                    <select
                      name="unitsPerBoxStatus"
                      value={unitsPerBoxStatus}
                      onChange={(event) => {
                        renewSecureRequestId();
                        setUnitsPerBoxStatus(event.target.value as "real" | "estimated");
                      }}
                      className="flex h-11 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
                    >
                      <option value="estimated">Estimado</option>
                      <option value="real">Real</option>
                    </select>
                  </label>
                </div>

                <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                  <label className="space-y-2">
                    <span className="text-sm text-slate-300">Multiplos</span>
                    <input
                      name="multiples"
                      type="number"
                      min="0.01"
                      step="0.01"
                      required
                      value={multiples}
                      onChange={(event) => {
                        renewSecureRequestId();
                        setMultiples(event.target.value);
                      }}
                      className="flex h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm text-slate-300">Estado</span>
                    <select
                      name="multiplesStatus"
                      value={multiplesStatus}
                      onChange={(event) => {
                        renewSecureRequestId();
                        setMultiplesStatus(event.target.value as "real" | "estimated");
                      }}
                      className="flex h-11 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
                    >
                      <option value="estimated">Estimado</option>
                      <option value="real">Real</option>
                    </select>
                  </label>
                </div>

                <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                  <label className="space-y-2">
                    <span className="text-sm text-slate-300">Peso</span>
                    <input
                      name="weight"
                      type="number"
                      min="0.01"
                      step="0.01"
                      required
                      value={weight}
                      onChange={(event) => {
                        renewSecureRequestId();
                        setWeight(event.target.value);
                      }}
                      className="flex h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm text-slate-300">Estado</span>
                    <select
                      name="weightStatus"
                      value={weightStatus}
                      onChange={(event) => {
                        renewSecureRequestId();
                        setWeightStatus(event.target.value as "real" | "estimated");
                      }}
                      className="flex h-11 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
                    >
                      <option value="estimated">Estimado</option>
                      <option value="real">Real</option>
                    </select>
                  </label>
                </div>
              </div>
            </Card>

            <Card className="space-y-4 p-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Imagem do produto</p>
                <p className="mt-1 text-sm text-slate-400">
                  Podes anexar uma imagem JPG, PNG ou WEBP ate 5 MB. Este campo e opcional.
                </p>
              </div>
              <div className="grid gap-4">
                <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-slate-600 bg-slate-950/50 px-4 py-8 text-center transition hover:border-amber-400/70 hover:bg-slate-900/70">
                  <input
                    name="productImage"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={handleProductImageChange}
                  />
                  <ImagePlus className="h-8 w-8 text-amber-300" />
                  <p className="mt-3 text-sm font-medium text-slate-100">
                    {productImageName || "Selecionar imagem do produto"}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">Formato recomendado: imagem quadrada ou retrato curto.</p>
                </label>

                {productImagePreviewUrl ? (
                  <div className="rounded-2xl border border-slate-700 bg-slate-950/50 p-3">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <p className="text-sm text-slate-300">Preview da imagem</p>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={(event) => {
                          const form = event.currentTarget.closest("form");
                          const input = form?.querySelector<HTMLInputElement>('input[name="productImage"]') ?? null;
                          clearProductImage(input);
                        }}
                      >
                        <X className="mr-2 h-4 w-4" />
                        Remover
                      </Button>
                    </div>
                    <img
                      src={productImagePreviewUrl}
                      alt="Preview da imagem do produto"
                      className="h-56 w-full rounded-xl object-cover"
                    />
                  </div>
                ) : null}
              </div>
            </Card>
          </div>
        </div>

        <div className="sticky bottom-4 z-20 rounded-2xl border border-amber-500/30 bg-slate-950/95 p-4 shadow-2xl shadow-black/30 backdrop-blur">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
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
            </div>
            <Button type="submit" disabled={!canSubmit || isSubmitting}>
              {isSubmitting ? "A guardar..." : "Gerar SKU"}
            </Button>
          </div>
        </div>

        {submitError ? (
          <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {submitError}
          </div>
        ) : null}
      </form>

      {modalData ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-3xl rounded-2xl border border-slate-700 bg-slate-950 p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold text-slate-50">
                {modalData.message?.includes("reutilizado") ? "SKU reutilizado" : "SKU gerado com sucesso"}
              </h3>
              <Button type="button" variant="outline" onClick={() => setModalData(null)}>
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
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

