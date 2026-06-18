"use client";

import { memo, type FC, type KeyboardEvent } from "react";
import { ChevronDown, Plus, Trash2 } from "lucide-react";
import {
  themeColorMix,
  TEXT_COLOR,
  THEME_COLOR,
  ACTIVE_COLOR,
  BUTTON_BG_COLOR,
  BUTTON_TEXT_COLOR,
} from "@/lib/utils";
import type { AddSettings, ReplaceSettings } from "@/types";

export type ActiveTools = {
  add?: boolean;
  replace?: boolean;
};

interface RightPanelProps {
  activeTools: ActiveTools;
  addSettings: AddSettings;
  onAddSettingsChange: (patch: Partial<AddSettings>) => void;
  replaceSettings: ReplaceSettings;
  onReplaceSettingsChange: (patch: Partial<ReplaceSettings>) => void;
  // Optional hooks from parent page
  isAddEnabled?: boolean;
  isReplaceEnabled?: boolean;
  onToggleAddEnabled?: (v: boolean) => void;
  onToggleReplaceEnabled?: (v: boolean) => void;
  onAddNewField?: () => void;
  onRemoveNewField?: (index: number) => void;
  onApplyAdd?: () => void;
  onUndoActive?: () => void;
  undoDisabled?: boolean;
}

