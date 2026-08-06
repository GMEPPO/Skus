/* @vitest-environment jsdom */

import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SkuGeneratorWizardMain } from "@/components/generator/sku-generator-wizard-main";
import type { GeneratorCatalog } from "@/lib/types";

const generateSkuActionMock = vi.fn();
const generateSkuSecureActionMock = vi.fn();

vi.mock("@/lib/sku-actions", () => ({
  generateSkuAction: (formData: FormData) => generateSkuActionMock(formData),
}));

vi.mock("@/lib/sku-secure-actions", () => ({
  generateSkuSecureAction: (formData: FormData) => generateSkuSecureActionMock(formData),
}));

vi.mock("lucide-react", () => {
  const icon = (name: string) => (props: Record<string, unknown>) => React.createElement("span", { ...props }, name);
  return {
    ArrowRight: icon("ArrowRight"),
    CheckCircle2: icon("CheckCircle2"),
    ImagePlus: icon("ImagePlus"),
    Search: icon("Search"),
    Sparkles: icon("Sparkles"),
    X: icon("X"),
  };
});

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children, ...props }: React.HTMLAttributes<HTMLSpanElement>) =>
    React.createElement("span", props, children),
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    type = "button",
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children?: React.ReactNode }) =>
    React.createElement("button", { type, ...props }, children),
}));

vi.mock("@/components/ui/card", () => ({
  Card: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => React.createElement("div", props, children),
}));

const catalog: GeneratorCatalog = {
  levels: [
    {
      id: "level-brand",
      order: 1,
      fieldType: "brand",
      label: "Marca",
      options: [
        {
          id: "word-brand",
          label: "ALG",
          referenceCode: "ALG",
          designation: "ALG",
          designationPt: "ALG",
          designationEs: "ALG",
          designationEn: "ALG",
          includeInDesignation: true,
        },
      ],
    },
    {
      id: "level-extra",
      order: 2,
      fieldType: "extra",
      label: "Extra",
      options: [],
    },
  ],
};

function renderWizard(props: { secureGenerationV2Enabled: boolean; categoryId?: string | null }) {
  return render(
    React.createElement(SkuGeneratorWizardMain, {
      catalog,
      secureGenerationV2Enabled: props.secureGenerationV2Enabled,
      categoryId: props.categoryId ?? null,
    }),
  );
}

function fillRequiredFields() {
  const optionLabel = screen.getAllByText("ALG").find((node) => node.closest("button")) ?? null;
  if (!optionLabel) {
    throw new Error("Option ALG not found");
  }
  fireEvent.click(optionLabel.closest("button") as HTMLButtonElement);
  const [unitsInput, multiplesInput, weightInput] = screen.getAllByRole("spinbutton");
  fireEvent.change(unitsInput, { target: { value: "12" } });
  fireEvent.change(multiplesInput, { target: { value: "6" } });
  fireEvent.change(weightInput, { target: { value: "1.5" } });
}

function clickSubmit() {
  const submit = document.querySelector('form button[type="submit"]');
  if (!(submit instanceof HTMLButtonElement)) {
    throw new Error("Submit button not found");
  }
  fireEvent.click(submit);
}

