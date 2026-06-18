"use client";

import { memo, type FC, type KeyboardEvent } from 'react';
import { ChevronDown } from 'lucide-react';
import { themeColorMix, TEXT_COLOR, THEME_COLOR, ACTIVE_COLOR, BUTTON_BG_COLOR, BUTTON_TEXT_COLOR } from '@/lib/utils';
import type { AddSettings, ReplaceSettings } from '@/types';

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
}

const RightPanel: FC<RightPanelProps> = ({
  activeTools,
  addSettings,
  onAddSettingsChange,
  replaceSettings,
  onReplaceSettingsChange,
}) => {
  if (!activeTools?.add && !activeTools?.replace) return null;

  const handleNumberOnly = (e: KeyboardEvent<HTMLInputElement>) => {
    const key = e.key;
    if (['e', 'E', '+', '-', '.'].includes(key)) e.preventDefault();
  };

  return (
    <aside className="w-full flex flex-col gap-3 sm:gap-4 md:gap-6 p-3 sm:p-4 md:p-6 overflow-y-auto scrollbar-thin" style={{ color: THEME_COLOR }}>
      {activeTools.add && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h5 className="text-xs font-black uppercase tracking-widest" style={{ color: THEME_COLOR }}>
              Add Section
            </h5>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 bg-white/5 border rounded-full px-3 py-1 text-xs font-bold" style={{ borderColor: themeColorMix(90) }}>
                <span className="opacity-60 text-[10px]">Fields</span>
                <input
                  aria-label="Add fields"
                  type="number"
                  min={1}
                  max={10}
                  value={addSettings.numFields}
                  onChange={(e) => {
                    const raw = parseInt(e.target.value, 10);
                    const num = Number.isNaN(raw) ? 1 : Math.max(1, Math.min(10, raw));
                    const contents = addSettings.contents.slice(0, num);
                      const baseValues = addSettings.baseValues.slice(0, num);
                      while (contents.length < num) contents.push('');
                      while (baseValues.length < num) baseValues.push(16);
                    onAddSettingsChange({ numFields: num, contents, baseValues });
                  }}
                  className="w-10 bg-transparent text-xs font-bold text-right outline-none"
                  style={{ color: TEXT_COLOR }}
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {Array.from({ length: addSettings.numFields }).map((_, i) => (
              <div key={i} className="space-y-2">
                <label className="text-[10px] font-bold uppercase opacity-40" style={{ color: THEME_COLOR }}>
                  New Content {i + 1}
                </label>
                <textarea
                  value={addSettings.contents[i] || ''}
                  onChange={(e) => {
                    const contents = [...addSettings.contents];
                    contents[i] = e.target.value;
                    onAddSettingsChange({ contents });
                  }}
                  placeholder={`Enter content ${i + 1}...`}
                  className="w-full min-h-20 bg-white/5 border rounded-xl p-3 text-sm outline-none transition-all placeholder:opacity-20"
                  style={{ color: TEXT_COLOR, borderColor: themeColorMix(90) }}
                />
              </div>
            ))}
          </div>

          {addSettings.numFields > 1 && (
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase opacity-40" style={{ color: THEME_COLOR }}>
                Insertion Mode
              </label>
              <div className="relative">
                <select
                  value={addSettings.mode}
                  onChange={(e) => onAddSettingsChange({ mode: e.target.value as AddSettings['mode'] })}
                  className="w-full appearance-none bg-white/5 border rounded-xl px-4 py-2 text-sm outline-none cursor-pointer"
                  style={{ color: TEXT_COLOR, borderColor: themeColorMix(90) }}
                >
                  <option value="alternative" className="bg-zinc-900">
                    Alternative
                  </option>
                  <option value="sequential" className="bg-zinc-900">
                    Sequential
                  </option>
                </select>
                <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none opacity-40" style={{ color: THEME_COLOR }} />
              </div>
            </div>
          )}

          {/* Show interval controls depending on insertion mode:
              - 'alternative' (or single field): one global "Insert Every (N) Words"
              - 'sequential': each entry shows its own "Insert Every (N) Words" control (rendered inline per-entry)
              - 'continuous' or others: no interval controls shown (only text fields)
          */}
          {addSettings.mode === 'alternative' || addSettings.numFields === 1 ? (
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase opacity-40" style={{ color: THEME_COLOR }}>
                Insert after every X words
              </label>
              <input
                type="number"
                min={1}
                value={addSettings.baseValues[0] || ''}
                onKeyDown={handleNumberOnly}
                onChange={(e) => {
                  const baseValues = [...addSettings.baseValues];
                  baseValues[0] = parseInt(e.target.value, 10) || 16;
                  onAddSettingsChange({ baseValues });
                }}
                placeholder="Enter word count..."
                className="w-full bg-white/5 border rounded-xl px-4 py-2 text-sm outline-none placeholder:opacity-20"
                style={{ color: TEXT_COLOR, borderColor: themeColorMix(90) }}
              />
            </div>
          ) : null}

          {addSettings.mode === 'sequential' && addSettings.numFields > 0 ? (
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase opacity-40" style={{ color: THEME_COLOR }}>
                Word counts for each field
              </label>
              <div className="grid grid-cols-1 gap-2">
                {Array.from({ length: addSettings.numFields }).map((_, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="text-[10px] font-black uppercase opacity-40 w-6">#{i + 1}</div>
                      <input
                      type="number"
                      min={1}
                      value={addSettings.baseValues[i] || ''}
                      onKeyDown={handleNumberOnly}
                      onChange={(e) => {
                        const baseValues = [...addSettings.baseValues];
                        baseValues[i] = parseInt(e.target.value, 10) || 16;
                        onAddSettingsChange({ baseValues });
                      }}
                      placeholder="e.g. 5"
                      className="w-full bg-white/5 border rounded-xl px-2 py-1 text-xs text-white outline-none font-bold"
                        style={{ color: TEXT_COLOR, borderColor: themeColorMix(90) }}
                    />
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      )}

      {activeTools.add && activeTools.replace && <div className="h-px" style={{ backgroundColor: themeColorMix(90) }} />}

      {activeTools.replace && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h5 className="text-xs font-black uppercase tracking-widest" style={{ color: THEME_COLOR }}>
              Replace Section
            </h5>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold uppercase opacity-40" style={{ color: THEME_COLOR }}>
                Find Fields
              </label>
              <div className="flex items-center gap-2 bg-white/5 border rounded-full px-3 py-1 text-xs font-bold" style={{ borderColor: themeColorMix(90) }}>
                <span className="opacity-60 text-[10px]">Fields</span>
                <select
                  aria-label="Find fields"
                  value={replaceSettings.numFind}
                  onChange={(e) => {
                    const num = parseInt(e.target.value, 10) || 1;
                    const finds = [...replaceSettings.finds];
                    while (finds.length < num) finds.push('');
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
                    value={replaceSettings.finds[i] || ''}
                    type="text"
                    onChange={(e) => {
                      const finds = [...replaceSettings.finds];
                      finds[i] = e.target.value;
                      onReplaceSettingsChange({ finds });
                    }}
                    placeholder={`${i + 1}: Text or /regex/`}
                    className="w-full bg-white/5 border rounded-xl px-4 py-2 text-sm outline-none placeholder:opacity-20"
                      style={{ color: TEXT_COLOR, borderColor: themeColorMix(90) }}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold uppercase opacity-40" style={{ color: THEME_COLOR }}>
                Replace With
              </label>
              <div className="flex items-center gap-2 bg-white/5 border rounded-full px-3 py-1 text-xs font-bold" style={{ borderColor: themeColorMix(90) }}>
                <span className="opacity-60 text-[10px]">Replace</span>
                <select
                  aria-label="Replace count"
                  value={replaceSettings.numReplace}
                  onChange={(e) => {
                    const num = parseInt(e.target.value, 10) || 1;
                    const replaces = [...replaceSettings.replaces];
                    while (replaces.length < num) replaces.push('');
                    onReplaceSettingsChange({ numReplace: num, replaces });
                  }}
                  className="bg-transparent border-none text-xs font-bold outline-none"
                  style={{ color: TEXT_COLOR }}
                >
                  {Array.from({ length: replaceSettings.numFind }).map((_, i) => (
                    <option key={i + 1} value={i + 1} className="bg-zinc-900">
                      {i + 1}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-2">
              {Array.from({ length: replaceSettings.numReplace }).map((_, i) => (
                <div key={i} className="relative">
                    <input
                    value={replaceSettings.replaces[i] || ''}
                    type="text"
                    onChange={(e) => {
                      const replaces = [...replaceSettings.replaces];
                      replaces[i] = e.target.value;
                      onReplaceSettingsChange({ replaces });
                    }}
                    placeholder={`${i + 1}: Replacement text`}
                    className="w-full bg-white/5 border rounded-xl px-4 py-2 text-sm outline-none placeholder:opacity-20"
                      style={{ color: TEXT_COLOR, borderColor: themeColorMix(90) }}
                  />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </aside>
  );
};

export default memo(RightPanel);

