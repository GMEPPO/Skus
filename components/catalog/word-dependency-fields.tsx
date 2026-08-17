"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ParentLevelOption } from "@/lib/word-dependency-actions";
import type { ParentMatchMode } from "@/lib/word-dependencies";

export type WordDependencyRuleRow = {
  levelId: string;
  parentWordId: string;
};

export function WordDependencyFields({
  parentLevels,
  visibilityMode,
  onVisibilityModeChange,
  rules,
  onRulesChange,
  parentMatchMode,
  onParentMatchModeChange,
  selectionHierarchy,
  onSelectionHierarchyChange,
  showHierarchyField,
  compact = false,
}: {
  parentLevels: ParentLevelOption[];
  visibilityMode: "always" | "conditional";
  onVisibilityModeChange: (mode: "always" | "conditional") => void;
  rules: WordDependencyRuleRow[];
  onRulesChange: (rules: WordDependencyRuleRow[]) => void;
  parentMatchMode: ParentMatchMode;
  onParentMatchModeChange: (mode: ParentMatchMode) => void;
  selectionHierarchy: number | null;
  onSelectionHierarchyChange: (value: number | null) => void;
  showHierarchyField: boolean;
  compact?: boolean;
}) {
  const textClass = compact ? "text-xs" : "text-sm";

  function addRule() {
    const firstLevel = parentLevels[0];
    if (!firstLevel || firstLevel.words.length === 0) return;
    onRulesChange([
      ...rules,
      { levelId: firstLevel.levelId, parentWordId: firstLevel.words[0].id },
    ]);
  }

  function updateRule(index: number, patch: Partial<WordDependencyRuleRow>) {
    onRulesChange(rules.map((rule, ruleIndex) => (ruleIndex === index ? { ...rule, ...patch } : rule)));
  }

  function removeRule(index: number) {
    onRulesChange(rules.filter((_, ruleIndex) => ruleIndex !== index));
  }

  return (
    <div
      className={`space-y-3 rounded-xl border border-slate-700 bg-slate-950/60 p-4 ${compact ? "" : "md:col-span-2 xl:col-span-3"}`}
    >
      <div>
        <p className={`${textClass} font-medium text-slate-100`}>Cuando aparece esta palabra</p>
        <p className="mt-1 text-xs text-slate-400">
          Elige si la palabra se muestra siempre en su nivel o solo cuando otra palabra de un nivel anterior esta
          seleccionada.
        </p>
      </div>

      <div className="flex flex-wrap gap-4">
        <label className={`flex items-center gap-2 ${textClass} text-slate-200`}>
          <input
            type="radio"
            name="visibilityMode"
            value="always"
            checked={visibilityMode === "always"}
            onChange={() => onVisibilityModeChange("always")}
          />
          Siempre
        </label>
        <label className={`flex items-center gap-2 ${textClass} text-slate-200`}>
          <input
            type="radio"
            name="visibilityMode"
            value="conditional"
            checked={visibilityMode === "conditional"}
            onChange={() => onVisibilityModeChange("conditional")}
          />
          Condicionada
        </label>
      </div>

      {visibilityMode === "conditional" ? (
        <div className="space-y-3">
          {rules.length === 0 ? (
            <p className="text-xs text-slate-500">Anade al menos una condicion padre.</p>
          ) : null}

          {rules.map((rule, index) => {
            const selectedLevel = parentLevels.find((level) => level.levelId === rule.levelId) ?? parentLevels[0];
            const words = selectedLevel?.words ?? [];

            return (
              <div key={`${rule.levelId}-${index}`} className="grid gap-2 md:grid-cols-[1fr_1.4fr_auto]">
                <select
                  value={rule.levelId}
                  onChange={(event) => {
                    const levelId = event.target.value;
                    const level = parentLevels.find((entry) => entry.levelId === levelId);
                    updateRule(index, {
                      levelId,
                      parentWordId: level?.words[0]?.id ?? "",
                    });
                  }}
                  className={`rounded-lg border border-slate-700 bg-slate-950 px-3 text-slate-100 ${compact ? "h-9 text-xs" : "h-11 text-sm"}`}
                >
                  {parentLevels.map((level) => (
                    <option key={level.levelId} value={level.levelId}>
                      {level.levelLabel}
                    </option>
                  ))}
                </select>

                <select
                  value={rule.parentWordId}
                  onChange={(event) => updateRule(index, { parentWordId: event.target.value })}
                  className={`rounded-lg border border-slate-700 bg-slate-950 px-3 text-slate-100 ${compact ? "h-9 text-xs" : "h-11 text-sm"}`}
                >
                  {words.map((word) => (
                    <option key={word.id} value={word.id}>
                      {word.label} ({word.referenceCode})
                    </option>
                  ))}
                </select>

                <Button type="button" variant="outline" className="h-9 w-9 p-0" onClick={() => removeRule(index)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            );
          })}

          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" variant="outline" className={compact ? "h-8 px-3 text-xs" : undefined} onClick={addRule}>
              <Plus className="mr-1 h-4 w-4" />
              Anadir condicion
            </Button>

            {rules.length > 1 ? (
              <div className="flex flex-wrap gap-3 text-xs text-slate-300">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="parentMatchMode"
                    value="any"
                    checked={parentMatchMode === "any"}
                    onChange={() => onParentMatchModeChange("any")}
                  />
                  Cualquiera (OR)
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="parentMatchMode"
                    value="all"
                    checked={parentMatchMode === "all"}
                    onChange={() => onParentMatchModeChange("all")}
                  />
                  Todas (AND)
                </label>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {showHierarchyField ? (
        <label className="block space-y-2">
          <span className={`${textClass} text-slate-300`}>Grupo jerarquico</span>
          <select
            value={selectionHierarchy ?? ""}
            onChange={(event) => {
              const value = event.target.value;
              onSelectionHierarchyChange(value === "1" || value === "2" ? Number(value) : null);
            }}
            className={`flex w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-slate-100 ${compact ? "h-9 text-xs" : "h-11 text-sm"}`}
          >
            <option value="">Ninguno</option>
            <option value="1">1 - Embalaje principal</option>
            <option value="2">2 - Otros datos (fallback)</option>
          </select>
        </label>
      ) : null}

      {visibilityMode === "conditional"
        ? rules.map((rule) => <input key={`hidden-${rule.parentWordId}`} type="hidden" name="parentWordIds" value={rule.parentWordId} />)
        : null}
      <input type="hidden" name="visibilityMode" value={visibilityMode} />
      <input type="hidden" name="parentMatchMode" value={parentMatchMode} />
      <input type="hidden" name="selectionHierarchy" value={selectionHierarchy ?? ""} />
    </div>
  );
}
