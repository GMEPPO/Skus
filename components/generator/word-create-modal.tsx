"use client";

import { X } from "lucide-react";
import { WordForm } from "@/components/catalog/word-form";
import { Button } from "@/components/ui/button";
import type { FieldTypeOption } from "@/lib/admin-catalog";
import { createWordFromGeneratorAction } from "@/lib/word-catalog-actions";
import type { GeneratorLevel } from "@/lib/types";

export function WordCreateModal({
  open,
  level,
  fieldTypes,
  onClose,
  onCreated,
}: {
  open: boolean;
  level: GeneratorLevel | null;
  fieldTypes: FieldTypeOption[];
  onClose: () => void;
  onCreated: (wordId: string, levelId: string) => void;
}) {
  if (!open || !level) return null;

  const fieldTypeId = level.fieldTypeId ?? fieldTypes.find((fieldType) => fieldType.code === level.fieldType)?.id ?? "";

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose();
      }}
      role="presentation"
    >
      <div
        className="flex max-h-[min(90vh,760px)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="word-create-modal-title"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-800 px-5 py-4">
          <div>
            <h2 id="word-create-modal-title" className="text-lg font-semibold text-slate-50">
              Nova palavra
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Nivel {level.order}: {level.label}
            </p>
          </div>
          <Button type="button" variant="outline" className="h-8 w-8 shrink-0 p-0" onClick={onClose}>
            <X className="h-4 w-4" />
            <span className="sr-only">Fechar</span>
          </Button>
        </div>

        <div className="overflow-auto p-5">
          <WordForm
            key={level.id}
            variant="modal"
            clientAction={createWordFromGeneratorAction}
            submitLabel="Criar palavra"
            onCancel={onClose}
            onSuccess={(wordId) => {
              onCreated(wordId, level.id);
              onClose();
            }}
            fieldTypes={fieldTypes}
            categoryLevelId={level.id}
            lockFieldType
            lockedFieldTypeLabel={level.label}
            initialValues={{
              label: "",
              referenceCode: "",
              fieldTypeId,
              designationPt: "",
              designationEs: "",
              designationEn: "",
              includeInDesignation: true,
            }}
          />
        </div>
      </div>
    </div>
  );
}
