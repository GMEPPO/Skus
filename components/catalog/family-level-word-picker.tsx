"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";

type OptionItem = {
  id: string;
  label: string;
  referenceCode: string;
};

type SectionItem = {
  code: string;
  title: string;
  inputName: string;
  options: OptionItem[];
};

export function FamilyLevelWordPicker({
  sections,
}: {
  sections: SectionItem[];
}) {
  const [selectedIdsBySection, setSelectedIdsBySection] = useState<Record<string, string[]>>({});
  const [pendingIdBySection, setPendingIdBySection] = useState<Record<string, string>>({});

  const optionsBySection = useMemo(() => {
    const map = new Map<string, OptionItem[]>();
    for (const section of sections) {
      map.set(section.code, section.options);
    }
    return map;
  }, [sections]);

  function addWord(sectionCode: string) {
    const pendingId = pendingIdBySection[sectionCode];
    if (!pendingId) return;

    setSelectedIdsBySection((current) => {
      const currentItems = current[sectionCode] ?? [];
      if (currentItems.includes(pendingId)) return current;
      return {
        ...current,
        [sectionCode]: [...currentItems, pendingId],
      };
    });
    setPendingIdBySection((current) => ({ ...current, [sectionCode]: "" }));
  }

  function removeWord(sectionCode: string, wordId: string) {
    setSelectedIdsBySection((current) => ({
      ...current,
      [sectionCode]: (current[sectionCode] ?? []).filter((item) => item !== wordId),
    }));
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
      {sections.map((section, index) => {
        const selectedIds = selectedIdsBySection[section.code] ?? [];
        const options = optionsBySection.get(section.code) ?? [];
        const selectedOptions = selectedIds
          .map((id) => options.find((option) => option.id === id))
          .filter((item): item is OptionItem => Boolean(item));
        const previousSectionCode = index > 0 ? sections[index - 1].code : null;
        const previousHasSelections = previousSectionCode
          ? (selectedIdsBySection[previousSectionCode] ?? []).length > 0
          : true;
        const isLocked = !previousHasSelections;

        return (
          <div key={section.code} className="space-y-2 rounded-lg border border-slate-800 bg-slate-950/40 p-3">
            <span className="text-sm text-slate-300">{section.title}</span>

            {selectedIds.map((id) => (
              <input key={`${section.inputName}-${id}`} type="hidden" name={section.inputName} value={id} />
            ))}

            <div className="flex gap-2">
              <select
                value={pendingIdBySection[section.code] ?? ""}
                onChange={(event) =>
                  setPendingIdBySection((current) => ({ ...current, [section.code]: event.target.value }))
                }
                disabled={isLocked}
                className="flex h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <option value="">
                  {isLocked ? "Seleciona primeiro o nivel anterior" : "Seleciona uma palavra"}
                </option>
                {options
                  .filter((option) => !selectedIds.includes(option.id))
                  .map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label} - {option.referenceCode}
                    </option>
                  ))}
              </select>
              <Button
                type="button"
                variant="outline"
                disabled={isLocked || !pendingIdBySection[section.code]}
                onClick={() => addWord(section.code)}
              >
                Adicionar
              </Button>
            </div>

            <div className="min-h-[4.5rem] space-y-2 rounded-lg border border-slate-800 bg-slate-900/40 p-2">
              {selectedOptions.length > 0 ? (
                selectedOptions.map((option) => (
                  <div
                    key={option.id}
                    className="flex items-center justify-between rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200"
                  >
                    <span>
                      {option.label} - {option.referenceCode}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeWord(section.code, option.id)}
                      className="rounded px-2 py-0.5 text-red-200 hover:bg-red-500/20"
                    >
                      Quitar
                    </button>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-500">Sem palavras selecionadas.</p>
              )}
            </div>

            <p className="text-xs text-slate-500">
              Opcional. Escolhe uma a uma as palavras ja existentes para este nivel.
            </p>
          </div>
        );
      })}
    </div>
  );
}
