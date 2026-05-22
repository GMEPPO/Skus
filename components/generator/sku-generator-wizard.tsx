"use client";

import type { GeneratorCatalog } from "@/lib/types";
import { SkuGeneratorWizardMain } from "@/components/generator/sku-generator-wizard-main";

export function SkuGeneratorWizard({ catalog }: { catalog: GeneratorCatalog }) {
  return <SkuGeneratorWizardMain catalog={catalog} />;
}

