"use client";

import { useMemo, useState, type ChangeEvent } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { FamilyOption, FieldTypeOption, WordDependencyOption } from "@/lib/admin-catalog";

type WordFormInitialValues = {
  wordId?: string;
  label: string;
  referenceCode: string;
  fieldTypeId: string;
  designationPt: string;
  designationEs: string;
  designationEn: string;
  includeInDesignation: boolean;
  familyIds: string[];
  parentWordIds: string[];
};

function getRequiredParentFieldTypeLabel(fieldTypeCode: string) {
  if (fieldTypeCode === "product") return "Formatos";
  if (fieldTypeCode === "size") return "Produtos";
  if (fieldTypeCode === "packaging") return "Tamanhos";
  if (fieldTypeCode === "extra") return "Embalagens";
  return null;
}

function getRequiredParentFieldTypeCode(fieldTypeCode: string) {
  if (fieldTypeCode === "product") return "format";
  if (fieldTypeCode === "size") return "product";
  if (fieldTypeCode === "packaging") return "size";
  if (fieldTypeCode === "extra") return "packaging";
  return null;
}

export function WordForm({
  action,
  submitLabel,
  cancelHref,
  fieldTypes,
  families,
  dependencyOptions,
  initialValues,
}: {
  action: (formData: FormData) => void | Promise<void>;
  submitLabel: string;
  cancelHref?: string;
  fieldTypes: FieldTypeOption[];
  families: FamilyOption[];
  dependencyOptions: WordDependencyOption[];
  initialValues: WordFormInitialValues;
}) {
  const [fieldTypeId, setFieldTypeId] = useState(initialValues.fieldTypeId);
  const [selectedFamilyIds, setSelectedFamilyIds] = useState<string[]>(initialValues.familyIds);
  const [selectedParentWordIds, setSelectedParentWordIds] = useState<string[]>(initialValues.parentWordIds);

  const selectedFieldType = fieldTypes.find((fieldType) => fieldType.id === fieldTypeId);
  const requiredParentFieldTypeCode = getRequiredParentFieldTypeCode(selectedFieldType?.code ?? "");
  const requiredParentFieldTypeLabel = getRequiredParentFieldTypeLabel(selectedFieldType?.code ?? "");

  const availableParentOptions = useMemo(() => {
    if (!requiredParentFieldTypeCode) return [];

    return dependencyOptions.filter((option) => {
      const optionFieldType = fieldTypes.find((fieldType) => fieldType.id === option.fieldTypeId);
      if (!optionFieldType || optionFieldType.code !== requiredParentFieldTypeCode) {
        return false;
      }

      if (selectedFamilyIds.length === 0) {
        return true;
      }

      return option.familyIds.some((familyId) => selectedFamilyIds.includes(familyId));
    });
  }, [dependencyOptions, fieldTypes, requiredParentFieldTypeCode, selectedFamilyIds]);

  const visibleParentIds = new Set(availableParentOptions.map((option) => option.id));
  const effectiveParentWordIds = selectedParentWordIds.filter((parentWordId) => visibleParentIds.has(parentWordId));

  function handleFamilyChange(event: ChangeEvent<HTMLSelectElement>) {
    const values = Array.from(event.target.selectedOptions, (option) => option.value);
    setSelectedFamilyIds(values);
  }

  function handleParentChange(event: ChangeEvent<HTMLSelectElement>) {
    const values = Array.from(event.target.selectedOptions, (option) => option.value);
    setSelectedParentWordIds(values);
  }

  return (
    <form action={action} className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {initialValues.wordId ? <input type="hidden" name="wordId" value={initialValues.wordId} /> : null}

      <label className="space-y-2">
        <span className="text-sm text-slate-300">Palavra</span>
        <input
          name="label"
          required
          defaultValue={initialValues.label}
          className="flex h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
        />
      </label>

      <label className="space-y-2">
        <span className="text-sm text-slate-300">Referencia</span>
        <input
          name="referenceCode"
          required
          minLength={3}
          maxLength={3}
          defaultValue={initialValues.referenceCode}
          className="flex h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm uppercase text-slate-100"
        />
      </label>

      <label className="space-y-2">
        <span className="text-sm text-slate-300">Tipo de campo</span>
        <select
          name="fieldTypeId"
          required
          value={fieldTypeId}
          onChange={(event) => {
            setFieldTypeId(event.target.value);
            setSelectedParentWordIds([]);
          }}
          className="flex h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
        >
          <option value="">Selecionar...</option>
          {fieldTypes.map((fieldType) => (
            <option key={fieldType.id} value={fieldType.id}>
              {fieldType.name}
            </option>
          ))}
        </select>
      </label>

      <label className="space-y-2">
        <span className="text-sm text-slate-300">Designacao PT</span>
        <input
          name="designationPt"
          required
          defaultValue={initialValues.designationPt}
          className="flex h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
        />
      </label>

      <label className="space-y-2">
        <span className="text-sm text-slate-300">Designacion ES</span>
        <input
          name="designationEs"
          required
          defaultValue={initialValues.designationEs}
          className="flex h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
        />
      </label>

      <label className="space-y-2">
        <span className="text-sm text-slate-300">Designation EN</span>
        <input
          name="designationEn"
          required
          defaultValue={initialValues.designationEn}
          className="flex h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
        />
      </label>

      <label className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-950/60 px-4 py-3 md:col-span-2 xl:col-span-1">
        <input
          type="checkbox"
          name="includeInDesignation"
          defaultChecked={initialValues.includeInDesignation}
          className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-amber-400 focus:ring-amber-400"
        />
        <div>
          <p className="text-sm font-medium text-slate-100">Incluir na designacao final</p>
          <p className="text-xs text-slate-400">Desativa se esta palavra so deve entrar na referencia/codigo.</p>
        </div>
      </label>

      <label className="space-y-2 md:col-span-2 xl:col-span-3">
        <span className="text-sm text-slate-300">Familias associadas</span>
        <select
          name="familyIds"
          multiple
          value={selectedFamilyIds}
          onChange={handleFamilyChange}
          className="min-h-[10rem] w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-slate-100"
        >
          {families.map((family) => (
            <option key={family.id} value={family.id}>
              {family.name}
            </option>
          ))}
        </select>
        <p className="text-xs text-slate-500">Podes selecionar uma ou varias familias. Em Windows usa `Ctrl`.</p>
      </label>

      {requiredParentFieldTypeCode ? (
        <label className="space-y-2 md:col-span-2 xl:col-span-3">
          <span className="text-sm text-slate-300">
            {requiredParentFieldTypeLabel} associados
          </span>
          <select
            name="parentWordIds"
            multiple
            required
            value={effectiveParentWordIds}
            onChange={handleParentChange}
            className="min-h-[10rem] w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-slate-100"
          >
            {availableParentOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label} - {option.referenceCode}
              </option>
            ))}
          </select>
          <p className="text-xs text-slate-500">
            Este tipo exige ligacao ao nivel anterior para funcionar no builder e no gerador.
          </p>
        </label>
      ) : null}

      <div className="flex gap-3 md:col-span-2 xl:col-span-3">
        <Button type="submit">{submitLabel}</Button>
        {cancelHref ? (
          <Button asChild variant="outline">
            <Link href={cancelHref}>Cancelar</Link>
          </Button>
        ) : null}
      </div>
    </form>
  );
}
