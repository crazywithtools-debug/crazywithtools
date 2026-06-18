"use client";

import { useState, memo, type FC, type ReactNode } from 'react';
import {
  LayoutGrid,
  Replace,
  Plus,
  Import,
  StickyNote as StickyNoteIcon,
  ChevronRight,
  MoreVertical,
  Trash2,
  Edit2,
  Undo,
  Redo,
  Sparkles,
} from 'lucide-react';
import { cn, themeColorMix, THEME_COLOR, ACTIVE_COLOR } from '@/lib/utils';
import type { StickyNote as StickyNoteType } from '@/types';

interface SidebarProps {
  activeTools?: {
    replace?: boolean;
    add?: boolean;
    edit?: boolean;
    aiContent?: boolean;
    stickyNotes?: boolean;
  };
  onToolToggle?: (tool: string) => void;
  onImportClick?: () => void;
  stickyNotes?: StickyNoteType[];
  onOpenNote?: (id: string | number) => void;
  onDeleteNote?: (id: string | number) => void;
  onRenameNote?: (id: string | number, title: string) => void;
  onUndoRename?: (id: string | number) => void;
  onRedoRename?: (id: string | number) => void;
  onAddNote?: () => void;
  onClearAllNotes?: () => void;
  // url windows removed — feature deprecated
  collapsed?: boolean;
  onMenuToggle?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTools = {},
  onToolToggle,
  onImportClick,
  stickyNotes = [],
  onOpenNote,
  onDeleteNote,
  onRenameNote,
  onUndoRename,
  onRedoRename,
  onAddNote,
  onClearAllNotes,
  collapsed = false,
  onMenuToggle,
}) => {
  const [editingNoteId, setEditingNoteId] = useState<string | number | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | number | null>(null);

  return (
    <aside
      className={cn('flex flex-col transition-all duration-300 overflow-hidden h-full w-full font-poppins bg-gradient-to-b from-white/5 to-white/2')}
      style={{ color: THEME_COLOR }}
    >
        <div
          className={cn('p-3 sm:p-4 border-b flex items-center gap-2 sm:gap-3 flex-shrink-0', collapsed ? 'justify-center' : '')}
          style={{ borderColor: themeColorMix(90) }}
        >
        <button
          onClick={onMenuToggle}
          className="p-1.5 hover:bg-white/10 rounded-lg transition-colors shrink-0"
          style={{ color: THEME_COLOR }}
          title={collapsed ? 'Expand Menu' : 'Collapse Menu'}
        >
          <LayoutGrid size={18} />
        </button>
        {!collapsed && <h4 className="font-bold text-xs sm:text-sm uppercase tracking-wider truncate">Menu</h4>}
      </div>

      <div className="flex-1 overflow-y-auto py-2 custom-scrollbar">
        <ToolItem
          icon={<Replace size={16} />}
          label="Replace"
          active={!!activeTools.replace}
          onClick={() => onToolToggle && onToolToggle('replace')}
          collapsed={collapsed}
        />
        <ToolItem
          icon={<Plus size={16} />}
          label="Add"
          active={!!activeTools.add}
          onClick={() => onToolToggle && onToolToggle('add')}
          collapsed={collapsed}
        />
        {/* Edit toggle removed; edit always enabled in main editor */}
        <ToolItem icon={<Import size={16} />} label="Import File" onClick={onImportClick} collapsed={collapsed} />
        <ToolItem
          icon={<Sparkles size={16} />}
          label="AI Content"
          active={!!activeTools.aiContent}
          onClick={() => onToolToggle && onToolToggle('aiContent')}
          collapsed={collapsed}
        />
        <ToolItem
          icon={<StickyNoteIcon size={16} />}
          label="Sticky Notes"
          active={!!activeTools.stickyNotes}
          onClick={() => onToolToggle && onToolToggle('stickyNotes')}
          collapsed={collapsed}
        />

        {/* URL support removed from sidebar */}

        {activeTools.stickyNotes && !collapsed && (
          <div className="mt-4 sm:mt-6 px-3 sm:px-4">
            <div className="flex items-center justify-between mb-2">
              <h5 className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest opacity-60">Notes</h5>
              <div className="flex items-center gap-1">
                <button onClick={onAddNote} className="p-1 hover:bg-white/10 rounded transition-colors" title="Add New Note">
                  <Plus size={12} />
                </button>
                <button onClick={onClearAllNotes} className="p-1 hover:bg-white/10 rounded hover:text-red-500 transition-colors" title="Clear All">
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
            <div className="space-y-1 max-h-[200px] overflow-y-auto scrollbar-thin">
              {stickyNotes.map((note) => (
                <div
                  key={note.id}
                  className="group relative flex items-center gap-2 p-2 rounded-lg hover:bg-white/5 cursor-pointer text-xs sm:text-sm"
                  onClick={() => onOpenNote && onOpenNote(note.id)}
                >
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: note.color }} />
                  {editingNoteId === note.id ? (
                    <input
                      autoFocus
                      className="bg-transparent border-none outline-none w-full text-xs"
                      defaultValue={note.title}
                      onClick={(e) => e.stopPropagation()}
                      onBlur={(e) => {
                        onRenameNote && onRenameNote(note.id, e.target.value);
                        setEditingNoteId(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          onRenameNote && onRenameNote(note.id, (e.currentTarget as HTMLInputElement).value);
                          setEditingNoteId(null);
                        }
                      }}
                    />
                  ) : (
                    <span className="truncate flex-1 opacity-80 text-xs" onClick={() => setEditingNoteId(note.id)}>
                      {note.title}
                    </span>
                  )}

                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuOpenId(menuOpenId === note.id ? null : note.id);
                      }}
                      className="p-1 hover:bg-white/10 rounded"
                    >
                      <MoreVertical size={12} />
                    </button>

                    {menuOpenId === note.id && (
                      <div className="absolute right-0 top-full mt-1 w-32 bg-gradient-to-b from-zinc-800 to-zinc-900 border border-white/10 rounded-lg shadow-xl z-50 py-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => {
                            setEditingNoteId(note.id);
                            setMenuOpenId(null);
                          }}
                          className="w-full text-left px-3 py-1.5 text-xs hover:bg-white/10 flex items-center gap-2 transition"
                        >
                          <Edit2 size={10} /> Rename
                        </button>
                        <button
                          disabled={(note.titleHistoryIndex ?? 0) <= 0}
                          onClick={() => onUndoRename && onUndoRename(note.id)}
                          className="w-full text-left px-3 py-1.5 text-xs hover:bg-white/10 flex items-center gap-2 disabled:opacity-30 transition"
                        >
                          <Undo size={10} /> Undo
                        </button>
                        <button
                          disabled={!(note.titleHistory && (note.titleHistoryIndex ?? 0) < (note.titleHistory.length - 1))}
                          onClick={() => onRedoRename && onRedoRename(note.id)}
                          className="w-full text-left px-3 py-1.5 text-xs hover:bg-white/10 flex items-center gap-2 disabled:opacity-30 transition"
                        >
                          <Redo size={10} /> Redo
                        </button>
                        <div className="h-px my-1 bg-white/5" />
                        <button
                          onClick={() => {
                            onDeleteNote && onDeleteNote(note.id);
                            setMenuOpenId(null);
                          }}
                          className="w-full text-left px-3 py-1.5 text-xs hover:bg-white/10 text-red-500 flex items-center gap-2 transition"
                        >
                          <Trash2 size={10} /> Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {stickyNotes.length === 0 && <p className="text-[9px] sm:text-[10px] italic py-2 opacity-40">No notes yet</p>}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};

export default memo(Sidebar);

const ToolItem: FC<{ icon: ReactNode; label: string; active?: boolean; onClick?: () => void; collapsed?: boolean }> = ({ icon, label, active, onClick, collapsed }) => (
  <button
    onClick={onClick}
    className={cn(
      'w-full flex items-center transition-all relative group',
      collapsed ? 'justify-center px-0 py-3 sm:py-4' : 'gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 sm:py-3',
      active ? 'bg-gradient-to-r from-blue-500/20 to-transparent' : 'hover:bg-white/5'
    )}
    style={{ color: active ? ACTIVE_COLOR : THEME_COLOR, opacity: active ? 1 : 0.6 }}
    title={collapsed ? label : undefined}
  >
    <div className={cn('shrink-0 transition-transform group-active:scale-90')} style={{ color: active ? ACTIVE_COLOR : THEME_COLOR }}>
      {icon}
    </div>
    {!collapsed && <span className="text-xs sm:text-sm font-medium truncate">{label}</span>}
    {active && !collapsed && <ChevronRight size={12} className="ml-auto opacity-50 shrink-0" />}
    {active && (
      <div className={cn('absolute rounded-r-full transition-all', collapsed ? 'left-0 top-2 bottom-2 w-1' : 'left-0 top-1/4 bottom-1/4 w-1')} style={{ backgroundColor: ACTIVE_COLOR }} />
    )}
  </button>
);