describe("generator V2 routing", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    generateSkuActionMock.mockReset();
    generateSkuSecureActionMock.mockReset();

    let seq = 1;
    Object.defineProperty(globalThis, "crypto", {
      value: {
        randomUUID: vi.fn(() => `00000000-0000-4000-8000-${String(seq++).padStart(12, "0")}`),
      },
      configurable: true,
    });
  });

  it("flag=false usa generateSkuAction y conserva el contrato legacy", async () => {
    generateSkuActionMock.mockResolvedValue({
      ok: true,
      message: "SKU criado com sucesso.",
      generatedCode: "ALG-000",
      generatedCodeCompact: "ALG000",
      designationPt: "ALG",
      designationEs: "ALG",
      designationEn: "ALG",
      unitsPerBox: 12,
      unitsPerBoxStatus: "estimated",
      multiples: 6,
      multiplesStatus: "estimated",
      weight: 1.5,
      weightStatus: "estimated",
    });

    renderWizard({ secureGenerationV2Enabled: false });
    fillRequiredFields();
    clickSubmit();

    await waitFor(() => expect(generateSkuActionMock).toHaveBeenCalledTimes(1));
    expect(generateSkuSecureActionMock).not.toHaveBeenCalled();

    const formData = generateSkuActionMock.mock.calls[0][0] as FormData;
    expect(formData.get("generatedCode")).toBeTruthy();
    expect(formData.get("designation")).toBeTruthy();
    expect(formData.get("designationPt")).toBeTruthy();
    expect(formData.get("designationEs")).toBeTruthy();
    expect(formData.get("designationEn")).toBeTruthy();
    expect(formData.get("selectionSnapshot")).toBeTruthy();
  });

  it("flag=true usa generateSkuSecureAction y no envia campos legacy", async () => {
    generateSkuSecureActionMock.mockResolvedValue({
      ok: true,
      message: "SKU criado com sucesso.",
      created: true,
      generationId: "11111111-1111-4111-8111-111111111111",
      generatedCode: "SRV-001",
      generatedCodeCompact: "SRV001",
      designationPt: "Servidor PT",
      designationEs: "Servidor ES",
      designationEn: "Server EN",
      snapshotVersion: 2,
      selectionFingerprint: "a".repeat(64),
      unitsPerBox: 12,
      unitsPerBoxStatus: "estimated",
      multiples: 6,
      multiplesStatus: "estimated",
      weight: 1.5,
      weightStatus: "estimated",
      requestId: "00000000-0000-4000-8000-000000000001",
    });

    renderWizard({
      secureGenerationV2Enabled: true,
      categoryId: "22222222-2222-4222-8222-222222222222",
    });
    fillRequiredFields();
    clickSubmit();

    await waitFor(() => expect(generateSkuSecureActionMock).toHaveBeenCalledTimes(1));
    expect(generateSkuActionMock).not.toHaveBeenCalled();

    const formData = generateSkuSecureActionMock.mock.calls[0][0] as FormData;
    expect(formData.get("categoryId")).toBe("22222222-2222-4222-8222-222222222222");
    expect(String(formData.get("requestId"))).toMatch(/^00000000-0000-4000-8000-\d{12}$/);
    expect(formData.get("selectionsJson")).toContain("word-brand");
    expect(formData.get("generatedCode")).toBeNull();
    expect(formData.get("designation")).toBeNull();
    expect(formData.get("designationPt")).toBeNull();
    expect(formData.get("designationEs")).toBeNull();
    expect(formData.get("designationEn")).toBeNull();
    expect(formData.get("selectionSnapshot")).toBeNull();
  });

  it("mantiene requestId estable entre retries sin cambios", async () => {
    generateSkuSecureActionMock.mockResolvedValue({
      ok: false,
      code: "measurement_request_conflict",
      message: "Conflito de requestId nas medidas.",
    });

    renderWizard({
      secureGenerationV2Enabled: true,
      categoryId: "22222222-2222-4222-8222-222222222222",
    });
    fillRequiredFields();

    clickSubmit();
    await waitFor(() => expect(generateSkuSecureActionMock).toHaveBeenCalledTimes(1));
    clickSubmit();
    await waitFor(() => expect(generateSkuSecureActionMock).toHaveBeenCalledTimes(2));

    const first = (generateSkuSecureActionMock.mock.calls[0][0] as FormData).get("requestId");
    const second = (generateSkuSecureActionMock.mock.calls[1][0] as FormData).get("requestId");
    expect(first).toBe(second);
  });

  it("rechaza medidas parciales antes de invocar la action V2", () => {
    renderWizard({
      secureGenerationV2Enabled: true,
      categoryId: "22222222-2222-4222-8222-222222222222",
    });

    const optionLabel = screen.getAllByText("ALG").find((node) => node.closest("button")) ?? null;
    if (!optionLabel) {
      throw new Error("Option ALG not found");
    }
    fireEvent.click(optionLabel.closest("button") as HTMLButtonElement);
    const [unitsInput] = screen.getAllByRole("spinbutton");
    fireEvent.change(unitsInput, { target: { value: "12" } });

    expect(generateSkuSecureActionMock).not.toHaveBeenCalled();
    expect(screen.queryByText(/As medidas devem ser enviadas en conjunto|As medidas devem ser enviadas em conjunto/i)).not.toBeNull();
  });

  it("muestra valores del servidor y reutilizacion cuando created=false", async () => {
    generateSkuSecureActionMock.mockResolvedValue({
      ok: true,
      message: "SKU reutilizado (idempotente).",
      created: false,
      generationId: "11111111-1111-4111-8111-111111111111",
      generatedCode: "RPC-999",
      generatedCodeCompact: "RPC999",
      designationPt: "Resposta PT",
      designationEs: "Resposta ES",
      designationEn: "Response EN",
      snapshotVersion: 2,
      selectionFingerprint: "b".repeat(64),
      unitsPerBox: 12,
      unitsPerBoxStatus: "estimated",
      multiples: 6,
      multiplesStatus: "estimated",
      weight: 1.5,
      weightStatus: "estimated",
      requestId: "00000000-0000-4000-8000-000000000001",
    });

    renderWizard({
      secureGenerationV2Enabled: true,
      categoryId: "22222222-2222-4222-8222-222222222222",
    });
    fillRequiredFields();
    clickSubmit();

    await screen.findByText("SKU reutilizado");
    expect(screen.queryByText("SKU reutilizado (idempotente).")).not.toBeNull();
    expect(screen.queryByText(/RPC999/)).not.toBeNull();
    expect(screen.queryByText(/Resposta PT/)).not.toBeNull();
    expect(screen.queryByText(/Resposta ES/)).not.toBeNull();
    expect(screen.queryByText(/Response EN/)).not.toBeNull();
  });
});
