"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { FieldTypeOption } from "@/lib/admin-catalog";

type WordFormInitialValues = {
  wordId?: string;
  label: string;
  referenceCode: string;
  fieldTypeId: string;
  designationPt: string;
  designationEs: string;
  designationEn: string;
  includeInDesignation: boolean;
};

export function WordForm({
  action,
  submitLabel,
  cancelHref,
  fieldTypes,
  initialValues,
}: {
  action: (formData: FormData) => void | Promise<void>;
  submitLabel: string;
  cancelHref?: string;
  fieldTypes: FieldTypeOption[];
  initialValues: WordFormInitialValues;
}) {
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
          minLength={1}
          maxLength={3}
          defaultValue={initialValues.referenceCode}
          className="flex h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm uppercase text-slate-100"
        />
      </label>

      <label className="space-y-2">
        <span className="text-sm text-slate-300">Nivel</span>
        <select
          name="fieldTypeId"
          required
          defaultValue={initialValues.fieldTypeId}
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

      <label className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-950/60 px-4 py-3 md:col-span-2 xl:col-span-3">
        <input
          type="checkbox"
          name="includeInDesignation"
          defaultChecked={initialValues.includeInDesignation}
          className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-amber-400 focus:ring-amber-400"
        />
        <div>
          <p className="text-sm font-medium text-slate-100">Incluir na designacao final</p>
          <p className="text-xs text-slate-400">Desativa quando a palavra so deve entrar na referencia/codigo.</p>
        </div>
      </label>

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
