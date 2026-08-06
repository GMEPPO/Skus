"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NormalizationPendingSidebar } from "@/components/generator/normalization-pending-sidebar";
import { SkuGeneratorWizardMain } from "@/components/generator/sku-generator-wizard-main";
import { fetchGeneratorCatalogAction } from "@/lib/generator-catalog-actions";
import {
  claimNormalizationForGeneratorAction,
  releaseNormalizationAction,
} from "@/lib/sku-normalization-actions";
import type { GeneratorCatalog, NormalizationQueueItem } from "@/lib/types";

type CategoryOption = { id: string; name: string; slug: string };

export function GeneratorWorkspace({
  categories,
  initialCategoryId,
  initialCatalog,
  pendingItems,
  secureGenerationV2Enabled,
  normalizationV2Enabled,
}: {
  categories: CategoryOption[];
  initialCategoryId: string;
  initialCatalog: GeneratorCatalog;
  pendingItems: NormalizationQueueItem[];
  secureGenerationV2Enabled: boolean;
  normalizationV2Enabled: boolean;
}) {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [referenceFilter, setReferenceFilter] = useState("");
  const [designationFilter, setDesignationFilter] = useState("");
  const [categoryId, setCategoryId] = useState(initialCategoryId);
  const [catalog, setCatalog] = useState(initialCatalog);
  const [selectedNorm, setSelectedNorm] = useState<NormalizationQueueItem | null>(null);
  const [wizardKey, setWizardKey] = useState(0);
  const [isLoadingNormId, setIsLoadingNormId] = useState<string | null>(null);
  const [sidebarError, setSidebarError] = useState<string | null>(null);
  const [isChangingCategory, setIsChangingCategory] = useState(false);

  const bumpWizard = useCallback(() => setWizardKey((value) => value + 1), []);

  async function handleCategoryChange(nextCategoryId: string) {
    if (nextCategoryId === categoryId || isChangingCategory) return;

    setIsChangingCategory(true);
    setSidebarError(null);

    if (selectedNorm) {
      await releaseNormalizationAction(selectedNorm.id).catch(() => undefined);
      setSelectedNorm(null);
    }

    const result = await fetchGeneratorCatalogAction(nextCategoryId);
    if (!result.ok) {
      setSidebarError(result.message);
      setIsChangingCategory(false);
      return;
    }

    setCategoryId(nextCategoryId);
    setCatalog(result.catalog);
    bumpWizard();
    setIsChangingCategory(false);
  }

  async function handleSelectNormalization(item: NormalizationQueueItem) {
    setSidebarError(null);

    if (selectedNorm && selectedNorm.id !== item.id) {
      await releaseNormalizationAction(selectedNorm.id).catch(() => undefined);
    }

    if (normalizationV2Enabled) {
      setIsLoadingNormId(item.id);
      const claim = await claimNormalizationForGeneratorAction(item.id);
      setIsLoadingNormId(null);
      if (!claim.ok) {
        setSidebarError(claim.message);
        return;
      }
    }

    if (item.categoryId && item.categoryId !== categoryId) {
      const catalogResult = await fetchGeneratorCatalogAction(item.categoryId);
      if (catalogResult.ok) {
        setCategoryId(item.categoryId);
        setCatalog(catalogResult.catalog);
      }
    }

    setSelectedNorm(item);
    bumpWizard();
  }

  async function handleClearNormalization() {
    if (selectedNorm) {
      await releaseNormalizationAction(selectedNorm.id).catch(() => undefined);
    }
    setSelectedNorm(null);
    bumpWizard();
  }

  function handleNormalizationComplete() {
    setSelectedNorm(null);
    bumpWizard();
    router.refresh();
  }

  const activeCategory = categories.find((category) => category.id === categoryId);

  return (
    <div className="flex flex-col gap-4 xl:flex-row xl:items-start">
      <NormalizationPendingSidebar
        items={pendingItems}
        selectedId={selectedNorm?.id ?? null}
        referenceFilter={referenceFilter}
        designationFilter={designationFilter}
        onReferenceFilterChange={setReferenceFilter}
        onDesignationFilterChange={setDesignationFilter}
        onSelect={handleSelectNormalization}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen((open) => !open)}
        isLoadingId={isLoadingNormId}
        sidebarError={sidebarError}
      />

      <div className="min-w-0 flex-1 space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Wizard de composicao</CardTitle>
            <CardDescription>
              Seleciona a categoria e constrói a referencia. Clica num codigo pendente para normalizar.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="block max-w-md space-y-2">
              <span className="text-sm text-slate-300">Categoria</span>
              <select
                value={categoryId}
                disabled={isChangingCategory}
                onChange={(event) => void handleCategoryChange(event.target.value)}
                className="flex h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
              >
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name} ({category.slug})
                  </option>
                ))}
              </select>
            </label>

            {activeCategory ? (
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                Catalogo activo: {activeCategory.name}
                {selectedNorm ? " · modo normalizacao" : ""}
              </p>
            ) : null}

            <SkuGeneratorWizardMain
              key={wizardKey}
              catalog={catalog}
              secureGenerationV2Enabled={secureGenerationV2Enabled}
              normalizationV2Enabled={normalizationV2Enabled}
              categoryId={categoryId}
              normalizationTarget={
                selectedNorm
                  ? {
                      id: selectedNorm.id,
                      legacyCode: selectedNorm.legacyCode,
                      legacyDesignation: selectedNorm.legacyDesignation,
                      sourceDesignationPt: selectedNorm.sourceDesignationPt,
                    }
                  : null
              }
              onClearNormalization={() => void handleClearNormalization()}
              onNormalizationComplete={handleNormalizationComplete}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