const RightPanel: FC<RightPanelProps> = ({
  activeTools,
  addSettings,
  onAddSettingsChange,
  replaceSettings,
  onReplaceSettingsChange,
  isAddEnabled,
  isReplaceEnabled,
  onToggleAddEnabled,
  onToggleReplaceEnabled,
  onAddNewField,
  onRemoveNewField,
  onApplyAdd,
  onUndoActive,
  undoDisabled,
}) => {
  if (!activeTools?.add && !activeTools?.replace) return null;

  const handleNumberOnly = (e: KeyboardEvent<HTMLInputElement>) => {
    const key = e.key;
    if (["e", "E", "+", "-", "."].includes(key)) e.preventDefault();
  };

  const handleSetAddMode = (mode: AddSettings["mode"]) => {
    if (!onAddSettingsChange) return;
    if (mode === "alternative") {
      const base = addSettings.baseValues?.[0] ?? 16;
      onAddSettingsChange({ mode, baseValues: [base] });
    } else if (mode === "sequential") {
      const baseValues = (addSettings.baseValues || []).slice(
        0,
        addSettings.numFields,
      );
      while (baseValues.length < addSettings.numFields)
        baseValues.push(baseValues[baseValues.length - 1] ?? 16);
      onAddSettingsChange({ mode, baseValues });
    } else {
      onAddSettingsChange({ mode });
    }
  };

  const handleAddNewFieldLocal = () => {
    if (typeof onAddNewField === "function") return onAddNewField();
    const num = addSettings.numFields + 1;
    const contents = [...addSettings.contents, ""];
    let baseValues: number[] = [];
    if (addSettings.mode === "sequential") {
      baseValues = [
        ...(addSettings.baseValues || []),
        addSettings.baseValues?.[addSettings.baseValues.length - 1] ?? 16,
      ];
    } else if (addSettings.mode === "alternative") {
      baseValues = [addSettings.baseValues?.[0] ?? 16];
    } else {
      baseValues = [];
    }
    onAddSettingsChange({ numFields: num, contents, baseValues });
  };

  const handleRemoveNewFieldLocal = (index: number) => {
    if (typeof onRemoveNewField === "function") return onRemoveNewField(index);
    if (addSettings.numFields <= 1) return;
    const contents = addSettings.contents.filter((_, i) => i !== index);
    let baseValues: number[] = [];
    if (addSettings.mode === "sequential") {
      baseValues = (addSettings.baseValues || []).filter((_, i) => i !== index);
    } else if (addSettings.mode === "alternative") {
      baseValues = [addSettings.baseValues?.[0] ?? 16];
    } else {
      baseValues = [];
    }
    onAddSettingsChange({
      numFields: addSettings.numFields - 1,
      contents,
      baseValues,
    });
  };

  const handleContentChangeLocal = (index: number, value: string) => {
    const next = [...addSettings.contents];
    next[index] = value;
    onAddSettingsChange({ contents: next });
  };

  const handleBaseValueChangeLocal = (index: number, value: string) => {
    const parsed = parseInt(value, 10);
    const val = isNaN(parsed) ? 1 : parsed;
    if (addSettings.mode === "alternative" || addSettings.numFields === 1) {
      onAddSettingsChange({ baseValues: [val] });
      return;
    }
    const next = [...(addSettings.baseValues || [])];
    next[index] = val;
    onAddSettingsChange({ baseValues: next });
  };

  return (
    <aside
      className="w-full flex flex-col gap-3 sm:gap-4 md:gap-6 p-3 sm:p-4 md:p-6 overflow-y-auto scrollbar-thin"
      style={{ color: THEME_COLOR }}
    >
      {activeTools.add && (
        <>
          <section className="space-y-4">
            <div className="bg-[#121214] border border-white/5 rounded-3xl p-4">
            <label className="flex items-center gap-3 cursor-pointer select-none group border-b border-white/5 pb-2">
              <input
                type="checkbox"
                checked={isAddEnabled ?? !!activeTools.add}
                onChange={(e) => onToggleAddEnabled?.(e.target.checked)}
                className="w-4 h-4 rounded border-white/10 bg-black/40 text-emerald-500 focus:ring-emerald-500 cursor-pointer"
              />
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-emerald-400 flex items-center justify-center text-black font-extrabold text-sm">
                  +
                </span>
                <h3 className="text-[10px] font-black uppercase tracking-widest text-white group-hover:text-emerald-400 transition-colors">
                  ADD INSERTION
                </h3>
              </div>
            </label>

            <div className="space-y-3 mt-3">
              <div className="flex flex-col gap-2">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">
                  Insertion Mode
                </span>
                <div className="inline-flex bg-black/40 rounded-full p-1 gap-1 border border-white/10">
                  <button
                    type="button"
                    onClick={() => handleSetAddMode("alternative")}
                    className={`px-3 py-1 text-[10px] font-extrabold uppercase tracking-widest rounded-full transition-all cursor-pointer ${
                      addSettings.mode === "alternative"
                        ? "bg-emerald-400 text-black shadow-sm"
                        : "bg-transparent text-white/70"
                    }`}
                    aria-pressed={addSettings.mode === "alternative"}
                    title={
                      addSettings.mode === "alternative"
                        ? "Active insertion mode: Alternative"
                        : "Set insertion mode: Alternative"
                    }
                    aria-label={
                      addSettings.mode === "alternative"
                        ? "Active insertion mode Alternative"
                        : "Set insertion mode Alternative"
                    }
                  >
                    Alternative
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetAddMode("sequential")}
                    className={`px-3 py-1 text-[10px] font-extrabold uppercase tracking-widest rounded-full transition-all cursor-pointer ${
                      addSettings.mode === "sequential"
                        ? "bg-emerald-400 text-black shadow-sm"
                        : "bg-transparent text-white/70"
                    }`}
                    aria-pressed={addSettings.mode === "sequential"}
                    title={
                      addSettings.mode === "sequential"
                        ? "Active insertion mode: Sequential"
                        : "Set insertion mode: Sequential"
                    }
                    aria-label={
                      addSettings.mode === "sequential"
                        ? "Active insertion mode Sequential"
                        : "Set insertion mode Sequential"
                    }
                  >
                    Sequential
                  </button>
                </div>
              </div>

              {(addSettings.mode === "alternative" ||
                addSettings.numFields === 1) && (
                <div className="space-y-2">
                  <label className="text-[8px] font-bold uppercase tracking-widest text-white/40">
                    Insert Every (N) Words
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={addSettings.baseValues[0] || ""}
                    onKeyDown={handleNumberOnly}
                    onChange={(e) =>
                      handleBaseValueChangeLocal(0, e.target.value)
                    }
                    placeholder="e.g. 16"
                    className="w-24 h-10 bg-black/40 border border-white/10 rounded-xl px-3 text-sm text-white outline-none focus:border-emerald-400 font-bold"
                  />
                </div>
              )}

              <div className="space-y-3 max-h-[220px] overflow-y-auto custom-scrollbar pr-1">
                {addSettings.contents.map((content, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-white/5 border border-white/5 rounded-2xl space-y-2 relative group text-left"
                  >
                    {addSettings.numFields > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveNewFieldLocal(idx)}
                        className="absolute top-1.5 right-1.5 p-1 hover:bg-red-500/10 text-red-400 hover:text-red-300 rounded-lg transition-colors cursor-pointer"
                        title="Remove row"
                      >
                        <Trash2 size={11} />
                      </button>
                    )}
                    <div
                      style={{ color: ACTIVE_COLOR }}
                      className="text-[9px] font-black uppercase tracking-widest"
                    >
                      Entry #{idx + 1}
                    </div>

                    <div className="grid grid-cols-1 gap-1">
                      {addSettings.mode === "sequential" && (
                        <div className="space-y-0.5">
                          <label className="text-[8px] font-bold uppercase tracking-widest text-white/40">
                            Insert Every (N) Words
                          </label>
                          <input
                            type="number"
                            min="1"
                            value={addSettings.baseValues[idx] || ""}
                            onChange={(e) =>
                              handleBaseValueChangeLocal(idx, e.target.value)
                            }
                            placeholder="e.g. 5"
                            className="w-24 h-10 bg-black/40 border border-white/10 rounded-xl px-3 text-sm text-white outline-none focus:border-emerald-400 font-bold"
                          />
                        </div>
                      )}

                      <div className="space-y-0.5">
                        <label className="text-[8px] font-bold uppercase tracking-widest text-white/40">
                          Text to Insert
                        </label>
                        <input
                          type="text"
                          value={content}
                          onChange={(e) =>
                            handleContentChangeLocal(idx, e.target.value)
                          }
                          placeholder="e.g. [ADDON]"
                          className="w-full h-10 bg-black/40 border border-white/10 rounded-xl px-3 text-sm text-white outline-none focus:border-emerald-400"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="w-full mb-2">
                <button
                  type="button"
                  onClick={handleAddNewFieldLocal}
                  className="w-full h-10 bg-white/5 hover:bg-emerald-500 hover:text-black text-sky-400 font-black uppercase tracking-widest rounded-xl flex items-center justify-center gap-3 transition-all whitespace-nowrap border border-white/10"
                  title="Add a new field row"
                >
                  <Plus size={14} />
                  ADD FIELD ROW
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onApplyAdd?.()}
                  disabled={!onApplyAdd || addSettings.contents.length === 0}
                  title="Insert (inserts snippets only)"
                  className="flex-1 h-10 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-30 rounded-xl text-sm font-black uppercase tracking-widest text-black transition active:scale-[0.98] whitespace-nowrap flex items-center justify-center"
                >
                  Insert
                </button>

                <button
                  type="button"
                  onClick={() => onUndoActive?.()}
                  disabled={!onUndoActive || undoDisabled}
                  title="Undo last insertion"
                  className="px-3 h-10 bg-white/5 hover:bg-white/10 disabled:opacity-40 border border-white/10 rounded-xl text-sm font-black uppercase flex items-center justify-center"
                >
                  Undo
                </button>
              </div>
            </div>
          </div>
          </section>
        </>
      )}

      {activeTools.add && activeTools.replace && (
        <div className="h-px" style={{ backgroundColor: themeColorMix(90) }} />
      )}

      {activeTools.replace && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h5
              className="text-xs font-black uppercase tracking-widest"
              style={{ color: THEME_COLOR }}
            >
              Replace Section
            </h5>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label
                className="text-[10px] font-bold uppercase opacity-40"
                style={{ color: THEME_COLOR }}
              >
                Find Fields
              </label>
              <div
                className="flex items-center gap-2 bg-white/5 border rounded-full px-3 py-1 text-xs font-bold"
                style={{ borderColor: themeColorMix(90) }}
              >
                <span className="opacity-60 text-[10px]">Fields</span>
                <select
                  aria-label="Find fields"
                  value={replaceSettings.numFind}
                  onChange={(e) => {
                    const num = parseInt(e.target.value, 10) || 1;
                    const finds = [...replaceSettings.finds];
                    while (finds.length < num) finds.push("");
                    onReplaceSettingsChange({ numFind: num, finds });
                  }}
                  className="bg-transparent border-none text-xs font-bold outline-none"
                  style={{ color: TEXT_COLOR }}
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                    <option key={n} value={n} className="bg-zinc-900">
                      {n}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-2">
              {Array.from({ length: replaceSettings.numFind }).map((_, i) => (
                <div key={i} className="relative">
                  <input
                    value={replaceSettings.finds[i] || ""}
                    type="text"
                    onChange={(e) => {
                      const finds = [...replaceSettings.finds];
                      finds[i] = e.target.value;
                      onReplaceSettingsChange({ finds });
                    }}
                    placeholder={`${i + 1}: Text or /regex/`}
                    className="w-full bg-white/5 border rounded-xl px-4 py-2 text-sm outline-none placeholder:opacity-20"
                    style={{
                      color: TEXT_COLOR,
                      borderColor: themeColorMix(90),
                    }}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label
                className="text-[10px] font-bold uppercase opacity-40"
                style={{ color: THEME_COLOR }}
              >
                Replace With
              </label>
              <div
                className="flex items-center gap-2 bg-white/5 border rounded-full px-3 py-1 text-xs font-bold"
                style={{ borderColor: themeColorMix(90) }}
              >
                <span className="opacity-60 text-[10px]">Replace</span>
                <select
                  aria-label="Replace count"
                  value={replaceSettings.numReplace}
                  onChange={(e) => {
                    const num = parseInt(e.target.value, 10) || 1;
                    const replaces = [...replaceSettings.replaces];
                    while (replaces.length < num) replaces.push("");
                    onReplaceSettingsChange({ numReplace: num, replaces });
                  }}
                  className="bg-transparent border-none text-xs font-bold outline-none"
                  style={{ color: TEXT_COLOR }}
                >
                  {Array.from({ length: replaceSettings.numFind }).map(
                    (_, i) => (
                      <option key={i + 1} value={i + 1} className="bg-zinc-900">
                        {i + 1}
                      </option>
                    ),
                  )}
                </select>
              </div>
            </div>
            <div className="space-y-2">
              {Array.from({ length: replaceSettings.numReplace }).map(
                (_, i) => (
                  <div key={i} className="relative">
                    <input
                      value={replaceSettings.replaces[i] || ""}
                      type="text"
                      onChange={(e) => {
                        const replaces = [...replaceSettings.replaces];
                        replaces[i] = e.target.value;
                        onReplaceSettingsChange({ replaces });
                      }}
                      placeholder={`${i + 1}: Replacement text`}
                      className="w-full bg-white/5 border rounded-xl px-4 py-2 text-sm outline-none placeholder:opacity-20"
                      style={{
                        color: TEXT_COLOR,
                        borderColor: themeColorMix(90),
                      }}
                    />
                  </div>
                ),
              )}
            </div>
          </div>
        </section>
      )}
    </aside>
  );
};

export default memo(RightPanel);
